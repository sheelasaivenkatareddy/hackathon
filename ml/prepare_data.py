"""
Build the Patra Lens tomato dataset from PlantVillage (lab photos) and PlantDoc (field photos).

  python prepare_data.py --out data                  # downloads both datasets with git (tomato only)
  python prepare_data.py --out data --pv-dir PV --pdoc-dir PD   # use copies you already have

Output (symlinks by default, --copy to copy files):
  data/train/<class>/      PlantVillage 70% (split by leaf, so photos of one leaf stay together)
                           + PlantDoc train 85%
  data/val/<class>/        PlantVillage 15% + PlantDoc train 15%   (used for early stopping and calibration)
  data/test_lab/<class>/   PlantVillage 15%                          (lab-photo test)
  data/test_field/<class>/ PlantDoc test                             (field-photo test, the one that matters)
  data/manifest.csv        path, split, class, source, group

File names start with "pv__" or "pdoc__" so the trainer knows where each photo came from.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import shutil
import subprocess
import sys
from collections import Counter
from pathlib import Path

CLASSES = [  # PlantVillage tomato folders, in sorted order (same order as torchvision ImageFolder)
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___healthy",
]
PLANTDOC_TO_PV = {  # PlantDoc has no Target spot class
    "Tomato leaf bacterial spot": "Tomato___Bacterial_spot",
    "Tomato Early blight leaf": "Tomato___Early_blight",
    "Tomato leaf late blight": "Tomato___Late_blight",
    "Tomato mold leaf": "Tomato___Leaf_Mold",
    "Tomato Septoria leaf spot": "Tomato___Septoria_leaf_spot",
    "Tomato two spotted spider mites leaf": "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato leaf yellow virus": "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato leaf mosaic virus": "Tomato___Tomato_mosaic_virus",
    "Tomato leaf": "Tomato___healthy",
}
IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def run(cmd, cwd=None):
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=cwd, check=True)


def fetch_plantvillage(dest: Path) -> Path:
    if not (dest / ".git").exists():
        run(["git", "clone", "--depth", "1", "--filter=blob:none", "--sparse",
             "https://github.com/spMohanty/PlantVillage-Dataset", str(dest)])
        run(["git", "sparse-checkout", "set", "--no-cone", "/raw/color/Tomato___*", "/leaf-map.json"], cwd=dest)
    return dest


def fetch_plantdoc(dest: Path) -> Path:
    if not (dest / ".git").exists():
        run(["git", "clone", "--depth", "1", "--filter=blob:none", "--sparse",
             "https://github.com/pratikkayal/PlantDoc-Dataset", str(dest)])
        run(["git", "sparse-checkout", "set", "--no-cone", "/train/Tomato*", "/test/Tomato*", "/LICENSE.txt"], cwd=dest)
    return dest


def bucket(key: str) -> float:
    """Stable number in [0, 1) from a string."""
    return int(hashlib.md5(key.encode("utf-8")).hexdigest()[:8], 16) / 0x100000000


def pv_group(cls: str, fname: str, leafmap: dict) -> str:
    stem = fname.rsplit(".", 1)[0]
    key = stem.split("___", 1)[1].lower() if "___" in stem else stem.lower()
    for v in leafmap.get(key, []):
        c, gid = v.split(":::")
        if c == cls:
            return f"{c}:::{gid}"
    return f"{cls}:::file:{key}"


def images(folder: Path):
    return sorted(p for p in folder.iterdir() if p.suffix.lower() in IMG_EXT) if folder.exists() else []


def place(src: Path, out: Path, split: str, cls: str, name: str, copy: bool) -> Path:
    d = out / split / cls
    d.mkdir(parents=True, exist_ok=True)
    dst = d / name
    if dst.exists() or dst.is_symlink():
        dst.unlink()
    if copy:
        shutil.copy2(src, dst)
    else:
        os.symlink(src.resolve(), dst)
    return dst


def safe(name: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in name)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="data")
    ap.add_argument("--pv-dir", help="existing PlantVillage repo folder (with raw/color/Tomato___*)")
    ap.add_argument("--pdoc-dir", help="existing PlantDoc repo folder (with train/ and test/)")
    ap.add_argument("--cache", default="sources", help="where to clone the datasets")
    ap.add_argument("--max-per-class", type=int, default=0, help="limit PlantVillage photos per class (0 = all)")
    ap.add_argument("--copy", action="store_true", help="copy files instead of symlinks")
    args = ap.parse_args(argv)

    out, cache = Path(args.out), Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    pv = Path(args.pv_dir) if args.pv_dir else fetch_plantvillage(cache / "PlantVillage-Dataset")
    pdoc = Path(args.pdoc_dir) if args.pdoc_dir else fetch_plantdoc(cache / "PlantDoc-Dataset")
    if out.exists():
        shutil.rmtree(out)
    rows, counts = [], Counter()

    leafmap_path = pv / "leaf-map.json"
    leafmap = json.loads(leafmap_path.read_text()) if leafmap_path.exists() else {}
    if not leafmap:
        print("! leaf-map.json not found: PlantVillage is split by file, so photos of one leaf may be in both "
              "train and test. Results on test_lab will look better than they are.", file=sys.stderr)

    for cls in CLASSES:
        files = images(pv / "raw" / "color" / cls)
        if args.max_per_class:
            files = sorted(files, key=lambda p: bucket(p.name))[: args.max_per_class]
        for p in files:
            g = pv_group(cls, p.name, leafmap)
            b = bucket(g)
            split = "train" if b < 0.70 else "val" if b < 0.85 else "test_lab"
            dst = place(p, out, split, cls, "pv__" + safe(p.name), args.copy)
            rows.append([str(dst), split, cls, "plantvillage", g]); counts[(split, "pv")] += 1

    for pd_split in ("train", "test"):
        for pd_cls, cls in PLANTDOC_TO_PV.items():
            for p in images(pdoc / pd_split / pd_cls):
                if pd_split == "test":
                    split = "test_field"
                else:
                    split = "train" if bucket("pd:" + p.name) < 0.85 else "val"
                dst = place(p, out, split, cls, "pdoc__" + safe(p.name), args.copy)
                rows.append([str(dst), split, cls, "plantdoc", "pd:" + p.name]); counts[(split, "pdoc")] += 1

    out.mkdir(parents=True, exist_ok=True)
    with open(out / "manifest.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["path", "split", "class", "source", "group"])
        w.writerows(rows)
    (out / "labels.json").write_text(json.dumps(CLASSES, indent=1))
    print("\nPhotos per split:")
    for split in ("train", "val", "test_lab", "test_field"):
        print(f"  {split:10s} PlantVillage {counts[(split, 'pv')]:6d}   PlantDoc {counts[(split, 'pdoc')]:5d}")
    missing = [c for c in CLASSES if not (out / "train" / c).exists()]
    if missing:
        print("! no training photos for:", ", ".join(missing), file=sys.stderr)
    print(f"\nDone. Manifest: {out / 'manifest.csv'}")


if __name__ == "__main__":
    main()
