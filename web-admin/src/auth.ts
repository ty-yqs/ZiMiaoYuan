/**
 * 登录态管理：token 存储在 localStorage
 */
const TOKEN_KEY = 'admin_token';
const USERNAME_KEY = 'admin_username';
const EXPIRE_KEY = 'admin_expires_at';
const ROLE_KEY = 'admin_role';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}

export function getRole(): string | null {
  return localStorage.getItem(ROLE_KEY);
}

export function setAuth(token: string, username: string, expiresAt: number, role?: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
  localStorage.setItem(EXPIRE_KEY, String(expiresAt));
  if (role) {
    localStorage.setItem(ROLE_KEY, role);
  } else {
    localStorage.removeItem(ROLE_KEY);
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(EXPIRE_KEY);
  localStorage.removeItem(ROLE_KEY);
}

export function isLoggedIn(): boolean {
  const token = getToken();
  const expire = Number(localStorage.getItem(EXPIRE_KEY) || 0);
  return !!token && expire > Date.now();
}

/**
 * 是否为最高管理员（role: super）。
 * 旧版本登录态没有 role 字段，视为最高管理员（首个账号）。
 */
export function isSuper(): boolean {
  const role = getRole();
  return !role || role === 'super';
}
