"""Resume parsing and the ATS-style score.

The score is computed by rules in this file, never by an AI model, so the same
resume always gets the same score and every point can be explained.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

# Skills that fresher SDE job posts ask for, grouped so breadth can be measured.
SKILL_GROUPS: dict[str, list[str]] = {
    "Languages": ["python", "java", "c++", "c", "javascript", "typescript", "go", "golang", "kotlin", "rust", "c#", "sql"],
    "Frontend": ["react", "next.js", "angular", "vue", "html", "css", "tailwind", "redux"],
    "Backend": ["node.js", "express", "django", "flask", "fastapi", "spring boot", "spring", "rest api", "graphql", "microservices"],
    "Databases": ["mysql", "postgresql", "mongodb", "redis", "sqlite", "firebase", "dynamodb"],
    "Cloud and DevOps": ["aws", "azure", "gcp", "docker", "kubernetes", "ci/cd", "linux", "nginx", "jenkins"],
    "Tools": ["git", "github", "postman", "jira"],
    "CS fundamentals": ["data structures", "algorithms", "operating systems", "dbms", "computer networks", "oop", "system design"],
    "Other": ["machine learning", "tensorflow", "pytorch", "kafka", "websockets", "jwt", "oauth", "android", "flutter", "react native"],
}
ALIASES = {
    "nodejs": "node.js", "node": "node.js", "reactjs": "react", "react.js": "react", "nextjs": "next.js",
    "postgres": "postgresql", "mongo": "mongodb", "js": "javascript", "ts": "typescript", "k8s": "kubernetes",
    "springboot": "spring boot", "expressjs": "express", "express.js": "express", "restful": "rest api", "rest apis": "rest api",
    "rest": "rest api", "object oriented programming": "oop", "object-oriented programming": "oop", "oops": "oop",
    "dsa": "data structures", "os": "operating systems", "cn": "computer networks", "tailwindcss": "tailwind",
    "amazon web services": "aws", "google cloud": "gcp", "vue.js": "vue", "socket.io": "websockets", "cicd": "ci/cd",
    "database management": "dbms", "ml": "machine learning", "cpp": "c++", "golang": "go",
}
ALL_SKILLS = sorted({s for g in SKILL_GROUPS.values() for s in g}, key=len, reverse=True)

SECTION_PATTERNS = {
    "education": r"education|academic",
    "skills": r"skills|technical skills|technologies|tech stack",
    "projects": r"projects?",
    "experience": r"experience|internships?|work history|employment",
    "achievements": r"achievements?|awards|certifications?|accomplishments",
}
ACTION_VERBS = {
    "built", "developed", "designed", "implemented", "created", "led", "optimized", "optimised", "reduced",
    "improved", "increased", "automated", "deployed", "integrated", "migrated", "architected", "engineered",
    "launched", "shipped", "refactored", "analyzed", "analysed", "collaborated", "delivered", "achieved",
    "scaled", "wrote", "tested", "debugged", "maintained", "contributed", "managed", "trained", "published",
    "won", "secured", "solved", "researched", "configured", "containerized", "containerised", "cut", "added",
}
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b|\+\d{1,3}[\s-]?\d{6,12}")
URL_RE = re.compile(r"(?:https?://)?(?:www\.)?(github\.com|linkedin\.com|leetcode\.com|codeforces\.com|codechef\.com)/[^\s,|)>\]]+", re.I)
NUMBER_RE = re.compile(r"\d+(?:\.\d+)?\s*(?:%|x\b|ms\b|k\b|\+|users|requests|seconds|hours|students|projects)|\b\d{2,}\b", re.I)
BULLET_RE = re.compile(r"^\s*(?:[•●▪◦‣\-–*∙·■◆➢➤\x7f\uf0b7\uf0a7\uf0d8]|\d+[.)])\s+(.*)")


class ResumeError(ValueError):
    pass


def extract_pdf(path: Path) -> dict:
    """Parse the PDF in a separate process with CPU, memory and time limits."""
    try:
        out = subprocess.run(
            [sys.executable, "-I", str(Path(__file__).with_name("pdf_extract.py")), str(path)],
            capture_output=True, text=True, timeout=15, env={},
        )
        data = json.loads(out.stdout.strip().splitlines()[-1])
    except Exception as exc:  # timeout, crash, bad output
        raise ResumeError("We could not read this PDF. Export it again as a text PDF and retry.") from exc
    if data.get("error") == "encrypted":
        raise ResumeError("This PDF is password-protected. Upload one without a password.")
    return data


def _norm_skill(token: str) -> str | None:
    t = token.strip().lower().strip(".")
    t = ALIASES.get(t, t)
    return t if t in ALL_SKILLS else None


def find_skills(text: str) -> list[str]:
    low = " " + re.sub(r"\s+", " ", text.lower()) + " "
    found = set()
    for name in list(ALIASES) + ALL_SKILLS:
        if re.search(r"(?<![a-z0-9+#.])" + re.escape(name) + r"(?![a-z0-9+#])", low):
            canon = _norm_skill(name)
            if canon:
                found.add(canon)
    # "c" and "go" are too ambiguous as plain words; require list-like context.
    for amb in ("c", "go"):
        if amb in found and not re.search(r"[,:/|(]\s*" + amb + r"\s*(?:[,/|)]|$)", low):
            found.discard(amb)
    return sorted(found)


def split_sections(lines: list[str]) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {"header": []}
    current = "header"
    for line in lines:
        stripped = line.strip()
        head = re.sub(r"[^a-z &]", "", stripped.lower()).strip()
        matched = None
        if 0 < len(stripped) <= 40 and len(stripped.split()) <= 4:
            for key, pat in SECTION_PATTERNS.items():
                if re.fullmatch(r"(?:" + pat + r")(?: (?:&|and) .*)?| ?(?:technical |work |professional |academic )?(?:" + pat + ")", head):
                    matched = key
                    break
        if matched:
            current = matched
            sections.setdefault(current, [])
        else:
            sections.setdefault(current, []).append(line)
    return sections


def _bullets(lines: list[str]) -> list[str]:
    out, cur = [], None
    for line in lines:
        m = BULLET_RE.match(line)
        if m:
            if cur:
                out.append(cur)
            cur = m.group(1).strip()
        elif cur and line.strip() and not line[0:1].isupper():
            cur += " " + line.strip()
        elif cur:
            out.append(cur)
            cur = None
    if cur:
        out.append(cur)
    return [b for b in out if len(b) > 12]


def _projects(lines: list[str]) -> list[dict]:
    """Group a projects/experience section into titled items with their bullets."""
    items, cur = [], None
    for line in lines:
        s = line.strip()
        if not s:
            continue
        if BULLET_RE.match(line):
            if cur is None:
                cur = {"title": "Project", "bullets": []}
            cur["bullets"].append(BULLET_RE.match(line).group(1).strip())
        elif len(s) <= 110 and cur is not None and not cur["bullets"] and len(cur["title"]) < 60:
            cur["title"] += " " + s
        elif len(s) <= 110:
            if cur:
                items.append(cur)
            cur = {"title": s, "bullets": []}
        elif cur and cur["bullets"]:
            cur["bullets"][-1] += " " + s
    if cur:
        items.append(cur)
    for it in items:
        it["skills"] = find_skills(it["title"] + " " + " ".join(it["bullets"]))
        it["title"] = re.split(r"\s[|–—]\s|\s{3,}", it["title"])[0].strip(" :-")[:80]
    return [it for it in items if it["bullets"] or it["skills"]][:8]


def parse_resume(raw: dict) -> dict:
    text = raw.get("text", "")
    lines = [ln.rstrip() for ln in text.splitlines()]
    nonblank = [ln for ln in lines if ln.strip()]
    sections = split_sections(lines)
    links = set(raw.get("links", []))
    for m in URL_RE.finditer(text):
        links.add(m.group(0))
    links_l = [u.lower() for u in links]
    email = EMAIL_RE.search(text)
    phone = PHONE_RE.search(text)
    body_sections = {k: v for k, v in sections.items() if k != "header"}
    all_bullets = _bullets(lines)
    return {
        "pages": raw.get("pages", 1),
        "images": raw.get("images", 0),
        "chars": len(text.strip()),
        "words": len(text.split()),
        "name_line": nonblank[0].strip()[:80] if nonblank else "",
        "email": email.group(0) if email else "",
        "phone": phone.group(0) if phone else "",
        "has_github": any("github.com" in u for u in links_l),
        "has_linkedin": any("linkedin.com" in u for u in links_l),
        "has_coding_profile": any(d in u for u in links_l for d in ("leetcode", "codeforces", "codechef")),
        "sections": sorted(body_sections),
        "skills": find_skills(text),
        "projects": _projects(sections.get("projects", [])),
        "experience": _projects(sections.get("experience", [])),
        "bullets": all_bullets[:60],
        "long_lines": sum(1 for ln in nonblank if len(ln) > 220),
        "date_styles": sorted({
            style for style, pat in {
                "Mon YYYY": r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? \d{4}\b",
                "MM/YYYY": r"\b\d{1,2}/\d{4}\b",
                "YYYY only": r"(?<![/\w] )\b(?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2}|present)\b",
            }.items() if re.search(pat, text, re.I)
        }),
    }


def _check(key, label, weight, ratio, detail) -> dict:
    ratio = max(0.0, min(1.0, ratio))
    return {"key": key, "label": label, "weight": weight, "points": round(weight * ratio), "detail": detail}


def score_resume(p: dict) -> tuple[int, list[dict], list[dict]]:
    """Returns (score out of 100, per-check breakdown, list of fixes)."""
    fixes: list[dict] = []
    checks: list[dict] = []

    # 1. Parseability (20)
    r = 1.0
    notes = []
    if p["chars"] < 400:
        r = 0.1
        notes.append("almost no text could be extracted")
        fixes.append({"check": "parse", "title": "Your resume is not readable as text",
                      "detail": "It looks like an image or scan. Export it from Word, Google Docs or LaTeX as a text PDF so tracking systems can read it."})
    else:
        if p["images"] > 2:
            r -= 0.25
            notes.append(f"{p['images']} images found")
            fixes.append({"check": "parse", "title": "Remove images and icons",
                          "detail": "Tracking systems skip anything inside an image. Keep photos, logos and skill icons out of the resume."})
        words_per_page = p["words"] / max(1, p["pages"])
        if words_per_page < 150:
            r -= 0.3
            notes.append("very little text per page")
        if not p["bullets"]:
            r -= 0.2
            notes.append("no bullet points detected, which usually means a table or column layout")
            fixes.append({"check": "parse", "title": "Use a single-column layout with plain bullets",
                          "detail": "Tables and multi-column templates often scramble the reading order. Use one column and simple bullet points."})
    checks.append(_check("parse", "Parseability", 20, r, "; ".join(notes) or "Text extracts cleanly."))

    # 2. Standard sections (15)
    needed = ["education", "skills", "projects", "experience"]
    have = [s for s in needed if s in p["sections"]]
    has_contact = bool(p["email"])
    r = (len(have) + (1 if has_contact else 0)) / 5
    missing = [s for s in needed if s not in have]
    if missing:
        fixes.append({"check": "sections", "title": "Add a clearly labelled " + " and ".join(m.title() for m in missing) + " section",
                      "detail": "Use the plain heading words (Education, Skills, Projects, Experience). Internships and open-source work count as experience."})
    checks.append(_check("sections", "Standard sections", 15, r,
                         "Found: " + (", ".join(s.title() for s in have) or "none") + ("" if not missing else ". Missing: " + ", ".join(m.title() for m in missing))))

    # 3. SDE keywords (25): count plus breadth across groups
    skills = p["skills"]
    groups_hit = [g for g, items in SKILL_GROUPS.items() if g != "Other" and any(s in skills for s in items)]
    r = 0.6 * min(1.0, len(skills) / 12) + 0.4 * min(1.0, len(groups_hit) / 5)
    weak_groups = [g for g in ("Languages", "Backend", "Databases", "Tools", "CS fundamentals", "Cloud and DevOps") if g not in groups_hit]
    if r < 0.85 and weak_groups:
        fixes.append({"check": "keywords", "title": "Name the skills job posts search for",
                      "detail": "Nothing found under " + ", ".join(weak_groups[:3]) + ". Add only skills you can explain; the interviewer will ask about every one you list."})
    checks.append(_check("keywords", "SDE keywords", 25, r, f"{len(skills)} recognised skills across {len(groups_hit)} of 7 areas."))

    # 4. Impact (20): action verbs + measurable results
    bullets = p["bullets"]
    if bullets:
        verb = sum(1 for b in bullets if re.sub(r"[^a-z]", "", b.split()[0].lower()) in ACTION_VERBS)
        nums = sum(1 for b in bullets if NUMBER_RE.search(b))
        r = 0.45 * min(1.0, verb / (0.7 * len(bullets))) + 0.55 * min(1.0, nums / (0.4 * len(bullets)))
        detail = f"{verb} of {len(bullets)} bullets start with an action verb; {nums} include a number or result."
        if nums < 0.4 * len(bullets):
            weak = next((b for b in bullets if not NUMBER_RE.search(b)), bullets[0])
            fixes.append({"check": "impact", "title": "Add a measurable result to your bullets",
                          "detail": f"For example, this bullet has no number: “{weak[:110]}”. Say what changed: users served, time saved, accuracy, response time."})
        if verb < 0.7 * len(bullets):
            weak = next((b for b in bullets if re.sub(r"[^a-z]", "", b.split()[0].lower()) not in ACTION_VERBS), bullets[0])
            fixes.append({"check": "impact", "title": "Start bullets with an action verb",
                          "detail": f"“{weak[:90]}” would read stronger starting with Built, Designed, Reduced or Implemented."})
    else:
        r, detail = 0.0, "No bullet points found to assess."
    checks.append(_check("impact", "Impact", 20, r, detail))

    # 5. Clarity and length (10)
    r = 1.0
    notes = []
    if p["pages"] > 1:
        r -= 0.4
        notes.append(f"{p['pages']} pages")
        fixes.append({"check": "clarity", "title": "Cut it to one page",
                      "detail": "Recruiters spend seconds on a fresher resume. Drop school-level details and older, weaker projects."})
    long_bullets = [b for b in bullets if len(b) > 210]
    if long_bullets or p["long_lines"]:
        r -= 0.3
        notes.append("some bullets run long")
        fixes.append({"check": "clarity", "title": "Shorten long bullets",
                      "detail": "Keep each bullet to one or two lines: what you did, how, and the result."})
    if len(p["date_styles"]) > 1:
        r -= 0.2
        notes.append("mixed date formats (" + ", ".join(p["date_styles"]) + ")")
        fixes.append({"check": "clarity", "title": "Use one date format",
                      "detail": "Pick one style, such as “Jun 2025 – Aug 2025”, and use it everywhere."})
    if p["words"] < 180:
        r -= 0.3
        notes.append("too little content")
    checks.append(_check("clarity", "Clarity and length", 10, r, "; ".join(notes).capitalize() or "One page, short bullets, consistent dates."))

    # 6. Links (10)
    parts = {"email": bool(p["email"]), "phone": bool(p["phone"]), "GitHub": p["has_github"], "LinkedIn": p["has_linkedin"]}
    r = sum(parts.values()) / 4
    missing_l = [k for k, v in parts.items() if not v]
    if missing_l:
        fixes.append({"check": "links", "title": "Add your " + ", ".join(missing_l),
                      "detail": "Put them in the header as full, clickable links so a recruiter can reach your work in one click."})
    checks.append(_check("links", "Links", 10, r, "Missing: " + ", ".join(missing_l) + "." if missing_l else "Email, phone, GitHub and LinkedIn present."))

    total = sum(c["points"] for c in checks)
    # Biggest point losses first.
    order = {c["key"]: c["weight"] - c["points"] for c in checks}
    fixes.sort(key=lambda f: -order.get(f["check"], 0))
    return total, checks, fixes[:6]


def redact_for_llm(parsed: dict) -> dict:
    """What an AI provider may see: skills and project text only, no name, email, phone or links."""
    def clean(s: str) -> str:
        s = EMAIL_RE.sub("[email]", s)
        s = PHONE_RE.sub("[phone]", s)
        return URL_RE.sub("[link]", s)

    return {
        "skills": parsed.get("skills", []),
        "projects": [{"title": clean(p["title"]), "bullets": [clean(b) for b in p["bullets"][:4]]} for p in parsed.get("projects", [])[:4]],
        "experience": [{"title": clean(p["title"]), "bullets": [clean(b) for b in p["bullets"][:4]]} for p in parsed.get("experience", [])[:3]],
    }
