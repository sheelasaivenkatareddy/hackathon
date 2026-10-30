/** RGBA pixels, like the browser's ImageData. */
export interface RGBAImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array; // length = width * height * 4
}

/** 0/1 mask, row-major, same size as the image it came from. */
export interface Mask {
  width: number;
  height: number;
  data: Uint8Array;
}

export const newMask = (width: number, height: number): Mask => ({ width, height, data: new Uint8Array(width * height) });

export const countOn = (m: Mask): number => {
  let n = 0;
  for (let i = 0; i < m.data.length; i++) n += m.data[i];
  return n;
};

/** 3x3 matrix in row-major order, mapping older-photo pixels to newer-photo pixels. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];
