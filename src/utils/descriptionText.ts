// Product descriptions are shown with the line breaks the owner typed (the paragraph uses
// white-space: pre-line). Several empty lines in a row are shown as one empty line.
export function descriptionText(description: string | undefined) {
  return (description || '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
