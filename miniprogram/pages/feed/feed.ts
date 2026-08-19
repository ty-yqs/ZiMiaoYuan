/**
 * 动态页 — 全局发现记录瀑布流
 *
 * 展示所有猫咪的已审核发现记录，朋友圈式布局，支持下拉加载更多。
 * 每条动态附对应的猫咪小卡片，点击跳转到猫咪详情。
 */
import { apiGetAllRecords } from '../../utils/api';
import { getCachedImageUrls } from '../../utils/imageCache';

const PAGE_SIZE = 10;

Page({
  data: {
    records: [] as any[],
    page: 1,
    hasMore: true,
    loading: true,
    loadingMore: false,
    error: '',
    disabled: false,
  },

  onLoad() {
    this.loadRecords();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  /** 首次加载 */
  async loadRecords() {
    this.setData({ loading: true, error: '', disabled: false });

    try {
      const res = await apiGetAllRecords({ page: 1, pageSize: PAGE_SIZE });
      if (res.code === 0) {
        // 动态功能未开放
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
      console.error('[Feed] 加载失败:', err);
      this.setData({ error: '网络异常，请重试', loading: false });
    }
  },

  /** 加载更多 */
  async loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;
    this.setData({ loadingMore: true });

    try {
      const res = await apiGetAllRecords({
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
      console.error('[Feed] 加载更多失败:', err);
      this.setData({ loadingMore: false });
    }
  },

  /** 触底加载更多 */
  onReachBottom() {
    this.loadMore();
  },

  /** 下拉刷新 */
  async onPullDownRefresh() {
    try {
      const res = await apiGetAllRecords({ page: 1, pageSize: PAGE_SIZE });
      if (res.code === 0) {
        const { records, hasMore } = res.data;
        const formatted = this.formatRecords(records || []);
        this.setData({
          records: formatted,
          page: 2,
          hasMore: hasMore !== false,
          loading: false,
        });
        this.cachePhotos(formatted);
      }
    } catch (err) {
      console.error('[Feed] 下拉刷新失败:', err);
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  /** 格式化记录（动态页只展示照片记录，过滤掉便利贴） */
  formatRecords(records: any[]): any[] {
    return records
      .filter((r: any) => !r.type || r.type !== 'note')
      .map((r: any) => ({
        ...r,
        _time: this.formatRelativeTime(r.createTime),
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

  /** 批量缓存图片（记录照片 + 猫咪头像） */
  async cachePhotos(records: any[]) {
    const allIDs: string[] = [];
    for (const r of records) {
      const rPhotos = r.photos || (r.photo ? [r.photo] : []);
      for (const p of rPhotos) {
        if (p && p.startsWith('cloud://')) allIDs.push(p);
      }
      if (r.cat && r.cat.avatar && r.cat.avatar.startsWith('cloud://')) {
        allIDs.push(r.cat.avatar);
      }
    }
    if (allIDs.length === 0) return;

    const cachedUrls = await getCachedImageUrls(allIDs);
    const urlMap: Record<string, string> = {};
    for (let i = 0; i < allIDs.length; i++) {
      if (cachedUrls[i]) urlMap[allIDs[i]] = cachedUrls[i];
    }

    // 更新 records 中的 photos 数组与 cat.avatar
    const updated = this.data.records.map(r => {
      const rPhotos = r.photos || (r.photo ? [r.photo] : []);
      const newPhotos = rPhotos.map((p: string) => urlMap[p] || p);
      const cat = r.cat
        ? { ...r.cat, avatar: urlMap[r.cat.avatar] || r.cat.avatar }
        : null;
      return { ...r, photos: newPhotos, cat };
    });
    this.setData({ records: updated });
  },

  /** 点击猫咪小卡片 → 跳转详情 */
  onTapCat(e: any) {
    const { catId } = e.currentTarget.dataset;
    if (catId) {
      wx.navigateTo({ url: `/pages/cats/detail/detail?catId=${catId}` });
    }
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
