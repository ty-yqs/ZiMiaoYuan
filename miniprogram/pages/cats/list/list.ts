/**
 * 猫咪档案列表页
 *
 * 功能：查看所有猫咪，支持搜索和筛选
 */
import { apiGetCats } from '../../../utils/api';
const config = require('../../../config/index');

Page({
  data: {
    cats: [] as ICat[],
    loading: false,
    hasMore: true,
    error: '',

    // 筛选
    searchKeyword: '',
    filterColor: '',
    filterGender: '',
    filterAge: '',

    // 筛选选项
    colorOptions: [
      { text: '全部毛色', value: '' },
      ...config.CAT_COLORS.map(c => ({ text: c, value: c })),
    ],
    genderOptions: [
      { text: '全部性别', value: '' },
      ...config.GENDER_OPTIONS.map(g => ({ text: g.label, value: g.value })),
    ],
    ageOptions: [
      { text: '全部年龄', value: '' },
      ...config.AGE_OPTIONS.map(a => ({ text: a.label, value: a.value })),
    ],

    // 分页
    page: 1,
  },

  onLoad() {
    wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
    this.loadCats(true);
  },

  /** 加载猫咪列表 */
  async loadCats(reset: boolean = false) {
    if (this.data.loading) return;

    const page = reset ? 1 : this.data.page;

    this.setData({ loading: true, error: '' });

    const res = await apiGetCats({
      keyword: this.data.searchKeyword,
      page,
      pageSize: config.PAGE_SIZE,
      color: this.data.filterColor,
      gender: this.data.filterGender,
      age: this.data.filterAge,
    });

    if (res.code === 0) {
      const { cats, total } = res.data;
      this.setData({
        cats: reset ? cats : [...this.data.cats, ...cats],
        page: page + 1,
        hasMore: (reset ? cats : [...this.data.cats, ...cats]).length < total,
        loading: false,
      });
    } else {
      this.setData({
        error: res.message || '加载失败，请重试',
        loading: false,
      });
    }
  },

  /** 搜索 */
  onSearch(e: WechatMiniprogram.CustomEvent) {
    this.setData({ searchKeyword: e.detail || '' });
    this.loadCats(true);
  },

  /** 筛选毛色 */
  onFilterColor(e: WechatMiniprogram.CustomEvent) {
    this.setData({ filterColor: e.detail || '' });
    this.loadCats(true);
  },

  /** 筛选性别 */
  onFilterGender(e: WechatMiniprogram.CustomEvent) {
    this.setData({ filterGender: e.detail || '' });
    this.loadCats(true);
  },

  /** 筛选年龄 */
  onFilterAge(e: WechatMiniprogram.CustomEvent) {
    this.setData({ filterAge: e.detail || '' });
    this.loadCats(true);
  },

  /** 触底加载更多 */
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadCats(false);
    }
  },

  /** 下拉刷新 */
  async onPullDownRefresh() {
    await this.loadCats(true);
    wx.stopPullDownRefresh();
  },

  onShareAppMessage() {
    return { title: '猫咪档案', path: '/pages/cats/list/list' };
  },

  /** 跳转上传页面 */
  onTapUpload() {
    wx.navigateTo({ url: '/pages/upload/upload' });
  },


});
