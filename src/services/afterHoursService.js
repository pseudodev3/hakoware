import { api } from '../lib/api';

export const getAfterHours = async () => api.get('/after-hours');

export const answerAfterHours = async (roundKey, choice) => (
  api.post('/after-hours/answer', { roundKey, choice })
);

export const reactAfterHours = async (activityId, reaction) => (
  api.post(`/after-hours/feed/${activityId}/react`, { reaction })
);

export const callOutAfterHours = async (username) => (
  api.post('/after-hours/callout', { username })
);
