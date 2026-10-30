/**
 * 图片 URL 解析（两层缓存：内存 + localStorage）
 *
 * 数据库里的图片字段是 cloud:// fileID，浏览器无法直接渲染，
 * 需调 adminGetImages 云函数转成临时 https 链接（约 2 小时有效）。
 *
 * 缓存策略：
 * 1. 模块级内存缓存 —— 本次会话内最快命中
 * 2. localStorage 持久化 —— 刷新页面后仍命中，直到临时链接过期
 */
import { callFunction } from './api';

const CACHE_KEY = 'imageCacheMap';
// 临时链接约 2 小时有效，这里设 100 分钟，提前过期留出余量
const TTL_MS = 100 * 60 * 1000;

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const memCache = new Map<string, string>(); // fileId -> tempFileURL
const pending = new Map<string, Promise<string>>(); // 并发去重

function loadStore(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStore(store: Record<string, CacheEntry>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch (err) {
    // localStorage 满或不可用时忽略，仅退化为内存缓存
    console.warn('[imageCache] 写入缓存失败:', err);
  }
}

export async function resolveImageUrl(fileId: string): Promise<string> {
  if (!fileId) return '';
  // 非 cloud:// 开头（https / 相对路径）直接返回
  if (!fileId.startsWith('cloud://')) return fileId;

  if (memCache.has(fileId)) return memCache.get(fileId)!;
  if (pending.has(fileId)) return pending.get(fileId)!;

  const p = (async () => {
    // 1) 先查 localStorage
    const cached = loadStore()[fileId];
    if (cached && cached.url && cached.expiresAt > Date.now()) {
      memCache.set(fileId, cached.url);
      return cached.url;
    }

    // 2) 未命中则请求云端转换
    try {
      const res = await callFunction<Array<{ fileId: string; tempFileURL: string }>>(
        'adminGetImages',
        { fileIds: [fileId] }
      );
      if (res.code === 0 && res.data && res.data.length > 0) {
        const url = res.data[0].tempFileURL || '';
        if (url) {
          memCache.set(fileId, url);
          // 保存前重新读取，避免并发写覆盖其它条目
          const store = loadStore();
          store[fileId] = { url, expiresAt: Date.now() + TTL_MS };
          saveStore(store);
        }
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
 * 批量解析图片，返回 fileId -> 临时链接 的映射。
 *
 * 与逐张调用 resolveImageUrl 不同，这里会按 adminGetImages 的单次上限
 * （50 个）分批请求，适合打包下载整只猫咪的照片时一次性解析。
 * 解析失败或文件不存在时不会出现在结果 Map 中。
 */
export async function resolveImageUrlMap(fileIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const ids = [...new Set((fileIds || []).filter(Boolean))];
  const missing: string[] = [];

  for (const id of ids) {
    // 非 cloud:// 开头（https / 相对路径）直接使用
    if (!id.startsWith('cloud://')) {
      result.set(id, id);
      continue;
    }

    if (memCache.has(id)) {
      result.set(id, memCache.get(id)!);
      continue;
    }

    const cached = loadStore()[id];
    if (cached && cached.url && cached.expiresAt > Date.now()) {
      memCache.set(id, cached.url);
      result.set(id, cached.url);
      continue;
    }

    missing.push(id);
  }

  // adminGetImages 单次最多处理 50 个 fileID
  const BATCH_SIZE = 50;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const chunk = missing.slice(i, i + BATCH_SIZE);
    try {
      const res = await callFunction<Array<{ fileId: string; tempFileURL: string }>>(
        'adminGetImages',
        { fileIds: chunk }
      );
      if (res.code !== 0 || !Array.isArray(res.data)) continue;

      const store = loadStore();
      let changed = false;
      for (const item of res.data) {
        if (!item?.fileId || !item?.tempFileURL) continue;
        memCache.set(item.fileId, item.tempFileURL);
        store[item.fileId] = {
          url: item.tempFileURL,
          expiresAt: Date.now() + TTL_MS,
        };
        result.set(item.fileId, item.tempFileURL);
        changed = true;
      }
      if (changed) saveStore(store);
    } catch (err) {
      console.error('[imageCache] 批量解析失败:', err);
    }
  }

  return result;
}

/**
 * 批量解析图片（内部复用单张缓存）
 */
export async function resolveImageUrls(fileIds: string[]): Promise<string[]> {
  const urls = await Promise.all((fileIds || []).filter(Boolean).map(resolveImageUrl));
  return urls.filter(Boolean);
}

/**
 * 清除所有图片缓存
 */
export function clearImageCache() {
  memCache.clear();
  pending.clear();
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (err) {
    console.warn('[imageCache] 清除缓存失败:', err);
  }
}
