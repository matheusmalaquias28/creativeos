async function fetchImageAsPngBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  const blob = await res.blob();

  if (blob.type === "image/png") return blob;

  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Conversion failed"))), "image/png");
  });
}

function clipboardItemForPng(blob: Blob) {
  return new ClipboardItem({
    "image/png": Promise.resolve(blob),
  });
}

export async function copyPngBlobToClipboard(blob: Blob) {
  await navigator.clipboard.write([clipboardItemForPng(blob)]);
}

export async function fetchImagesAsPngBlobs(urls: string[]): Promise<Blob[]> {
  return Promise.all(urls.map((url) => fetchImageAsPngBlob(url)));
}

export async function copyImageToClipboard(url: string) {
  const imageBlob = await fetchImageAsPngBlob(url);
  await copyPngBlobToClipboard(imageBlob);
}

export type CopyAllImage = {
  url: string;
  filename: string;
};
