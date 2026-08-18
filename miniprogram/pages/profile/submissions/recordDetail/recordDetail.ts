/**
 * 发现记录瀑布流页
 *
 * 展示某只猫的所有发现记录，朋友圈式布局，支持下拉加载更多
 */
import { apiGetCatRecords } from '../../../../utils/api';
import { getCachedImageUrls } from '../../../../utils/imageCache';

const PAGE_SIZE = 10;

Page({
  data: {
    catId: '',
    records: [] as any[],
    page: 1,
    hasMore: true,
    loading: true,
    loadingMore: false,
    error: '',
    disabled: false,
  },

  async onLoad(options: Record<string, string>) {
    const { catId } = options;
    if (!catId) {
      this.setData({ error: '参数错误', loading: false });
      return;
    }
    this.setData({ catId });
    this.loadRecords();
  },

  /** 首次加载 */
  async loadRecords() {
    this.setData({ loading: true, error: '', disabled: false });

    try {
      const res = await apiGetCatRecords({ catId: this.data.catId, page: 1, pageSize: PAGE_SIZE });
      if (res.code === 0) {
        // 发现记录功能未开放
        if (res.data.disabled) {
          this.setData({ disabled: true, loading: false });
          return;
        }
        const { records, hasMore } = res.data;
        const formatted = this.formatRecords(records || []);
        this.setData({
          records: formatted,
          page: 2,
          hasMore: hasMore !== false,
          loading: false,
        });
        this.cachePhotos(formatted);
      } else {
        this.setData({ error: res.message || '加载失败', loading: false });
      }
    } catch (err) {
      console.error('[RecordDetail] 加载失败:', err);
      this.setData({ error: '网络异常，请重试', loading: false });
    }
  },

  /** 加载更多 */
  async loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;
    this.setData({ loadingMore: true });

    try {
      const res = await apiGetCatRecords({
        catId: this.data.catId,
        page: this.data.page,
        pageSize: PAGE_SIZE,
      });
      if (res.code === 0) {
        const { records, hasMore } = res.data;
        const formatted = this.formatRecords(records || []);
        const allRecords = [...this.data.records, ...formatted];
        this.setData({
          records: allRecords,
          page: this.data.page + 1,
          hasMore: hasMore !== false,
          loadingMore: false,
        });
        this.cachePhotos(formatted);
      } else {
        this.setData({ loadingMore: false });
      }
    } catch (err) {
      console.error('[RecordDetail] 加载更多失败:', err);
      this.setData({ loadingMore: false });
    }
  },

  /** 触底加载更多 */
  onReachBottom() {
    this.loadMore();
  },

  /** 格式化记录 */
  formatRecords(records: any[]): any[] {
    return records.map(r => ({
      ...r,
      _time: this.formatRelativeTime(r.createTime),
      _fullTime: this.formatFullTime(r.createTime),
      nicknameFirstLetter: (r.nickname || '匿').charAt(0),
    }));
  },

  /** 相对时间 */
  formatRelativeTime(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    if (diff < 60 * 1000) return '刚刚';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
    if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`;

    const M = d.getMonth() + 1;
    const day = d.getDate();
    return `${M}月${day}日`;
  },

  /** 完整时间 */
  formatFullTime(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const M = d.getMonth() + 1;
    const day = d.getDate();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${y}年${M}月${day}日 ${h}:${m}`;
  },

  /** 批量缓存图片 */
  async cachePhotos(records: any[]) {
    const allIDs: string[] = [];
    for (const r of records) {
      const rPhotos = r.photos || (r.photo ? [r.photo] : []);
      for (const p of rPhotos) {
        if (p && p.startsWith('cloud://')) allIDs.push(p);
      }
    }
    if (allIDs.length === 0) return;

    const cachedUrls = await getCachedImageUrls(allIDs);
    const urlMap: Record<string, string> = {};
    for (let i = 0; i < allIDs.length; i++) {
      if (cachedUrls[i]) urlMap[allIDs[i]] = cachedUrls[i];
    }

    // 更新 records 中的 photos 数组
    const updated = this.data.records.map(r => {
      const rPhotos = r.photos || (r.photo ? [r.photo] : []);
      const newPhotos = rPhotos.map((p: string) => urlMap[p] || p);
      return { ...r, photos: newPhotos };
    });
    this.setData({ records: updated });
  },

  /** 预览图片 */
  onPreviewPhoto(e: any) {
    const { url, urls } = e.currentTarget.dataset;
    wx.previewImage({
      urls: urls || [url],
      current: url,
    });
  },
});
