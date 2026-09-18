const resources = new Map();

const timestamp = () => Date.now();

export const peekResource = (key) => resources.get(key)?.data;

export const seedResource = (key, data) => {
  if (data === undefined) return;
  const current = resources.get(key);
  resources.set(key, {
    data,
    updatedAt: timestamp(),
    promise: current?.promise || null
  });
};

export const fetchResource = async (key, loader, { ttl = 30000, force = false } = {}) => {
  const current = resources.get(key);
  const isFresh = current?.data !== undefined && (timestamp() - (current.updatedAt || 0)) < ttl;

  if (!force && isFresh) return current.data;
  if (current?.promise) return current.promise;

  const promise = Promise.resolve()
    .then(loader)
    .then((data) => {
      resources.set(key, {
        data,
        updatedAt: timestamp(),
        promise: null
      });
      return data;
    })
    .catch((error) => {
      const latest = resources.get(key);
      resources.set(key, {
        data: latest?.data,
        updatedAt: latest?.updatedAt || 0,
        promise: null
      });
      throw error;
    });

  resources.set(key, {
    data: current?.data,
    updatedAt: current?.updatedAt || 0,
    promise
  });

  return promise;
};

export const invalidateResource = (key) => {
  const current = resources.get(key);
  if (!current) return;
  resources.set(key, { ...current, updatedAt: 0 });
};

export const deleteResource = (key) => resources.delete(key);

export const clearResourceCache = () => resources.clear();
