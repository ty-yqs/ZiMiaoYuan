/**
 * 首页 — 深理猫谱
 *
 * 包含：
 * 1. Banner 区域
 * 2. 今日猫咪推荐
 * 3. 快捷入口
 */
import { apiGetCats } from '../../utils/api';
import { ROUTES } from '../../utils/constants';

Page({
  data: {
    // Banner
    bannerTitle: '校园猫谱',
    bannerSubtitle: '发现校园里的每一只猫',

    // 推荐猫咪
    featuredCats: [] as ICat[],
    loading: true,
    error: '',

    // 快捷入口
    quickEntries: [
      { icon: '📸', label: '发现猫咪', url: ROUTES.UPLOAD },
      { icon: '📋', label: '猫咪档案', url: ROUTES.CAT_LIST },
      { icon: '👤', label: '我的', url: ROUTES.PROFILE },
    ],
  },

  onLoad() {
    this.loadFeaturedCats();
  },

  onShow() {
    // 每次回到首页刷新数据
    if (!this.data.loading) {
      this.loadFeaturedCats();
    }
  },

  /** 加载推荐猫咪（按最新时间排序，取前5只） */
  async loadFeaturedCats() {
    this.setData({ loading: true, error: '' });

    const res = await apiGetCats({ page: 1, pageSize: 5 });

    if (res.code === 0) {
      this.setData({
        featuredCats: res.data.cats || [],
        loading: false,
      });
    } else {
      this.setData({
        error: res.message || '加载失败',
        loading: false,
      });
    }
  },

  /** 查看全部猫咪 */
  onTapAllCats() {
    wx.switchTab({ url: ROUTES.CAT_LIST });
  },

  /** 跳转快捷入口 */
  onTapEntry(e: WechatMiniprogram.TouchEvent) {
    const { url } = e.currentTarget.dataset;
    if (url === ROUTES.CAT_LIST || url === ROUTES.PROFILE || url === ROUTES.INDEX) {
      wx.switchTab({ url });
    } else {
      wx.navigateTo({ url });
    }
  },

  /** 下拉刷新 */
  async onPullDownRefresh() {
    await this.loadFeaturedCats();
    wx.stopPullDownRefresh();
  },
});
