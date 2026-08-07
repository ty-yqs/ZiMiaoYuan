/**
 * 投喂罐头 — 赞助支持页
 */
import { showToast } from '../../utils/util';
import { getCachedImageUrl } from '../../utils/imageCache';

const app = getApp<IAppOption>();

Page({
  data: {
    supporters: [] as { name: string; amount: number; month: string }[],
    showQR: false,
    qrUrl: '',
    loading: true,
    error: '',
  },

  onLoad() {
    wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
    this.loadQRCode();
    this.loadSupporters();
  },

  /** 加载收款二维码（优先本地缓存，否则通过云函数获取并缓存） */
  async loadQRCode() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getSponsorQR',
        data: {},
      });
      if (res.result.code === 0 && res.result.data) {
        const { url, cloudFileID } = res.result.data;
        // 尝试缓存到本地，下次打开直接使用本地文件
        if (cloudFileID) {
          const cachedPath = await getCachedImageUrl(cloudFileID);
          this.setData({ qrUrl: cachedPath || url });
        } else {
          this.setData({ qrUrl: url });
        }
      }
    } catch (err) {
      console.error('[Support] 加载二维码失败:', err);
    }
  },

  async loadSupporters() {
    this.setData({ loading: true, error: '' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'getSupporters',
        data: {},
      });

      if (res.result.code === 0) {
        this.setData({
          supporters: res.result.data || [],
          loading: false,
        });
      } else {
        this.setData({
          error: res.result.message || '加载失败',
          loading: false,
        });
      }
    } catch (err: any) {
      console.error('[Support] 加载赞助列表失败:', err);
      this.setData({
        error: '加载失败，请重试',
        loading: false,
      });
    }
  },

  /** 显示赞助二维码 */
  onShowQR() {
    this.setData({ showQR: true });
  },

  /** 关闭赞助二维码 */
  onCloseQR() {
    this.setData({ showQR: false });
  },

  /** 预览费用明细图 */
  onPreviewCost() {
    wx.previewImage({
      urls: ['/images/cost.png'],
      current: '/images/cost.png',
    });
  },

  /** 阻止冒泡 */
  noop() {},

  onShareAppMessage() {
    return { title: '投喂罐头', path: '/pages/support/support' };
  },
});
