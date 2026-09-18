import { api } from './api';

const recordShare = async (source, method) => {
  try {
    await api.post('/growth/share', { source, method });
  } catch (error) {
    console.warn('Could not record share:', error.message);
  }
};

const fallbackText = (text, url) => [text, url].filter(Boolean).join('\n');

export const shareHakoware = async ({
  source = 'GENERAL',
  title = 'Hakoware',
  text = '',
  url = typeof window !== 'undefined' ? window.location.origin : '',
  files = []
} = {}) => {
  const usableFiles = Array.isArray(files) && files.length > 0 && navigator.canShare?.({ files })
    ? files
    : [];

  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text,
        ...(url ? { url } : {}),
        ...(usableFiles.length ? { files: usableFiles } : {})
      });
      const method = usableFiles.length ? 'NATIVE_FILES' : 'NATIVE';
      await recordShare(source, method);
      return { success: true, method };
    } catch (error) {
      if (error?.name === 'AbortError') return { success: false, cancelled: true };
    }
  }

  try {
    await navigator.clipboard.writeText(fallbackText(text, url));
    await recordShare(source, 'CLIPBOARD');
    return { success: true, method: 'CLIPBOARD' };
  } catch (error) {
    return { success: false, error: error.message || 'Could not share' };
  }
};
