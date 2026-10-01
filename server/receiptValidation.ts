import sharp from 'sharp';

export async function validateReceipt(value: unknown): Promise<string | null> {
  if (typeof value !== 'string' || !value.trim()) {
    return 'برای ثبت سفارش، بارگذاری عکس فیش بانکی الزامی است.';
  }
  if (value.length > 750 * 1024) {
    return 'حجم تصویر فیش بیش از حد مجاز است. لطفاً تصویر کم‌حجم‌تری انتخاب کنید.';
  }
  // New orders must contain an uploaded image, not an arbitrary URL or existing receipt.
  const match = /^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return 'تصویر فیش معتبر نیست. لطفاً عکس فیش را دوباره بارگذاری کنید.';
  const bytes = Buffer.from(match[2], 'base64');
  const valid = match[1] === 'jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : match[1] === 'webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
    : ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6));
  if (!valid) return 'تصویر فیش معتبر نیست. لطفاً عکس فیش را دوباره بارگذاری کنید.';
  try {
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 4_000_000, limitInputChannels: 4 });
    const metadata = await image.metadata();
    if (metadata.format !== match[1] || (metadata.width || 0) < 128 || (metadata.height || 0) < 128 || (metadata.pages || 1) !== 1) throw new Error('Invalid receipt image');
    // Decoding, rather than metadata/signature alone, rejects truncated pixel data.
    await image.timeout({ seconds: 3 }).raw().toBuffer();
  } catch {
    return 'تصویر فیش ناقص یا نامعتبر است. لطفاً یک عکس سالم با ابعاد کوچک‌تر بارگذاری کنید.';
  }
  return null;
}
