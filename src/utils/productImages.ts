// Ask the server for a resized copy of the shop's own photos; other URLs are left as-is.
export function sizedImage(src: string, width: number) {
  if (!/^\/(products|media\/products)\//.test(src)) return src;
  return `${src}${src.includes('?') ? '&' : '?'}w=${width}`;
}
