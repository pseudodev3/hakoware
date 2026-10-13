import { api } from '../lib/api';
import { invalidateResource } from '../lib/resourceCache';
import { RESOURCE_KEYS } from './bootstrapService';
const changed = result => { [RESOURCE_KEYS.bootstrap, RESOURCE_KEYS.user, RESOURCE_KEYS.contracts, RESOURCE_KEYS.you].forEach(invalidateResource); return result; };
export const saveDuoIdentity = async (id, identity) => changed(await api.patch(`/presentation/duos/${id}`, identity));
export const getProfilePresentation = () => api.get('/presentation/profile');
export const saveProfilePresentation = async profile => changed(await api.patch('/presentation/profile', profile));
