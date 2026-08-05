/**
 * 首页 — 紫喵园
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
    bannerTitle: '紫喵园 · 校园猫谱',
    bannerSubtitle: '记录校园里的每一只小猫',

    // 推荐猫咪
    featuredCats: [] as ICat[],
    loading: true,
    error: '',
    showPoster: true,

    // 快捷入口
    quickEntries: [
      { icon: '📸', label: '发现猫咪', url: ROUTES.UPLOAD },
      { icon: '📊', label: '数据统计', url: ROUTES.STATS },
    ],
  },

  onLoad() {
    this.loadFeaturedCats();
  },

  /** 加载推荐猫咪（随机推荐2只，仅首次进入时加载） */
  async loadFeaturedCats() {
    this.setData({ loading: true, error: '' });

    // 获取所有已审核猫咪（校园猫数量有限，全量拉取再随机取2只）
    const res = await apiGetCats({ page: 1, pageSize: 50 });

    if (res.code === 0) {
      const cats = res.data.cats || [];
      // Fisher-Yates 洗牌后取前 2 只
      for (let i = cats.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cats[i], cats[j]] = [cats[j], cats[i]];
      }
      this.setData({
        featuredCats: cats.slice(0, 2),
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
    if (url === ROUTES.CAT_LIST || url === ROUTES.PROFILE || url === ROUTES.INDEX || url === ROUTES.STATS) {
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

  /** 关闭科普弹窗 */
  onClosePoster() {
    this.setData({ showPoster: false });
  },

  /** 阻止冒泡 */
  noop() {},
});
