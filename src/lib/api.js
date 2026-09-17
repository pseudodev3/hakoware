export const API_BASE_URL = (import.meta.env.API_URL || '').trim().replace(/\/+$/, '');
const API_URL = `${API_BASE_URL}/api`;

const handleResponse = async (response) => {
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const error = (data && data.msg) || response.statusText;
    throw new Error(error);
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

export const api = {
  get: async (endpoint) => {
    const response = await fetch(`${API_URL}${endpoint}`, { headers: getHeaders() });
    return handleResponse(response);
  },

  post: async (endpoint, data) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  put: async (endpoint, data) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

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
