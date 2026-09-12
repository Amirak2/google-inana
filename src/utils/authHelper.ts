/**
 * Helper to retrieve current session token and construct Authorization header
 */
export function getAuthHeaders(): Record<string, string> {
  try {
    const saved = localStorage.getItem('inana_user_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.token && typeof parsed.token === 'string') {
        return { Authorization: `Bearer ${parsed.token}` };
      }
    }
  } catch (err) {
    console.warn('[AUTH HELPER] Failed to parse session token:', err);
  }
  return {};
}

export function getCurrentUserToken(): string | null {
  try {
    const saved = localStorage.getItem('inana_user_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed?.token || null;
    }
  } catch {}
  return null;
}
