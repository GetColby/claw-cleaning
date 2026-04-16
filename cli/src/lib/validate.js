const SF_ZIP_RE = /\b94(10[2-9]|1[1-6][0-9]|17[0-7])\b/;

export function isSFAddress(address) {
  const lower = address.toLowerCase();
  return (
    lower.includes('san francisco') ||
    lower.includes(', sf,') ||
    lower.includes(', sf ') ||
    lower.endsWith(', sf') ||
    SF_ZIP_RE.test(address)
  );
}

export function isSatOrSun(dateStr) {
  const day = new Date(dateStr + 'T12:00:00Z').getUTCDay();
  return day === 0 || day === 6;
}

export function validateHours(hours) {
  const n = parseInt(hours, 10);
  return Number.isInteger(n) && n >= 1 && n <= 8;
}

export function validateTime(time) {
  return /^\d{2}:\d{2}$/.test(time);
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}
