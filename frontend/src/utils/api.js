export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const buildApiUrl = (path = '') => {
  const normalized = String(path || '');
  if (!normalized) return API_BASE;
  return normalized.startsWith('/') ? `${API_BASE}${normalized}` : `${API_BASE}/${normalized}`;
};
