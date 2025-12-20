const path = require("path");
const fs = require("fs/promises");
const sharp = require("sharp");
const { optimize } = require("svgo");

const SOURCE_DIR = path.resolve(__dirname, "..", "public");
const OUTPUT_DIR = path.join(SOURCE_DIR, "optimized");

const MAX_WIDTH = Number.parseInt(process.env.IMG_MAX_WIDTH || "2000", 10);
const QUALITY = Number.parseInt(process.env.IMG_QUALITY || "80", 10);

const RASTER_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const SVG_EXTS = new Set([".svg"]);

const formatKB = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function isSupported(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return RASTER_EXTS.has(ext) || SVG_EXTS.has(ext);
}

async function optimizeRaster(absPath, relPath) {
  const ext = path.extname(relPath).toLowerCase();
  const destPath = path.join(OUTPUT_DIR, relPath);

  await ensureDir(path.dirname(destPath));

  const metadata = await sharp(absPath).metadata();
  let img = sharp(absPath);

  if (metadata.width && metadata.width > MAX_WIDTH) {
    img = img.resize({ width: MAX_WIDTH });
  }

  if (ext === ".png") {
    await img.png({ compressionLevel: 9, palette: true }).toFile(destPath);
  } else if (ext === ".jpg" || ext === ".jpeg") {
    await img.jpeg({ quality: QUALITY, mozjpeg: true }).toFile(destPath);
  } else if (ext === ".webp") {
    await img.webp({ quality: QUALITY }).toFile(destPath);
  } else if (ext === ".avif") {
    await img.avif({ quality: QUALITY }).toFile(destPath);
  } else {
    return;
  }

  const [original, optimized] = await Promise.all([
    fs.stat(absPath),
    fs.stat(destPath),
  ]);

  const savings =
    original.size > 0
      ? (((original.size - optimized.size) / original.size) * 100).toFixed(1)
      : "0";

  console.log(
    `Optimizado ${relPath} (${formatKB(original.size)} -> ${formatKB(
      optimized.size,
    )}, ahorro ${savings}%)`,
  );
}

async function optimizeSvg(absPath, relPath) {
  const destPath = path.join(OUTPUT_DIR, relPath);
  await ensureDir(path.dirname(destPath));

  const svgContent = await fs.readFile(absPath, "utf8");
  const result = optimize(svgContent, {
    path: absPath,
    multipass: true,
  });

  await fs.writeFile(destPath, result.data, "utf8");
  console.log(`Optimizado ${relPath} (SVG)`);
}

async function processDir(baseDir, relBase = "") {
  const currentDir = path.join(baseDir, relBase);
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const relPath = path.join(relBase, entry.name);
    const absPath = path.join(baseDir, relPath);

    if (absPath.startsWith(OUTPUT_DIR)) continue;

    if (entry.isDirectory()) {
      await processDir(baseDir, relPath);
      continue;
    }

    if (!isSupported(entry.name)) continue;

    try {
      if (SVG_EXTS.has(path.extname(entry.name).toLowerCase())) {
        await optimizeSvg(absPath, relPath);
      } else {
        await optimizeRaster(absPath, relPath);
      }
    } catch (err) {
      console.error(`No se pudo optimizar ${relPath}:`, err.message);
    }
  }
}

async function main() {
  console.log("Iniciando optimización de imágenes...");
  console.log(`Origen: ${SOURCE_DIR}`);
  console.log(`Salida: ${OUTPUT_DIR}`);
  await processDir(SOURCE_DIR);
  console.log("Optimización finalizada.");
}

main().catch((err) => {
  console.error("Error durante la optimización:", err);
  process.exit(1);
});


