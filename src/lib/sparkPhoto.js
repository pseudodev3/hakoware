export const prepareSparkPhoto = async file => {
  if (!file || !/^image\//.test(file.type)) throw new Error('Choose a photo');
  if (file.size > 15 * 1024 * 1024) throw new Error('Choose a photo under 15 MB');
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const value = new Image(); value.onload = () => resolve(value); value.onerror = () => reject(new Error('Could not read that photo')); value.src = url;
    });
    const scale = Math.min(1, 1440 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not prepare that photo');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .86));
    if (!blob || blob.size > 3 * 1024 * 1024) throw new Error('Choose a smaller photo');
    return new File([blob], 'spark.jpg', { type: 'image/jpeg' });
  } finally { URL.revokeObjectURL(url); }
};
