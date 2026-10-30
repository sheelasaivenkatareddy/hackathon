"""Extract only the image files of the PlantDoc zip, under short safe names. Usage: unpack_plantdoc.py <zip> <out dir>"""
import hashlib
import os
import re
import sys
import zipfile

src, out = sys.argv[1], sys.argv[2]
EXT = {".jpg", ".jpeg", ".png"}
counts = {}
skipped = 0
with zipfile.ZipFile(src) as z:
    for info in z.infolist():
        if info.is_dir():
            continue
        parts = info.filename.replace("\\", "/").split("/")
        # <repo>/<split>/<class>/<file>
        if len(parts) != 4 or parts[1] not in ("train", "test") or ".." in parts:
            continue
        ext = os.path.splitext(parts[3])[1].lower()
        if ext not in EXT:
            skipped += 1
            continue
        cls = re.sub(r"[^A-Za-z0-9 _-]", "", parts[2]).strip()
        data = z.read(info)
        # The name comes from the content, so nothing in the archive can choose the path.
        name = hashlib.sha1(data).hexdigest()[:20] + ext
        folder = os.path.join(out, parts[1], cls)
        os.makedirs(folder, exist_ok=True)
        with open(os.path.join(folder, name), "wb") as f:
            f.write(data)
        counts[(parts[1], cls)] = counts.get((parts[1], cls), 0) + 1
for split in ("train", "test"):
    print(split, sum(v for k, v in counts.items() if k[0] == split))
for (split, cls), n in sorted(counts.items()):
    if split == "test":
        print(f"{counts.get(('train', cls), 0):5d} / {n:3d}  {cls}")
print("skipped non-images:", skipped)
