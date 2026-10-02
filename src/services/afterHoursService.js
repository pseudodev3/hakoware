import { api } from '../lib/api';

export const getAfterHours = async () => api.get('/after-hours');

export const answerAfterHours = async (roundKey, choice) => (
  api.post('/after-hours/answer', { roundKey, choice })
);

export const shoutAfterHours = async (text) => (
  api.post('/after-hours/shout', { text })
);

export const throwAfterHoursChallenge = async (promptId) => (
  api.post('/after-hours/challenge', { promptId })
);

export const joinAfterHoursChallenge = async (activityId) => (
  api.post(`/after-hours/feed/${activityId}/join`, {})
);

export const reactAfterHours = async (activityId, reaction) => (
  api.post(`/after-hours/feed/${activityId}/react`, { reaction })
);

export const callOutAfterHours = async (username) => (
  api.post('/after-hours/callout', { username })
);
