/**
 * 猫咪详情页
 *
 * 展示猫咪完整信息：图片、档案、健康状态、发现记录
 */
import { apiGetCatDetail, apiAdminUpdateCat, apiUploadRecord, apiRateCat } from '../../../utils/api';
import { formatDate, showToast, showLoading, hideLoading, requireProfile } from '../../../utils/util';
import { ROUTES } from '../../../utils/constants';
import { getCachedImageUrls } from '../../../utils/imageCache';

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

    // 缓存后的图片
    cachedPhotos: [] as string[],
    cachedRecords: [] as IRecord[],
    cachedNotes: [] as IRecord[],

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

    // 亲人指数评分
    myRating: 0,
    ratingAvg: null as number | null,
    ratingCount: 0,
    ratingAvgDisplay: '--',
    rateLoading: false,

    // 猫咪关系
    relationships: [] as IRelationship[],

    // 功能开关（发现记录 / 便利贴 / 底部操作按钮 / 亲人指数）
    recordsOpen: true,
    notesOpen: true,
    detailActionsOpen: true,
    // 亲人指数默认不加载，等 settings 返回「可显示」信号后再渲染
    ratingOpen: false,
  },

  onLoad(options: Record<string, string>) {
    wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
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
    // 仅当上传/发表完成后才刷新（首次加载由 onLoad 处理）
    if (this.data.cat && app.globalData.needRefreshDetail) {
      app.globalData.needRefreshDetail = false;
      this.loadCatDetail();
    }
  },

  /** 加载猫咪详情 */
  async loadCatDetail() {
    this.setData({ loading: true, error: '' });

    const res = await apiGetCatDetail(this.data.catId);

    if (res.code === 0) {
      const { cat, records, myRating, settings } = res.data;
      const recordsOpen = settings ? settings.recordsOpen !== false : true;
      const notesOpen = settings ? settings.notesOpen !== false : true;
      const detailActionsOpen = settings ? settings.detailActionsOpen !== false : true;
      const ratingOpen = settings ? settings.ratingOpen !== false : false;

      // 年龄段中文映射
      const AGE_LABEL_MAP: Record<string, string> = {
        kitten: '幼猫',
        adult: '成年猫',
        elderly: '老年猫',
        unknown: '未知年龄',
      };
      cat.ageLabel = AGE_LABEL_MAP[cat.age] || '未知年龄';

      // 预格式化时间
      const fmt = (d: any) => formatDate(d, 'YYYY-MM-DD HH:mm');

      const allRecords = (records || []).map((r: IRecord) => ({
        ...r,
        _time: fmt(r.createTime),
      }));
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
        // 先用原始数据初始化，等缓存加载后再替换
        cachedPhotos: cat.photos || [],
        cachedRecords: photoRecords.slice(0, 3),
        // 评分数据
        myRating: myRating || 0,
        ratingAvg: cat.ratingAvg != null ? Number(cat.ratingAvg) : null,
        ratingAvgDisplay: cat.ratingAvg != null ? Number(cat.ratingAvg).toFixed(1) : '--',
        ratingCount: cat.ratingCount || 0,
        // 关系数据（已在云函数中填充对方猫咪信息）
        relationships: res.data.relationships || [],
        // 功能开关
        recordsOpen,
        notesOpen,
        detailActionsOpen,
        ratingOpen,
        loading: false,
      });

      // 异步转换图片 URL 到本地缓存
      this.cacheImages(cat, photoRecords);

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

  /** 缓存图片到本地 */
  async cacheImages(cat: ICat, photoRecords: IRecord[]) {
    // 收集所有需要缓存的 cloud:// 图片 ID
    const cloudIDs: string[] = [];

    // 猫咪照片
    if (cat.photos && cat.photos.length > 0) {
      cloudIDs.push(...cat.photos);
    }

    // 发现记录中的照片（兼容 photos 数组和单个 photo）
    for (const record of photoRecords) {
      const rPhotos = (record as any).photos || (record.photo ? [record.photo] : []);
      for (const p of rPhotos) {
        if (p && p.startsWith('cloud://')) cloudIDs.push(p);
      }
    }

    if (cloudIDs.length === 0) return;

    // 批量缓存
    const cachedUrls = await getCachedImageUrls(cloudIDs);
    let urlIndex = 0;

    // 猫咪照片
    const cachedPhotos = cat.photos
      ? cat.photos.map(originalUrl => cachedUrls[urlIndex++] || originalUrl)
      : [];

    // 记录中的照片 — 每条记录可能有多个 photos
    const cachedRecords = photoRecords.map(record => {
      const rPhotos = (record as any).photos || (record.photo ? [record.photo] : []);
      const newPhotos = rPhotos.map((p: string) => cachedUrls[urlIndex++] || p);
      return { ...record, photos: newPhotos };
    });

    this.setData({
      cachedPhotos,
      cachedRecords: cachedRecords.slice(0, 3),
    });
  },

  /** 预览图片 */
  onPreviewImage(e: WechatMiniprogram.TouchEvent) {
    const { url, urls } = e.currentTarget.dataset;
    wx.previewImage({
      urls: urls || [url],
      current: url,
    });
  },

  /** 点击发现记录卡片，跳转瀑布流记录页 */
  onTapRecordsCard() {
    const { catId } = this.data;
    wx.navigateTo({ url: `/pages/profile/submissions/recordDetail/recordDetail?catId=${catId}` });
  },

  /** 跳转编辑页 */
  onTapEdit() {
    if (!requireProfile()) return;
    const { catId } = this.data;
    wx.navigateTo({
      url: `${ROUTES.CAT_EDIT}?catId=${catId}`,
    });
  },

  /** 跳转上传记录页 */
  onUploadRecord() {
    if (!requireProfile()) return;
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
    // 进入便利贴提交前再次校验开关
    if (!this.data.notesOpen) {
      showToast('当前暂不开放便利贴');
      return;
    }
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
    if (!requireProfile()) return;
    const text = this.data.stickyNoteText.trim();
    if (!text) return;
    if (this.data.submitNoteLoading) return;

    // 必须在 tap 手势回调中直接调用，不能等异步完成后
    wx.requestSubscribeMessage({
      tmplIds: ['ImPQfyZeWGBqwauOUmFfI7SiCXfiNgrgb_CDt7v7U-Q'],
    });

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
      showToast('便利贴已提交，等待审核', 'success');
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

  /** 猫咪评分 */
  async onTapStar(e: WechatMiniprogram.TouchEvent) {
    if (!requireProfile()) return;
    if (this.data.rateLoading) return;

    const { rating } = e.currentTarget.dataset;
    const { catId } = this.data;

    this.setData({ rateLoading: true });

    try {
      const res = await apiRateCat({ catId, rating: Number(rating) });

      if (res.code === 0) {
        const { rating: myRating, ratingAvg, ratingCount } = res.data;
        this.setData({
          myRating,
          ratingAvg,
          ratingAvgDisplay: ratingAvg != null ? ratingAvg.toFixed(1) : '--',
          ratingCount,
        });
        // 更新 cat 上的反范式字段，确保下次 loadCatDetail 时也是最新的
        if (this.data.cat) {
          (this.data.cat as ICat).ratingAvg = ratingAvg;
          (this.data.cat as ICat).ratingCount = ratingCount;
        }
        showToast('评分成功', 'success');
      } else {
        showToast(res.message || '评分失败', 'error');
      }
    } catch (err) {
      console.error('[Detail] 评分失败:', err);
      showToast('网络异常，请重试', 'error');
    } finally {
      this.setData({ rateLoading: false });
    }
  },

  /** 点击关系中的对方猫咪，跳转其详情页 */
  onTapRelatedCat(e: WechatMiniprogram.TouchEvent) {
    const { catId } = e.currentTarget.dataset;
    if (catId) {
      wx.navigateTo({
        url: `${ROUTES.CAT_DETAIL}?catId=${catId}`,
      });
    }
  },
});
