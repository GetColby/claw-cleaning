const DEFAULT_SERVER = 'https://claw.cleaning';

export function getServerUrl() {
  return (process.env.CLAW_CLEANING_SERVER_URL || DEFAULT_SERVER).replace(/\/$/, '');
}

export async function apiFetch(path, options = {}) {
  const url = `${getServerUrl()}${path}`;
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await resp.json();
  if (!resp.ok) {
    const err = new Error(data.error || data.message || `Server error ${resp.status}`);
    err.status = resp.status;
    err.code = data.code;
    err.declineCode = data.declineCode;
    err.requiresAction = !!data.requiresAction;
    throw err;
  }
  return data;
}
