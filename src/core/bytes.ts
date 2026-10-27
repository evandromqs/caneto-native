export function decodeBase64(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  for (let index = 0; index < clean.length; index += 4) {
    const a = alphabet.indexOf(clean[index]);
    const b = alphabet.indexOf(clean[index + 1]);
    const c = alphabet.indexOf(clean[index + 2]);
    const d = alphabet.indexOf(clean[index + 3]);
    bytes.push((a << 2) | (b >> 4));
    if (clean[index + 2] && clean[index + 2] !== '=') bytes.push(((b & 15) << 4) | (c >> 2));
    if (clean[index + 3] && clean[index + 3] !== '=') bytes.push(((c & 3) << 6) | d);
  }
  return Uint8Array.from(bytes);
}
