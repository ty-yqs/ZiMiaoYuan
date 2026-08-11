/**
 * 查看反馈页（管理员）
 */
import { apiGetFeedbacks } from '../../../utils/api';
import { getRelativeTime } from '../../../utils/util';

const app = getApp<IAppOption>();

Page({
  data: {
    feedbacks: [] as any[],
    loading: true,
    error: '',
    loadingMore: false,
    hasMore: false,

    page: 1,
    pageSize: 20,
    total: 0,
  },

  onLoad() {
    // 权限校验
    if (!app.globalData.isAdmin) {
      wx.showToast({ title: '无权访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.loadFeedbacks();
  },

  /** 加载反馈列表 */
  async loadFeedbacks() {
    this.setData({ loading: true, error: '' });

    try {
      const res = await apiGetFeedbacks({
        page: 1,
        pageSize: this.data.pageSize,
      });

      if (res.code === 0) {
        const { feedbacks, total, totalPages } = res.data;
        this.setData({
          feedbacks: feedbacks.map((f: any) => ({
            ...f,
            createTimeText: getRelativeTime(f.createTime),
          })),
          total,
          page: 1,
          hasMore: 1 < totalPages,
          loading: false,
        });
      } else {
        this.setData({
          error: res.message || '加载失败',
          loading: false,
        });
      }
    } catch (err) {
      console.error('[Feedbacks] 加载失败:', err);
      this.setData({
        error: '网络异常，请重试',
        loading: false,
      });
    }
  },

  /** 加载更多 */
  async onLoadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;
    this.setData({ loadingMore: true });

    const nextPage = this.data.page + 1;

    try {
      const res = await apiGetFeedbacks({
        page: nextPage,
        pageSize: this.data.pageSize,
      });

      if (res.code === 0) {
        const { feedbacks, totalPages } = res.data;
        const newFeedbacks = feedbacks.map((f: any) => ({
          ...f,
          createTimeText: getRelativeTime(f.createTime),
        }));

        this.setData({
          feedbacks: this.data.feedbacks.concat(newFeedbacks),
          page: nextPage,
          hasMore: nextPage < totalPages,
          loadingMore: false,
        });
      }
    } catch (err) {
      console.error('[Feedbacks] 加载更多失败:', err);
      this.setData({ loadingMore: false });
    }
  },
});
