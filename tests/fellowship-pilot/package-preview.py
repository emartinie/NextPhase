"""Package the existing iPhone Hosting preview without credentials or pilot data."""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()
    output = ROOT / ".pilot-tmp" / "fellowship-iphone-preview.zip"
    output.parent.mkdir(exist_ok=True)
    files = sorted([ROOT / "index.html", *ROOT.glob("*.js"), *ROOT.glob("*.css")])
    # Preserve runtime corpora; original uploaded module binaries remain in Git.
    for path in sorted((ROOT / "corpus").rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT).as_posix()
        if relative.startswith("corpus/reference/"):
            part = path.relative_to(ROOT / "corpus" / "reference").parts
            if len(part) > 1 and part[0] not in {"derived", "ancient-library"}:
                continue
        if any(part.startswith(".") for part in path.relative_to(ROOT).parts):
            continue
        files.append(path)
    config = {"hosting": {
        "public": "public", "ignore": ["**/.*", "**/node_modules/**"],
        "redirects": [{"source": "/", "destination": "/NextPhase/?pilot=firebase&face=fellowship", "type": 302}],
        "headers": [{"source": "**/*.@(html|js|css)", "headers": [{"key": "Cache-Control", "value": "no-cache"}]}],
    }}
    manifest = {"commit": args.commit, "channel": "iphone-pilot", "files": []}
    total = 0
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=4) as archive:
        archive.writestr("firebase.json", json.dumps(config, indent=2) + "\n")
        for path in files:
            relative = path.relative_to(ROOT).as_posix()
            data = path.read_bytes()
            archive.writestr("public/NextPhase/" + relative, data)
            manifest["files"].append({"path": relative, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
            total += len(data)
        archive.writestr("REVIEW-BUILD.json", json.dumps(manifest, indent=2) + "\n")
    print("Preview archive: " + str(output))
    print(f"Runtime files: {len(files)}; source bytes: {total}; archive bytes: {output.stat().st_size}")
    print("No account mappings, web-config files, screenshots, tests or rule deployments are included.")


if __name__ == "__main__":
    main()
