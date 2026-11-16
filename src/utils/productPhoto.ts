// Turns a photo picked in the admin panel into a compact JPEG that is sent with the
// product form; the server then moves it to Object Storage and keeps a permanent address.

export const PHOTO_MAX_SIDE = 1600;
// Eight photos of this size still fit in one save request (4 MB including base64 overhead).
export const PHOTO_MAX_BYTES = 320 * 1024;

export function fitWithin(width: number, height: number, maxSide = PHOTO_MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// Size in bytes of the image inside a base64 data address.
export function dataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor(base64.length * 3 / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
}

export function isUploadedPhoto(image: string) {
  return image.startsWith('data:image/');
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('این فایل عکس قابل خواندن نیست.')); };
    image.src = url;
  });
}

export async function fileToProductPhoto(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('فقط فایل عکس انتخاب کنید.');
  const image = await loadImage(file);
  let side = PHOTO_MAX_SIDE;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { width, height } = fitWithin(image.naturalWidth, image.naturalHeight, side);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('مرورگر نتوانست عکس را آماده کند.');
    // Photos with a transparent background get a white one, as JPEG has no transparency.
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    for (const quality of [0.86, 0.76, 0.66]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrlBytes(dataUrl) <= PHOTO_MAX_BYTES) return dataUrl;
    }
    side = Math.round(side * 0.8);
  }
  throw new Error('این عکس بیش از حد بزرگ است.');
}
