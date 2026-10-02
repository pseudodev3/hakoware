const IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

const normalizeMime = (value) => String(value || '').toLowerCase().split(';')[0].trim();

const matchesImageSignature = (buffer, mimeValue) => {
  const mime = normalizeMime(mimeValue);
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;

  if (mime === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mime === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (mime === 'image/webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }

  return false;
};

module.exports = {
  IMAGE_TYPES,
  matchesImageSignature,
  normalizeMime
};
