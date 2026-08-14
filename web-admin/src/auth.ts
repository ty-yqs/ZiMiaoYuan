/**
 * 登录态管理：token 存储在 localStorage
 */
const TOKEN_KEY = 'admin_token';
const USERNAME_KEY = 'admin_username';
const EXPIRE_KEY = 'admin_expires_at';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}

export function setAuth(token: string, username: string, expiresAt: number) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
  localStorage.setItem(EXPIRE_KEY, String(expiresAt));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(EXPIRE_KEY);
}

export function isLoggedIn(): boolean {
  const token = getToken();
  const expire = Number(localStorage.getItem(EXPIRE_KEY) || 0);
  return !!token && expire > Date.now();
}
