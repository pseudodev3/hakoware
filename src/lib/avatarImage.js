const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();

  image.onload = () => {
    URL.revokeObjectURL(url);
    resolve(image);
  };

  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('Could not read that image'));
  };

  image.src = url;
});

export const prepareAvatarImage = async (file) => {
  if (!file) throw new Error('Choose an image first');
  if (file.size > 12 * 1024 * 1024) throw new Error('Choose an image under 12 MB');

  const image = await loadImage(file);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) throw new Error('Could not read that image');

  const side = Math.min(sourceWidth, sourceHeight);
  const sx = Math.floor((sourceWidth - side) / 2);
  const sy = Math.floor((sourceHeight - side) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Could not prepare avatar');

  context.drawImage(image, sx, sy, side, side, 0, 0, 512, 512);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  if (!blob) throw new Error('Could not prepare avatar');

  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
};
