const CLIENT_ERROR_MIN = 400;
const CLIENT_ERROR_MAX = 499;

const sendRouteError = (res, error, fallback = 'Request failed') => {
  const status = Number(error?.status);
  const isClientError = Number.isInteger(status) && status >= CLIENT_ERROR_MIN && status <= CLIENT_ERROR_MAX;

  if (isClientError) {
    return res.status(status).json({ msg: String(error?.message || fallback) });
  }

  return res.status(500).json({ msg: fallback });
};

module.exports = {
  sendRouteError
};
