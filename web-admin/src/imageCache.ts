/**
 * 图片 URL 解析（模块级缓存）
 *
 * 数据库里的图片字段是 cloud:// fileID，浏览器无法直接渲染，
 * 需调 adminGetImages 云函数转成临时 https 链接（约 2 小时有效）。
 * 这里做模块级缓存 + 并发去重，避免同一图片重复请求。
 */
import { callFunction } from './api';

const cache = new Map<string, string>(); // fileId -> tempFileURL
const pending = new Map<string, Promise<string>>();

export async function resolveImageUrl(fileId: string): Promise<string> {
  if (!fileId) return '';
  // 非 cloud:// 开头（https / 相对路径）直接返回
  if (!fileId.startsWith('cloud://')) return fileId;

  if (cache.has(fileId)) return cache.get(fileId)!;
  if (pending.has(fileId)) return pending.get(fileId)!;

  const p = (async () => {
    try {
      const res = await callFunction<Array<{ fileId: string; tempFileURL: string }>>(
        'adminGetImages',
        { fileIds: [fileId] }
      );
      if (res.code === 0 && res.data && res.data.length > 0) {
        const url = res.data[0].tempFileURL || '';
        if (url) cache.set(fileId, url);
        return url;
      }
      return '';
    } catch (err) {
      console.error('[imageCache] 解析失败:', fileId, err);
      return '';
    }
  })();

  pending.set(fileId, p);
  return p;
}

/**
 * 批量解析图片（内部复用单张缓存）
 */
export async function resolveImageUrls(fileIds: string[]): Promise<string[]> {
  const urls = await Promise.all((fileIds || []).filter(Boolean).map(resolveImageUrl));
  return urls.filter(Boolean);
}
