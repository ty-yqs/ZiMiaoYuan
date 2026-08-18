/**
 * 首页 — 紫喵园
 *
 * 包含：
 * 1. 轮播头图
 * 2. 今日猫咪推荐
 * 3. 快捷入口
 */
import { apiGetCats, apiGetBanners } from '../../utils/api';
import { ROUTES } from '../../utils/constants';
import { getCachedImageUrls } from '../../utils/imageCache';

// 5 个 tab 页，跳转时需用 switchTab
const TAB_ROUTES = [ROUTES.INDEX, ROUTES.FEED, ROUTES.CAT_LIST, ROUTES.PROFILE, ROUTES.STATS];

Page({
  data: {
    // 轮播头图（已解析为本地/临时路径）
    banners: [] as { _id: string; src: string; link: string }[],
    // 头图加载中（显示占位，避免加载完成后内容下移）
    bannersLoading: true,

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
    wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
    this.loadFeaturedCats();
    this.loadBanners();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  /** 加载推荐猫咪（随机推荐2只，仅首次进入时加载） */
  async loadFeaturedCats() {
    this.setData({ loading: true, error: '' });

    // 获取所有已审核猫咪（校园猫数量有限，全量拉取再随机取2只）
    const res = await apiGetCats({ page: 1, pageSize: 50 });

    if (res.code === 0) {
      const cats = (res.data.cats || []).filter(
        (c: ICat) => !c.adopted && !c.passedAway && !c.missing
      );
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

  /** 加载轮播头图（仅取启用项，解析 cloud:// 图片为本地路径） */
  async loadBanners() {
    // 首次加载（尚无头图）时显示占位；下拉刷新时保留已有头图，避免闪烁
    if (this.data.banners.length === 0) {
      this.setData({ bannersLoading: true });
    }
    try {
      const res = await apiGetBanners();
      if (res.code !== 0 || !Array.isArray(res.data)) return;

      const list: any[] = res.data;
      const fileIds = list.map((b) => b.image).filter(Boolean);
      const urls = await getCachedImageUrls(fileIds);

      this.setData({
        banners: list.map((b, i) => ({ _id: b._id, src: urls[i] || '', link: b.link || '' })),
      });
    } finally {
      this.setData({ bannersLoading: false });
    }
  },

  /** 查看全部猫咪 */
  onTapAllCats() {
    wx.switchTab({ url: ROUTES.CAT_LIST });
  },

  /** 页面跳转：外部网页用 openOfficialAccountArticle 打开公众号文章，tab 页用 switchTab，其余 navigateTo */
  navigate(url: string) {
    if (!url) return;
    if (/^https?:\/\//i.test(url)) {
      if (typeof (wx as any).openOfficialAccountArticle === 'function') {
        (wx as any).openOfficialAccountArticle({
          url,
          fail: () => {
            wx.setClipboardData({ data: url });
            wx.showToast({ title: '打开失败，链接已复制', icon: 'none' });
          },
        });
      } else {
        wx.setClipboardData({ data: url });
        wx.showToast({ title: '当前微信版本过低，无法打开', icon: 'none' });
      }
      return;
    }
    if (TAB_ROUTES.includes(url)) {
      wx.switchTab({ url });
    } else {
      wx.navigateTo({ url });
    }
  },

  /** 跳转快捷入口 */
  onTapEntry(e: WechatMiniprogram.TouchEvent) {
    const { url } = e.currentTarget.dataset;
    this.navigate(url);
  },

  /** 点击头图跳转（未配置 link 则不跳） */
  onTapBanner(e: WechatMiniprogram.TouchEvent) {
    const { link } = e.currentTarget.dataset;
    if (link) {
      this.navigate(link);
    }
  },

  /** 下拉刷新 */
  async onPullDownRefresh() {
    await Promise.all([this.loadFeaturedCats(), this.loadBanners()]);
    wx.stopPullDownRefresh();
  },

  /** 关闭科普弹窗 */
  onClosePoster() {
    this.setData({ showPoster: false });
  },

  /** 阻止冒泡 */
  noop() {},

  onShareAppMessage() {
    return { title: '紫喵园', path: '/pages/index/index' };
  },
});
