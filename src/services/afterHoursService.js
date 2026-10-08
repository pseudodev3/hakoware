import { api } from '../lib/api';

export const getAfterHours = async ({ activityId = null } = {}) => api.get(`/after-hours${activityId ? '?activity=' + encodeURIComponent(activityId) : ''}`);

export const getAfterHoursReplies = (activityId, { before = null } = {}) => api.get(`/after-hours/feed/${encodeURIComponent(activityId)}/replies${before ? '?before=' + encodeURIComponent(before) : ''}`);

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


export const createAfterHoursPost = ({ type = 'SHOUT', text = '', anonymous = false, burnAmount = 0 } = {}) => (
  api.post('/after-hours/post', { type, text, anonymous, burnAmount })
);

export const replyAfterHours = (activityId, text, clientId) => (
  api.post(`/after-hours/feed/${activityId}/reply`, { text, clientId })
);

export const voteAfterHours = (activityId, vote) => (
  api.post(`/after-hours/feed/${activityId}/vote`, { vote })
);

export const sparkAfterHours = (activityId) => (
  api.post(`/after-hours/feed/${activityId}/spark`)
);

export const leaveAfterHoursNote = (username, text) => (
  api.post('/after-hours/note', { username, text })
);
