/**
 * 猫咪详情页
 *
 * 展示猫咪完整信息：图片、档案、健康状态、发现记录
 */
import { apiGetCatDetail, apiAdminUpdateCat, apiUploadRecord } from '../../../utils/api';
import { formatDate, showToast, showLoading, hideLoading } from '../../../utils/util';
import { ROUTES } from '../../../utils/constants';

const app = getApp<IAppOption>();

Page({
  data: {
    isAdmin: false,
    catId: '',
    cat: null as ICat | null,
    records: [] as IRecord[],
    notes: [] as IRecord[],
    totalRecords: 0,
    totalNotes: 0,
    hasMoreRecords: false,
    hasMoreNotes: false,

    // UI 状态
    loading: true,
    error: '',
    showShareSheet: false,

    // 分享选项
    shareActions: [
      { name: '分享给朋友', icon: 'share-o', openType: 'share' },
      { name: '生成海报', icon: 'poster-o' },
    ],

    // 便利贴
    showStickyNote: false,
    stickyNoteText: '',
    stickyNoteValid: false,
    submitNoteLoading: false,
  },

  onLoad(options: Record<string, string>) {
    this.setData({ isAdmin: app.globalData.isAdmin });

    const { catId } = options;
    if (catId) {
      this.setData({ catId });
      this.loadCatDetail();
    } else {
      this.setData({ error: '猫咪不存在', loading: false });
    }
  },

  onShow() {
    // 从上传页返回时自动刷新（首次加载由 onLoad 处理）
    if (this.data.cat) {
      this.loadCatDetail();
    }
  },

  /** 加载猫咪详情 */
  async loadCatDetail() {
    this.setData({ loading: true, error: '' });

    const res = await apiGetCatDetail(this.data.catId);

    if (res.code === 0) {
      const { cat, records } = res.data;
      const allRecords = records || [];
      const photoRecords = allRecords.filter((r: IRecord) => !r.type || r.type !== 'note');
      const noteRecords = allRecords.filter((r: IRecord) => r.type === 'note');
      this.setData({
        cat,
        records: photoRecords.slice(0, 3),
        notes: noteRecords.slice(0, 3),
        totalRecords: photoRecords.length,
        totalNotes: noteRecords.length,
        hasMoreRecords: photoRecords.length > 3,
        hasMoreNotes: noteRecords.length > 3,
        loading: false,
      });

      // 更新导航栏标题
      wx.setNavigationBarTitle({
        title: cat.cat_name || '猫咪详情',
      });
    } else {
      this.setData({
        error: res.message || '加载失败',
        loading: false,
      });
    }
  },

  /** 预览图片 */
  onPreviewImage(e: WechatMiniprogram.TouchEvent) {
    const { url, urls } = e.currentTarget.dataset;
    wx.previewImage({
      urls: urls || [url],
      current: url,
    });
  },

  /** 跳转上传记录页 */
  onUploadRecord() {
    const { catId } = this.data;
    wx.navigateTo({
      url: `/pages/upload/upload?catId=${catId}`,
    });
  },

  /** 查看更多记录或便利贴 */
  onTapMoreRecords(e: WechatMiniprogram.TouchEvent) {
    const { type } = e.currentTarget.dataset;
    const { catId } = this.data;
    wx.navigateTo({
      url: `${ROUTES.CAT_RECORDS}?catId=${catId}&type=${type}`,
    });
  },

  /** 管理员切换健康状态 */
  async onToggleHealth(e: WechatMiniprogram.TouchEvent) {
    if (!this.data.isAdmin) return;

    const { field } = e.currentTarget.dataset;
    const cat = this.data.cat;
    if (!cat) return;

    const newValue = !cat.health[field];

    const res = await apiAdminUpdateCat({
      catId: cat._id,
      action: 'update',
      updates: {
        health: { ...cat.health, [field]: newValue },
      },
    });

    if (res.code === 0) {
      const updatedHealth = { ...cat.health, [field]: newValue };
      this.setData({ 'cat.health': updatedHealth });
      showToast(newValue ? '已更新' : '已取消', 'success');
    } else {
      showToast(res.message || '更新失败', 'error');
    }
  },

  /** 空方法，用于阻止事件冒泡 */
  noop() {},

  /** 格式化时间 */
  formatDate(date: Date | string): string {
    return formatDate(date, 'YYYY-MM-DD HH:mm');
  },

  /** 显示便利贴弹窗 */
  onShowStickyNote() {
    this.setData({ showStickyNote: true, stickyNoteText: '', stickyNoteValid: false });
  },

  /** 关闭便利贴弹窗 */
  onCloseStickyNote() {
    this.setData({ showStickyNote: false, stickyNoteText: '', stickyNoteValid: false });
  },

  /** 便利贴输入 */
  onStickyNoteInput(e: WechatMiniprogram.Input) {
    const value = e.detail.value;
    this.setData({
      stickyNoteText: value,
      stickyNoteValid: !!value.trim(),
    });
  },

  /** 提交便利贴 */
  async onSubmitStickyNote() {
    const text = this.data.stickyNoteText.trim();
    if (!text) return;
    if (this.data.submitNoteLoading) return;

    this.setData({ submitNoteLoading: true });
    showLoading('提交中...');

    const res = await apiUploadRecord({
      catId: this.data.catId,
      photo: '',
      description: text,
    });

    hideLoading();
    this.setData({ submitNoteLoading: false });

    if (res.code === 0) {
      showToast('便利贴已贴上', 'success');
      this.onCloseStickyNote();
      this.loadCatDetail();
    } else {
      showToast(res.message || '提交失败', 'error');
    }
  },

  /** 显示分享面板 */
  onShowShare() {
    this.setData({ showShareSheet: true });
  },
  onCloseShare() {
    this.setData({ showShareSheet: false });
  },

  /** 分享 */
  onShareAppMessage() {
    const { cat } = this.data;
    return {
      title: `来看看 ${cat?.cat_name || '这只猫咪'} 吧！`,
      path: `/pages/cats/detail/detail?catId=${this.data.catId}`,
      imageUrl: cat?.avatar || '',
    };
  },
});
