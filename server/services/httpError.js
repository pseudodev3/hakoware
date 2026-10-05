const CLIENT_ERROR_MIN = 400;
const CLIENT_ERROR_MAX = 499;

const sendRouteError = (res, error, fallback = 'Request failed') => {
  const status = Number(error?.status);
  const isClientError = Number.isInteger(status) && status >= CLIENT_ERROR_MIN && status <= CLIENT_ERROR_MAX;

  if (isClientError) {
    return res.status(status).json({ msg: String(error?.message || fallback) });
  }

  // Only deliberately public service-unavailable messages may leave the server.
  if (status === 503 && error?.publicMessage) {
    return res.status(503).json({ msg: String(error.publicMessage) });
  }

  return res.status(500).json({ msg: fallback });
};

module.exports = {
  sendRouteError
};
