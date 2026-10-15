import { api, API_BASE_URL } from '../lib/api';
import { deleteResource, fetchResource } from '../lib/resourceCache';

const previewKeys = new Set();
export const loadChatLink = context => {
  const key = `chat-link:${context.kind}:${context.messageId}`;
  previewKeys.delete(key); previewKeys.add(key);
  if (previewKeys.size > 256) { const oldest = previewKeys.values().next().value; previewKeys.delete(oldest); deleteResource(oldest); }
  return fetchResource(key, () => api.post('/chat-links/preview', context), { ttl: 600000 });
};

export const loadChatImage = async (context, imageVersion, signal) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/chat-links/image`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) },
    body: JSON.stringify({ ...context, imageVersion }), signal,
  });
  if (!response.ok) throw new Error('Image unavailable');
  const blob = await response.blob();
  if (localStorage.getItem('token') !== token) throw new Error('Session changed');
  return blob;
};
