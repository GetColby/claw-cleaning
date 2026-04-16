const DEFAULT_SERVER = 'https://clawt-server.workers.dev';

export function getServerUrl() {
  return (process.env.CLAWT_SERVER_URL || DEFAULT_SERVER).replace(/\/$/, '');
}

export async function apiFetch(path, options = {}) {
  const url = `${getServerUrl()}${path}`;
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || `Server error ${resp.status}`);
  }
  return data;
}
