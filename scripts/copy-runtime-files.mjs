// Copies the big runtime files into public/ so Vite serves them and the PWA can cache them.
//   public/opencv/opencv.js                     (OpenCV.js, about 10 MB, used for photo alignment)
//   public/ort/ort-wasm-simd-threaded.{mjs,wasm} (ONNX Runtime Web, about 11 MB, runs the model)
// Add to package.json:  "postinstall": "node scripts/copy-runtime-files.mjs"
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkgDir = (name) => path.join(root, "node_modules", ...name.split("/"));

function copy(src, destDir) {
  if (!fs.existsSync(src)) { console.warn(`! missing ${path.relative(root, src)} (is the package installed?)`); return; }
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, path.basename(src));
  fs.copyFileSync(src, dest);
  console.log(`copied ${path.relative(root, src)} -> ${path.relative(root, dest)}`);
}

copy(path.join(pkgDir("@techstark/opencv-js"), "dist", "opencv.js"), path.join(root, "public", "opencv"));
for (const f of ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
  copy(path.join(pkgDir("onnxruntime-web"), "dist", f), path.join(root, "public", "ort"));
}
