const startsWith = (buffer, bytes) => (
  Buffer.isBuffer(buffer) &&
  buffer.length >= bytes.length &&
  bytes.every((value, index) => buffer[index] === value)
);

const asciiAt = (buffer, offset, value) => (
  Buffer.isBuffer(buffer) &&
  buffer.length >= offset + value.length &&
  buffer.subarray(offset, offset + value.length).toString('ascii') === value
);

const isMp3 = (buffer) => (
  startsWith(buffer, [0x49, 0x44, 0x33]) ||
  (Buffer.isBuffer(buffer) && buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
);

const isAacAdts = (buffer) => (
  Buffer.isBuffer(buffer) &&
  buffer.length >= 2 &&
  buffer[0] === 0xff &&
  (buffer[1] & 0xf6) === 0xf0
);

const matchesAudioSignature = (buffer, mime) => {
  const normalized = String(mime || '').toLowerCase().split(';')[0].trim();

  if (normalized === 'audio/webm') {
    return startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3]);
  }

  if (normalized === 'audio/mp4' || normalized === 'audio/x-m4a') {
    return asciiAt(buffer, 4, 'ftyp');
  }

  if (normalized === 'audio/mpeg') {
    return isMp3(buffer);
  }

  if (normalized === 'audio/ogg') {
    return asciiAt(buffer, 0, 'OggS');
  }

  if (normalized === 'audio/wav' || normalized === 'audio/x-wav') {
    return asciiAt(buffer, 0, 'RIFF') && asciiAt(buffer, 8, 'WAVE');
  }

  if (normalized === 'audio/aac') {
    return isAacAdts(buffer);
  }

  return false;
};

module.exports = {
  matchesAudioSignature
};
