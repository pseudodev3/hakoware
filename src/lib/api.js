export const API_BASE_URL = (import.meta.env.API_URL || '').trim().replace(/\/+$/, '');
const API_URL = `${API_BASE_URL}/api`;

const handleResponse = async (response) => {
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const error = new Error((data && data.msg) || response.statusText || `Request failed (${response.status})`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
};

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'x-auth-token': token } : {})
  };
};

const requestWithJson = async (method, endpoint, data) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
};

export const api = {
  get: async (endpoint) => {
    const response = await fetch(`${API_URL}${endpoint}`, { headers: getHeaders() });
    return handleResponse(response);
  },

  post: (endpoint, data) => requestWithJson('POST', endpoint, data),

  put: (endpoint, data) => requestWithJson('PUT', endpoint, data),

  patch: (endpoint, data) => requestWithJson('PATCH', endpoint, data),

  delete: async (endpoint) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  upload: async (endpoint, formData) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        ...(token ? { 'x-auth-token': token } : {})
      },
      body: formData
    });
    return handleResponse(response);
  }
};
