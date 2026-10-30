/**
 * 猫咪照片打包下载
 *
 * 流程：
 * 1. 收集猫咪的 photos + avatar（去重），通过 adminGetImages 换成临时 https 链接
 * 2. 并发下载图片（限制并发数，避免一次性占满浏览器内存/带宽）
 * 3. 用 JSZip 打包成 zip（图片本身已压缩，使用 STORE 不再二次压缩）
 * 4. 触发浏览器保存
 */
import { resolveImageUrlMap } from './imageCache';

export interface CatPhotoSource {
  cat_name?: string;
  avatar?: string;
  photos?: string[];
}

export type PhotoDownloadStage = 'resolve' | 'download' | 'zip';

export interface PhotoDownloadProgress {
  stage: PhotoDownloadStage;
  /** 当前进度值：download 阶段为已下载张数，zip 阶段为百分比 */
  current: number;
  /** 总数：download 阶段为照片总数，zip 阶段为 100 */
  total: number;
}

export interface PhotoDownloadResult {
  /** 成功打包的照片张数 */
  photoCount: number;
  /** 下载失败（含链接解析失败）的照片张数 */
  failedCount: number;
  /** 浏览器保存时使用的文件名 */
  fileName: string;
}

/** 同时下载的图片数量 */
const DOWNLOAD_CONCURRENCY = 3;

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'heic',
  'heif',
  'avif',
]);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'jpg',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
};

/** 汇总猫咪的全部照片 fileID（photos + avatar，去重保序） */
function collectPhotoIds(cat: CatPhotoSource): string[] {
  const ids = [...(cat.photos || []), cat.avatar]
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.trim())
    .filter(Boolean);
  return [...new Set(ids)];
}

/** 生成安全的文件名（去掉文件系统非法字符） */
function safeFileName(name: string): string {
  return (
    (name || '')
      .replace(/[\u0000-\u001f\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60) || '未命名猫咪'
  );
}

/** 从 fileID / MIME 推断图片扩展名 */
function extensionOf(fileId: string, mimeType?: string): string {
  const path = (fileId || '').split('?')[0].split('#')[0];
  const matched = path.match(/\.([a-zA-Z0-9]{2,5})$/);
  if (matched) {
    const ext = matched[1].toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  }

  const mime = (mimeType || '').split(';')[0].trim().toLowerCase();
  return EXT_BY_MIME[mime] || 'jpg';
}

/** 限制并发地执行异步任务（单个任务失败不影响其它任务） */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

async function fetchPhoto(url: string): Promise<Blob> {
  const resp = await fetch(url, {
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  if (blob.size === 0) throw new Error('文件内容为空');
  return blob;
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // 给浏览器留出读取 Blob 的时间再释放
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * 下载并打包某只猫咪的全部照片。
 * @throws 该猫咪没有照片、照片链接获取失败或全部下载失败时抛出错误
 */
export async function downloadCatPhotos(
  cat: CatPhotoSource,
  onProgress?: (progress: PhotoDownloadProgress) => void
): Promise<PhotoDownloadResult> {
  const fileIds = collectPhotoIds(cat);
  if (fileIds.length === 0) {
    throw new Error('该猫咪还没有照片');
  }

  onProgress?.({ stage: 'resolve', current: 0, total: fileIds.length });
  const urlMap = await resolveImageUrlMap(fileIds);

  const unresolvedCount = fileIds.filter((id) => !urlMap.get(id)).length;
  const tasks = fileIds
    .map((fileId, index) => ({ fileId, index, url: urlMap.get(fileId) || '' }))
    .filter((task) => task.url);

  if (tasks.length === 0) {
    throw new Error('照片链接获取失败，请稍后重试');
  }

  const photos: Array<{ fileId: string; blob: Blob } | null> = new Array(tasks.length).fill(null);
  const failureMessages: string[] = [];
  let finished = 0;

  await runWithConcurrency(tasks, DOWNLOAD_CONCURRENCY, async (task, i) => {
    try {
      const blob = await fetchPhoto(task.url);
      photos[i] = { fileId: task.fileId, blob };
    } catch (err: any) {
      failureMessages.push(err?.message || String(err));
      console.warn('[downloadCatPhotos] 单张照片下载失败:', task.fileId, err);
    } finally {
      finished += 1;
      onProgress?.({ stage: 'download', current: finished, total: tasks.length });
    }
  });

  const downloaded = photos.filter((p): p is { fileId: string; blob: Blob } => p !== null);
  if (downloaded.length === 0) {
    const reason = failureMessages[0] || '';
    const isNetworkError = /failed to fetch|networkerror|load failed|network request failed/i.test(reason);
    throw new Error(
      `照片下载失败${reason ? `：${reason}` : ''}` +
        (isNetworkError ? '（请检查网络，或确认云存储已配置跨域访问）' : '')
    );
  }

  const baseName = safeFileName(cat.cat_name || '');
  // 按需加载 zip 库，避免进入「全部猫咪」页时就下载打包依赖
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  downloaded.forEach(({ fileId, blob }, index) => {
    const suffix = String(index + 1).padStart(2, '0');
    zip.file(`${baseName}_${suffix}.${extensionOf(fileId, blob.type)}`, blob, {
      // 图片已是压缩格式，再 DEFLATE 收益极低，STORE 更快也更省内存
      compression: 'STORE',
    });
  });

  onProgress?.({ stage: 'zip', current: 0, total: 100 });
  const archive = await zip.generateAsync(
    { type: 'blob', compression: 'STORE' },
    (meta) => {
      onProgress?.({ stage: 'zip', current: Math.round(meta.percent), total: 100 });
    }
  );

  const fileName = `${baseName}_照片.zip`;
  saveBlob(archive, fileName);

  return {
    photoCount: downloaded.length,
    failedCount: unresolvedCount + (tasks.length - downloaded.length),
    fileName,
  };
}