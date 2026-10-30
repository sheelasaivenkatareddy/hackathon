// Lazy-load OpenCV.js (about 10 MB) from /public/opencv/opencv.js, only when a comparison is needed.
// Copy node_modules/@techstark/opencv-js/dist/opencv.js to public/opencv/opencv.js (see package.json "postinstall").
//
// IMPORTANT: the OpenCV.js module object has a .then() method. Never `await cv`, never `return cv` from an
// async function and never resolve a Promise with it: the Promise keeps unwrapping it and hangs forever.
// That is why this returns { cv } (an object that holds it).

let loading: Promise<{ cv: any }> | null = null;

export function loadOpenCv(src = "/opencv/opencv.js"): Promise<{ cv: any }> {
  if (loading) return loading;
  loading = new Promise<{ cv: any }>((resolve, reject) => {
    const w = window as any;
    // An element with id="cv" would also appear as window.cv, so check it is really OpenCV.
    const isCv = (c: any) => !!c && !(typeof Element !== "undefined" && c instanceof Element) &&
      (!!c.Mat || typeof c.then === "function" || "onRuntimeInitialized" in c || "HEAPU8" in c);
    const done = () => resolve({ cv: w.cv });
    const waitReady = () => {
      const cv = w.cv;
      if (!isCv(cv)) { loading = null; reject(new Error("OpenCV.js did not load")); return; }
      if (cv.Mat) { done(); return; }
      if (typeof cv.then === "function") { cv.then(() => done()); return; }
      cv.onRuntimeInitialized = done;
    };
    if (isCv(w.cv)) { waitReady(); return; }
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = waitReady;
    s.onerror = () => { loading = null; reject(new Error("Could not load OpenCV.js")); };
    document.head.appendChild(s);
  });
  return loading;
}
