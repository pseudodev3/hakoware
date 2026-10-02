import { api } from '../lib/api';

export const getAfterHours = async () => api.get('/after-hours');

export const answerAfterHours = async (roundKey, choice) => (
  api.post('/after-hours/answer', { roundKey, choice })
);

export const shoutAfterHours = async (text) => (
  api.post('/after-hours/shout', { text })
);

export const throwAfterHoursChallenge = async ({ promptId = null, text = '' } = {}) => (
  api.post('/after-hours/challenge', { promptId, text })
);

export const joinAfterHoursChallenge = async (activityId, text) => (
  api.post(`/after-hours/feed/${activityId}/join`, { text })
);

export const reactAfterHours = async (activityId, reaction) => (
  api.post(`/after-hours/feed/${activityId}/react`, { reaction })
);

export const tagInAfterHours = async (username) => (
  api.post('/after-hours/callout', { username })
);
