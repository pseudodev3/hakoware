import { api } from '../lib/api';

export const getRoomWall = (week) =>
  api.get(
    '/after-hours/wall' + (week ? '?week=' + encodeURIComponent(week) : ''),
  );
export const postWallPiece = (piece) => api.post('/after-hours/wall', piece);
export const moveWallPiece = (id, position) =>
  api.patch('/after-hours/wall/' + encodeURIComponent(id), position);
export const removeWallPiece = (id) =>
  api.delete('/after-hours/wall/' + encodeURIComponent(id));
export const reactToWallPiece = (id, reaction) =>
  api.post('/after-hours/wall/' + encodeURIComponent(id) + '/react', {
    reaction,
  });
