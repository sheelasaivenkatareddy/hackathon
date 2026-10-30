// Makes the PWA icons from public/logo-light.svg on the forest background. Run once: node scripts/make-icons.mjs
import fs from "node:fs";
import sharp from "sharp";

fs.mkdirSync("public/icons", { recursive: true });
for (const size of [192, 512]) {
  const inner = Math.round(size * 0.68);
  const logo = await sharp("public/logo-light.svg", { density: 600 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: "#12372A" } })
    .composite([{ input: logo, gravity: "center" }]).png().toFile(`public/icons/icon-${size}.png`);
}
