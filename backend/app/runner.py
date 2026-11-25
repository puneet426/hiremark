"""Runs student code against tests.

Production: Judge0 (JUDGE0_URL), a sandbox on its own VM.
Development: a local runner with OS resource limits. It is NOT a security
sandbox and is refused when ENV=production.
"""
import asyncio
import base64
import os
import resource
import shutil
import subprocess
import tempfile
from pathlib import Path

import httpx

from . import config
from .questions import LANGUAGES

CPU_SECONDS = 3
WALL_SECONDS = 6
MEMORY_KB = 256 * 1024
MAX_OUTPUT = 64 * 1024
MAX_CODE_CHARS = 20_000

# One semaphore keeps 20 simultaneous Submit clicks from overloading the box.
_slots = asyncio.Semaphore(int(os.environ.get("RUNNER_PARALLEL", "4")))


class RunnerUnavailable(RuntimeError):
    pass


def _same(out: str, expected: str) -> bool:
    return out.split() == expected.split()


async def run_tests(language: str, code: str, tests: list[tuple[str, str]]) -> list[dict]:
    """Returns one dict per test: {passed, status, stdout, stderr, ms}. Never raises for student errors."""
    if language not in LANGUAGES:
        raise ValueError("Unsupported language")
    if len(code) > MAX_CODE_CHARS:
        return [{"passed": False, "status": "Code too long", "stdout": "", "stderr": "", "ms": 0} for _ in tests]
    async with _slots:
        if config.JUDGE0_URL:
            return await _judge0(language, code, tests)
        if config.ALLOW_LOCAL_RUNNER:
            return await asyncio.to_thread(_local, language, code, tests)
    raise RunnerUnavailable("No code runner is configured. Set JUDGE0_URL.")


# ----------------------------------------------------------------- Judge0
def _b64(s: str) -> str:
    return base64.b64encode(s.encode()).decode()


def _unb64(s: str | None) -> str:
    if not s:
        return ""
    try:
        return base64.b64decode(s).decode(errors="replace")
    except Exception:
        return ""


async def _judge0(language: str, code: str, tests: list[tuple[str, str]]) -> list[dict]:
    headers = {"X-Auth-Token": config.JUDGE0_TOKEN} if config.JUDGE0_TOKEN else {}
    lang_id = LANGUAGES[language]["judge0"]

    async def one(client: httpx.AsyncClient, stdin: str, expected: str) -> dict:
        body = {
            "language_id": lang_id, "source_code": _b64(code), "stdin": _b64(stdin),
            "cpu_time_limit": CPU_SECONDS, "wall_time_limit": WALL_SECONDS, "memory_limit": MEMORY_KB,
            "max_processes_and_or_threads": 30, "enable_network": False,
        }
        try:
            r = await client.post(f"{config.JUDGE0_URL}/submissions?base64_encoded=true&wait=true", json=body)
            r.raise_for_status()
            d = r.json()
        except Exception:
            return {"passed": False, "status": "Runner error", "stdout": "", "stderr": "The code runner did not respond.", "ms": 0}
        out = _unb64(d.get("stdout"))
        err = _unb64(d.get("compile_output")) or _unb64(d.get("stderr"))
        desc = (d.get("status") or {}).get("description", "Error")
        ok = (d.get("status") or {}).get("id") in (3, 4) and _same(out, expected)
        status = "Passed" if ok else ("Wrong answer" if desc in ("Accepted", "Wrong Answer") else desc)
        return {"passed": ok, "status": status, "stdout": out[:MAX_OUTPUT], "stderr": err[:4000], "ms": int(float(d.get("time") or 0) * 1000)}

    async with httpx.AsyncClient(timeout=30, headers=headers) as client:
        return list(await asyncio.gather(*(one(client, i, e) for i, e in tests)))


# ------------------------------------------------------- Local (development)
def _limits():
    resource.setrlimit(resource.RLIMIT_CPU, (CPU_SECONDS, CPU_SECONDS + 1))
    resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024, 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_NPROC, (256, 256))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    os.setsid()


def _mem_limit():
    _limits()
    lim = MEMORY_KB * 1024 * 4  # address space is larger than resident memory
    resource.setrlimit(resource.RLIMIT_AS, (lim, lim))


_ENV = {"PATH": "/usr/local/bin:/usr/bin:/bin:" + os.path.dirname(shutil.which("node") or "/usr/bin/node"), "HOME": "/tmp", "LANG": "C.UTF-8"}


def _local(language: str, code: str, tests: list[tuple[str, str]]) -> list[dict]:
    with tempfile.TemporaryDirectory(prefix="hm-run-") as tmp:
        d = Path(tmp)
        compile_cmd = None
        preexec = _mem_limit
        if language == "python":
            (d / "main.py").write_text(code)
            cmd = ["python3", "-I", "main.py"]
        elif language == "javascript":
            (d / "main.js").write_text(code)
            cmd, preexec = ["node", "--max-old-space-size=256", "main.js"], _limits
        elif language == "cpp":
            (d / "main.cpp").write_text(code)
            compile_cmd, cmd = ["g++", "-O2", "-std=c++17", "-o", "main", "main.cpp"], ["./main"]
        else:
            (d / "Main.java").write_text(code)
            compile_cmd, cmd, preexec = ["javac", "Main.java"], ["java", "-Xmx256m", "-Xss64m", "-cp", ".", "Main"], _limits
        if compile_cmd:
            try:
                c = subprocess.run(compile_cmd, cwd=d, capture_output=True, text=True, timeout=30, env=_ENV)
            except subprocess.TimeoutExpired:
                return [{"passed": False, "status": "Compilation timed out", "stdout": "", "stderr": "", "ms": 0} for _ in tests]
            if c.returncode != 0:
                return [{"passed": False, "status": "Compilation error", "stdout": "", "stderr": c.stderr[:4000], "ms": 0} for _ in tests]
        results = []
        for stdin, expected in tests:
            import time
            t0 = time.monotonic()
            try:
                p = subprocess.run(cmd, cwd=d, input=stdin, capture_output=True, text=True, timeout=WALL_SECONDS, env=_ENV, preexec_fn=preexec)
                ms = int((time.monotonic() - t0) * 1000)
                out = p.stdout[:MAX_OUTPUT]
                if p.returncode != 0:
                    status = "Time limit exceeded" if p.returncode in (-9, -24, 137, 152) else "Runtime error"
                    results.append({"passed": False, "status": status, "stdout": out, "stderr": p.stderr[-4000:], "ms": ms})
                else:
                    ok = _same(out, expected)
                    results.append({"passed": ok, "status": "Passed" if ok else "Wrong answer", "stdout": out, "stderr": p.stderr[-2000:], "ms": ms})
            except subprocess.TimeoutExpired:
                results.append({"passed": False, "status": "Time limit exceeded", "stdout": "", "stderr": "", "ms": WALL_SECONDS * 1000})
        return results
