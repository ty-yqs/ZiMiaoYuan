/**
 * 数据统计页
 *
 * 展示在册猫咪数量、绝育率、当日访问量等全局统计
 */
import { apiGetStats } from '../../utils/api';

Page({
  data: {
    loading: true,
    error: '',

    // 概览数据
    catCount: 0,
    sterilizedCount: 0,
    vaccinatedCount: 0,
    sterilizationRate: 0,
    vaccinationRate: 0,
    namingRate: 0,
    recordCount: 0,
    todayVisits: 0,
    adoptedCount: 0,
    passedAwayCount: 0,
    missingCount: 0,

    // 分布数据
    catsByColor: [] as { name: string; count: number }[],
    catsByGender: [] as { name: string; count: number }[],
    catsByAge: [] as { name: string; count: number }[],

    // 分布中的最大值，用于进度条计算
    maxColorCount: 0,
    maxAgeCount: 0,
    maxGenderCount: 0,
    maxSpecialCount: 0,
  },

  onLoad() {
    wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
    this.loadStats();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
  },

  onShareAppMessage() {
    return { title: '数据统计', path: '/pages/stats/stats' };
  },

  async loadStats() {
    this.setData({ loading: true, error: '' });

    const res = await apiGetStats();

    if (res.code === 0 && res.data) {
      const d = res.data;

      // 年龄段中文映射
      const AGE_LABEL_MAP: Record<string, string> = {
        kitten: '幼猫',
        adult: '成年猫',
        elderly: '老年猫',
        unknown: '未知',
      };

      // 为分布数据添加中文标签
      const catsByAge = (d.catsByAge || []).map((a: any) => ({
        ...a,
        label: AGE_LABEL_MAP[a.name] || a.name,
      }));

      const catsByGender = (d.catsByGender || []).map((g: any) => ({
        ...g,
        label: g.name,
      }));

      const catsByColor = (d.catsByColor || []).map((c: any) => ({
        ...c,
        label: c.name,
      }));

      // 计算分布中的最大值
      const maxColorCount = Math.max(...catsByColor.map((c: any) => c.count), 1);
      const maxAgeCount = Math.max(...catsByAge.map((a: any) => a.count), 1);
      const maxGenderCount = Math.max(...catsByGender.map((g: any) => g.count), 1);
      const maxSpecialCount = Math.max(d.adoptedCount || 0, d.passedAwayCount || 0, d.missingCount || 0, 1);

      this.setData({
        catCount: d.catCount,
        sterilizedCount: d.sterilizedCount,
        vaccinatedCount: d.vaccinatedCount,
        sterilizationRate: d.sterilizationRate,
        vaccinationRate: d.vaccinationRate,
        namingRate: d.namingRate,
        recordCount: d.recordCount,
        todayVisits: d.todayVisits,
        adoptedCount: d.adoptedCount || 0,
        passedAwayCount: d.passedAwayCount || 0,
        missingCount: d.missingCount || 0,
        catsByColor,
        catsByGender,
        catsByAge,
        maxColorCount,
        maxAgeCount,
        maxGenderCount,
        maxSpecialCount,
        loading: false,
      });
    } else {
      this.setData({
        error: res.message || '加载失败',
        loading: false,
      });
    }
  },
});
