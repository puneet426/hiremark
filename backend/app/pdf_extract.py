"""Runs in a separate, resource-limited process: a hostile PDF cannot hang or crash the API."""
import json
import resource
import sys


def main(path: str) -> None:
    resource.setrlimit(resource.RLIMIT_CPU, (8, 8))
    resource.setrlimit(resource.RLIMIT_AS, (768 * 1024 * 1024, 768 * 1024 * 1024))
    from pypdf import PdfReader

    reader = PdfReader(path)
    if reader.is_encrypted:
        print(json.dumps({"error": "encrypted"}))
        return
    pages = len(reader.pages)
    texts, images, links = [], 0, []
    for page in reader.pages[:6]:
        texts.append(page.extract_text() or "")
        try:
            images += len(list(page.images))
        except Exception:
            pass
        for annot in page.get("/Annots") or []:
            try:
                uri = annot.get_object().get("/A", {}).get("/URI")
                if uri:
                    links.append(str(uri)[:300])
            except Exception:
                pass
    print(json.dumps({"pages": pages, "text": "\n".join(texts)[:60000], "images": images, "links": links[:40]}))


if __name__ == "__main__":
    main(sys.argv[1])
