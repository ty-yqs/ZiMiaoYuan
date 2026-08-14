/**
 * 云函数调用封装
 *
 * 通过 @cloudbase/js-sdk 匿名登录后调用云函数，
 * 每次调用自动注入 localStorage 里的 admin token。
 */
import cloudbase from '@cloudbase/js-sdk';
import { getToken, clearAuth } from './auth';

const ENV_ID = 'cloud2-d1gbjipxm9c21dd8d';

const app: any = cloudbase.init({ env: ENV_ID });

// 匿名登录（web 端调用云函数的前提），幂等
let authPromise: Promise<void> | null = null;

function ensureAuth(): Promise<void> {
  if (!authPromise) {
    const auth = app.auth({ persistence: 'local' });
    authPromise = (async () => {
      try {
        // v2/v3 推荐 signInAnonymously，v1 用 anonymousAuthProvider().signIn()
        if (typeof auth.signInAnonymously === 'function') {
          await auth.signInAnonymously();
        } else {
          await auth.anonymousAuthProvider().signIn();
        }
      } catch (err: any) {
        const msg = err?.message || err?.errMsg || String(err);
        console.error('[api] 匿名登录失败:', err);
        throw new Error(
          `匿名登录失败：${msg}（请检查云开发控制台是否开启匿名登录、当前域名是否已加入安全域名）`
        );
      }
    })();
  }
  return authPromise;
}

export interface CloudResult<T = any> {
  code: number;
  message: string;
  data: T;
}

/**
 * 调用云函数
 * @returns 云函数的 return（即 { code, message, data }）
 */
export async function callFunction<T = any>(
  name: string,
  data: Record<string, any> = {}
): Promise<CloudResult<T>> {
  await ensureAuth();

  const token = getToken();
  const payload = token ? { ...data, token } : data;

  const res = await app.callFunction({ name, data: payload });
  const result = res.result as CloudResult<T>;

  // 登录态失效：清除本地 token（由调用方决定是否跳转）
  if (result && result.code === -403) {
    clearAuth();
  }

  return result;
}

/**
 * 上传图片到云存储，返回 cloud:// fileID
 * 使用传统 uploadFile，产物与小程序 wx.cloud.uploadFile 一致，可被
 * adminGetImages / deleteCloudFiles 正常处理。
 */
export async function uploadImage(file: File, cloudPath?: string): Promise<string> {
  await ensureAuth();
  const ext = (file.name.match(/\.(\w+)$/)?.[1] || 'jpg').toLowerCase();
  const path =
    cloudPath || `records/admin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res: any = await app.uploadFile({ cloudPath: path, filePath: file });
  return res?.fileID || '';
}
