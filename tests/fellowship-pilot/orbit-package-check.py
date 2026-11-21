"""Small fixture for the Orbit asset allowlist; never packages private pilot data."""
import contextlib
import hashlib
import importlib.util
import io
import json
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("package_preview", Path(__file__).with_name("package-preview.py"))
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)
expected = {"HGHousesnew.png": "0246e5123023ff51448b85b4b84f21b03fd14846",
            "HGHouses-transparent.png": "0f37a658f3077ee94c362eab0c2608657c6db69d",
            "bg-motion.mp4": "76bd3d404c5db8b4e268df6cf4e2142cf2f0f0b6"}
assets = {}
for name, digest in expected.items():
    data = (ROOT / name).read_bytes()
    assert hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest() == digest, name
    assets[name] = data

with tempfile.TemporaryDirectory(prefix="orbit-package-", dir=ROOT / ".pilot-tmp") as folder:
    fixture = Path(folder)
    (fixture / "corpus").mkdir()
    for name in ["index.html", "app.js", "audio-session.js", "edge-docking.js", "orbit-player.css", "SAVEorbitFloatingPlayer.js", "bullseyeMedia.js", "private-upload.png"]:
        (fixture / name).write_text("fixture", encoding="utf-8")
    for name, data in assets.items():
        (fixture / name).write_bytes(data)
    package.ROOT = fixture
    sys.argv = ["package-preview.py", "--commit", "synthetic-package-check"]
    with contextlib.redirect_stdout(io.StringIO()):
        package.main()
    with zipfile.ZipFile(fixture / ".pilot-tmp/fellowship-iphone-preview.zip") as archive:
        for name, data in assets.items():
            assert archive.read("public/NextPhase/" + name) == data
        assert "public/NextPhase/edge-docking.js" in archive.namelist()
        assert "public/NextPhase/audio-session.js" in archive.namelist()
        assert not any("private-upload.png" in name for name in archive.namelist())
        config = json.loads(archive.read("firebase.json"))
        assert set(config) == {"hosting"}
        assert config["hosting"]["redirects"][0]["destination"] == "/NextPhase/?pilot=firebase"
        assert json.loads(archive.read("REVIEW-BUILD.json"))["commit"] == "synthetic-package-check"
    (fixture / "bg-motion.mp4").unlink()
    try:
        package.main()
    except SystemExit as error:
        assert "bg-motion.mp4" in str(error)
    else:
        raise AssertionError("Missing required media must block packaging")
print("Passed: exact uploaded logo/video hashes and bytes, Orbit runtime inclusion, unrelated-upload exclusion, Hosting-only config and missing-media guard. Fixture cleaned.")
