export type BrowserImageAnalysis = {
  summary: string[];
  recommendations: string[];
  width: number;
  height: number;
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
};

export async function analyzeImageInBrowser(file: File): Promise<BrowserImageAnalysis> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Image analysis is not supported by this browser.");
    context.drawImage(bitmap, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    let luminanceSum = 0, luminanceSquareSum = 0, saturationSum = 0;
    let edgeSum = 0, edgeSquareSum = 0, edgeCount = 0;
    const gray = new Float32Array(width * height);
    for (let i = 0, pixel = 0; i < data.length; i += 4, pixel++) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      gray[pixel] = y;
      luminanceSum += y;
      luminanceSquareSum += y * y;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      saturationSum += max === 0 ? 0 : (max - min) / max * 255;
    }
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const laplacian = gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i];
      edgeSum += laplacian;
      edgeSquareSum += laplacian * laplacian;
      edgeCount++;
    }
    const count = Math.max(1, width * height);
    const brightness = luminanceSum / count;
    const contrast = Math.sqrt(Math.max(0, luminanceSquareSum / count - brightness * brightness));
    const saturation = saturationSum / count;
    const sharpness = edgeCount ? Math.max(0, edgeSquareSum / edgeCount - (edgeSum / edgeCount) ** 2) : 0;
    const orientation = width / height > 1.05 ? "landscape" : width / height < 0.95 ? "portrait" : "square";
    const exposure = brightness < 75 ? "underexposed" : brightness > 190 ? "overexposed" : "balanced";
    const warmth = (() => {
      let red = 0, blue = 0;
      for (let i = 0; i < data.length; i += 4) { red += data[i]; blue += data[i + 2]; }
      return red - blue > count * 10 ? "warm" : blue - red > count * 10 ? "cool" : "neutral";
    })();
    const recommendations: string[] = [];
    if (sharpness < 90) recommendations.push("Use a sharper, in-focus image if fine detail matters.");
    if (exposure !== "balanced") recommendations.push("Review exposure before using this image as a lighting reference.");
    if (contrast < 25) recommendations.push("Check whether the reference intentionally uses soft, low-contrast lighting.");
    if (!recommendations.length) recommendations.push("No major issue was found by these basic technical checks.");
    return {
      summary: [
        `${orientation[0].toUpperCase() + orientation.slice(1)} image · ${bitmap.width} × ${bitmap.height}.`,
        `${exposure[0].toUpperCase() + exposure.slice(1)} exposure with ${contrast.toFixed(1)} contrast.`,
        `${warmth[0].toUpperCase() + warmth.slice(1)} color cast with ${saturation < 55 ? "muted" : saturation < 115 ? "moderate" : "vivid"} saturation.`,
        `Estimated sharpness score: ${sharpness.toFixed(0)} (browser-side technical estimate).`,
      ],
      recommendations, width: bitmap.width, height: bitmap.height,
      brightness: Number(brightness.toFixed(2)), contrast: Number(contrast.toFixed(2)),
      saturation: Number(saturation.toFixed(2)), sharpness: Number(sharpness.toFixed(2)),
    };
  } finally { bitmap.close(); }
}
