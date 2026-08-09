/**
 * 管理员后台
 *
 * 功能：
 * - 审核待审批的猫咪 (pending → approved / rejected)
 * - 查看猫咪完整信息及所有照片
 * - 审核编辑提案
 * - 删除错误数据
 */
import { apiGetCats, apiAdminUpdateCat, apiGetPendingEdits, apiGetPendingRecords, apiReviewRecord } from '../../utils/api';
import { showToast, showConfirm } from '../../utils/util';
import { getCachedImageUrls } from '../../utils/imageCache';
const config = require('../../config/index');

const app = getApp<IAppOption>();

// 年龄段中文映射
const AGE_LABEL_MAP: Record<string, string> = {
  kitten: '幼猫 (<1岁)',
  adult: '成年猫',
  elderly: '老年猫',
  unknown: '未知',
};

// 性别中文映射
const GENDER_LABEL_MAP: Record<string, string> = {
  male: '公猫 ♂',
  female: '母猫 ♀',
  unknown: '未知',
};

Page({
  data: {
    isAdmin: false,
    activeTab: 0,
    pendingCats: [] as ICat[],
    allCats: [] as ICat[],
    allCatsPage: 1,
    allCatsHasMore: true,
    allCatsLoading: false,
    allCatsTotal: 0,
    pendingEdits: [] as IEditProposal[],
    pendingRecords: [] as any[],
    loading: true,

    // 驳回弹窗
    showRejectModal: false,
    rejectTarget: null as { type: string; id: string } | null,
    rejectReason: '',
    error: '',
  },

  onLoad() {
    wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
    if (!app.globalData.isAdmin) {
      wx.showModal({
        title: '权限不足',
        content: '仅管理员可访问此页面',
        showCancel: false,
        success: () => wx.navigateBack(),
      });
      return;
    }
    this.setData({ isAdmin: true });
    this.loadData();
  },

  /** 加载数据 */
  async loadData() {
    this.setData({ loading: true });

    // 加载待审核猫咪
    const pendingRes = await apiGetCats({ status: 'pending', pageSize: 50, resolveUser: true });
    if (pendingRes.code === 0) {
      const cats = (pendingRes.data.cats || []).map((cat: ICat) => ({
        ...cat,
        genderLabel: GENDER_LABEL_MAP[cat.gender] || '',
        ageLabel: AGE_LABEL_MAP[cat.age] || '',
      }));
      this.setData({ pendingCats: cats });
      this.cacheAvatars(cats, 'pendingCats');
      this.cachePendingPhotos(cats);
    }

    // 加载全部猫咪（首页，分页）
    await this.loadAllCats(true);

    // 加载待审核编辑
    await this.loadPendingEdits();

    // 加载待审核记录
    await this.loadPendingRecords();

    this.setData({ loading: false });
  },

  /** 加载全部猫咪（分页） */
  async loadAllCats(reset: boolean = false) {
    if (this.data.allCatsLoading) return;

    const page = reset ? 1 : this.data.allCatsPage;
    this.setData({ allCatsLoading: true });

    const res = await apiGetCats({ status: 'all', page, pageSize: config.PAGE_SIZE });

    if (res.code === 0) {
      const { cats, total } = res.data;
      const newCats = reset ? cats : [...this.data.allCats, ...cats];
      this.setData({
        allCats: newCats,
        allCatsPage: page + 1,
        allCatsHasMore: newCats.length < total,
        allCatsTotal: total,
        allCatsLoading: false,
      });
    } else {
      this.setData({ allCatsLoading: false });
    }
  },

  /** 触底加载更多 */
  onReachBottom() {
    // 只在全部猫咪 tab 时加载更多
    if (this.data.activeTab === 2 && this.data.allCatsHasMore) {
      this.loadAllCats(false);
    }
  },

  /** 加载待审核编辑提案 */
  async loadPendingEdits() {
    const res = await apiGetPendingEdits();
    if (res.code === 0) {
      const FIELD_LABELS: Record<string, string> = {
        cat_name: '名字',
        color: '毛色',
        gender: '性别',
        age: '年龄段',
        description: '简介',
        health: '健康状态',
      };

      const formatValue = (key: string, value: any): string => {
        if (key === 'health' && typeof value === 'object') {
          const parts: string[] = [];
          if (value.sterilized) parts.push('已绝育'); else parts.push('未绝育');
          if (value.vaccinated) parts.push('已打疫苗'); else parts.push('未打疫苗');
          return parts.join('，');
        }
        return String(value);
      };

      const REL_TYPE_LABELS: Record<string, string> = {
        parent_child: '亲子',
        sibling: '兄弟姐妹',
        mate: '伴侣',
        ex_mate: '前伴侣',
        friend: '好朋友',
        rival: '对头',
        other: '其他',
      };

      const pendingEdits = (res.data || []).map((edit: IEditProposal) => {
        // 字段变更
        const changesList = Object.entries(edit.proposedChanges).map(([key, value]) => ({
          key: FIELD_LABELS[key] || key,
          value: formatValue(key, value),
        }));

        // 关系变更
        const relChanges: Array<{ text: string; action: string }> = [];
        const relData = (edit as any).proposedRelationshipChanges;
        if (relData) {
          if (relData.add && relData.add.length > 0) {
            for (const a of relData.add) {
              const typeLabel = REL_TYPE_LABELS[a.type] || a.type;
              relChanges.push({
                text: `${typeLabel} - ${a.otherCatName || '未知猫咪'}`,
                action: 'add',
              });
            }
          }
          if (relData.remove && relData.remove.length > 0) {
            for (const r of relData.remove) {
              relChanges.push({
                text: `${r.label || '未知'} - ${r.otherCatName || '未知猫咪'}`,
                action: 'remove',
              });
            }
          }
        }

        return {
          ...edit,
          changesList,
          relChanges,
          hasRelChanges: relChanges.length > 0,
        };
      });
      this.setData({ pendingEdits });
    }
  },

  /** 缓存猫咪头像到本地 */
  async cacheAvatars(cats: ICat[], listKey: string) {
    const cloudIDs = cats
      .map((c) => c.avatar)
      .filter((avatar) => avatar && avatar.startsWith('cloud://'));

    if (cloudIDs.length === 0) return;

    const cachedUrls = await getCachedImageUrls(cloudIDs);

    const urlMap: Record<string, string> = {};
    for (let i = 0; i < cloudIDs.length; i++) {
      if (cachedUrls[i]) {
        urlMap[cloudIDs[i]] = cachedUrls[i];
      }
    }

    const updatedCats = (this.data as any)[listKey].map((cat: ICat) => ({
      ...cat,
      avatar: urlMap[cat.avatar] || cat.avatar,
    }));

    this.setData({ [listKey]: updatedCats });
  },

  /** 缓存待审核猫咪的所有照片 */
  async cachePendingPhotos(cats: ICat[]) {
    // 收集所有需要缓存的 cloud:// 图片（每只猫最多 3 张）
    const allCloudIDs: string[] = [];
    const catPhotoCounts: number[] = [];

    for (const cat of cats) {
      const photos = cat.photos || [];
      catPhotoCounts.push(photos.length);
      allCloudIDs.push(...photos);
    }

    if (allCloudIDs.length === 0) return;

    const cachedUrls = await getCachedImageUrls(allCloudIDs);

    // 映射回每只猫
    let offset = 0;
    const updatedCats = (this.data.pendingCats as any[]).map((cat, idx) => {
      const count = catPhotoCounts[idx] || 0;
      const cachedPhotos: string[] = [];
      for (let i = 0; i < count; i++) {
        cachedPhotos.push(cachedUrls[offset + i] || cat.photos[i]);
      }
      offset += count;
      return { ...cat, cachedPhotos };
    });

    this.setData({ pendingCats: updatedCats });
  },

  // ==================== 审核操作 ====================

  async onApprove(e: WechatMiniprogram.TouchEvent) {
    const { catId } = e.currentTarget.dataset;
    const confirmed = await showConfirm('确认审核通过这只猫咪吗？');
    if (!confirmed) return;

    const res = await apiAdminUpdateCat({ catId, action: 'approve' });

    if (res.code === 0) {
      showToast('已审核通过', 'success');
      this.loadData();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  async onReject(e: WechatMiniprogram.TouchEvent) {
    const { catId } = e.currentTarget.dataset;
    this.setData({
      showRejectModal: true,
      rejectTarget: { type: 'cat', id: catId },
      rejectReason: '',
    });
  },

  async onToggleAdopted(e: WechatMiniprogram.TouchEvent) {
    const { catId } = e.currentTarget.dataset;
    const res = await apiAdminUpdateCat({ catId, action: 'toggleAdopted' });

    if (res.code === 0) {
      showToast(res.data.adopted ? '已标记为已领养' : '已取消领养标记', 'success');
      // 就地更新列表中的猫咪数据，避免全量刷新
      const allCats = this.data.allCats.map((cat: ICat) => {
        if (cat._id === catId) {
          return { ...cat, adopted: res.data.adopted };
        }
        return cat;
      });
      this.setData({ allCats });
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  async onTogglePassedAway(e: WechatMiniprogram.TouchEvent) {
    const { catId } = e.currentTarget.dataset;
    const res = await apiAdminUpdateCat({ catId, action: 'togglePassedAway' });

    if (res.code === 0) {
      showToast(res.data.passedAway ? '已标记为去喵星' : '已取消去喵星标记', 'success');
      const allCats = this.data.allCats.map((cat: ICat) => {
        if (cat._id === catId) {
          return { ...cat, passedAway: res.data.passedAway };
        }
        return cat;
      });
      this.setData({ allCats });
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  async onToggleMissing(e: WechatMiniprogram.TouchEvent) {
    const { catId } = e.currentTarget.dataset;
    const res = await apiAdminUpdateCat({ catId, action: 'toggleMissing' });

    if (res.code === 0) {
      showToast(res.data.missing ? '已标记为失踪' : '已取消失踪标记', 'success');
      const allCats = this.data.allCats.map((cat: ICat) => {
        if (cat._id === catId) {
          return { ...cat, missing: res.data.missing };
        }
        return cat;
      });
      this.setData({ allCats });
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  async onDelete(e: WechatMiniprogram.TouchEvent) {
    const { catId } = e.currentTarget.dataset;
    const confirmed = await showConfirm(
      '删除后数据将无法恢复，确认删除吗？',
      '⚠️ 危险操作'
    );
    if (!confirmed) return;

    const res = await apiAdminUpdateCat({ catId, action: 'delete' });

    if (res.code === 0) {
      showToast('已删除', 'success');
      this.loadData();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  // ==================== 编辑审核 ====================

  async onApproveEdit(e: WechatMiniprogram.TouchEvent) {
    const { proposalId } = e.currentTarget.dataset;
    const confirmed = await showConfirm('确认通过此编辑吗？猫咪信息将被更新。');
    if (!confirmed) return;

    const res = await apiAdminUpdateCat({
      action: 'reviewEdit',
      proposalId,
      decision: 'approve',
    });

    if (res.code === 0) {
      showToast('编辑已通过', 'success');
      this.loadData();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  async onRejectEdit(e: WechatMiniprogram.TouchEvent) {
    const { proposalId } = e.currentTarget.dataset;
    this.setData({
      showRejectModal: true,
      rejectTarget: { type: 'edit', id: proposalId },
      rejectReason: '',
    });
  },

  // ==================== 记录审核 ====================

  /** 加载待审核记录 */
  async loadPendingRecords() {
    const res = await apiGetPendingRecords();
    if (res.code === 0) {
      const RECORD_TYPE_LABELS: Record<string, string> = {
        photo: '📸 新照片',
        note: '📝 便利贴',
      };
      const records = (res.data || []).map((r: any) => ({
        ...r,
        typeLabel: RECORD_TYPE_LABELS[r.type] || r.type,
        createTimeText: this.formatTime(r.createTime),
      }));
      this.setData({ pendingRecords: records });
    }
  },

  /** 通过记录 */
  async onApproveRecord(e: WechatMiniprogram.TouchEvent) {
    const { recordId } = e.currentTarget.dataset;
    const confirmed = await showConfirm('确认通过此记录吗？照片将追加到猫咪档案。');
    if (!confirmed) return;

    const res = await apiReviewRecord({ recordId, action: 'approve' });

    if (res.code === 0) {
      showToast('记录已通过', 'success');
      this.loadPendingRecords();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  /** 拒绝记录 */
  async onRejectRecord(e: WechatMiniprogram.TouchEvent) {
    const { recordId } = e.currentTarget.dataset;
    this.setData({
      showRejectModal: true,
      rejectTarget: { type: 'record', id: recordId },
      rejectReason: '',
    });
  },

  // ==================== 驳回弹窗 ====================

  onCloseRejectModal() {
    this.setData({ showRejectModal: false, rejectTarget: null, rejectReason: '' });
  },

  onRejectReasonInput(e: WechatMiniprogram.Input) {
    this.setData({ rejectReason: e.detail.value || '' });
  },

  async onConfirmReject() {
    const { rejectTarget, rejectReason } = this.data;
    if (!rejectTarget) return;

    try {
      if (rejectTarget.type === 'cat') {
        const res = await apiAdminUpdateCat({ catId: rejectTarget.id, action: 'reject', reason: rejectReason });
        if (res.code === 0) {
          showToast('已拒绝', 'success');
          this.loadData();
        } else {
          showToast(res.message || '操作失败', 'error');
        }
      } else if (rejectTarget.type === 'edit') {
        const res = await apiAdminUpdateCat({
          action: 'reviewEdit',
          proposalId: rejectTarget.id,
          decision: 'reject',
          reason: rejectReason,
        });
        if (res.code === 0) {
          showToast('编辑已拒绝', 'success');
          this.loadData();
        } else {
          showToast(res.message || '操作失败', 'error');
        }
      } else if (rejectTarget.type === 'record') {
        const res = await apiReviewRecord({ recordId: rejectTarget.id, action: 'reject', reason: rejectReason });
        if (res.code === 0) {
          showToast('记录已拒绝', 'success');
          this.loadPendingRecords();
        } else {
          showToast(res.message || '操作失败', 'error');
        }
      }
    } catch (err) {
      showToast('操作失败', 'error');
    }

    this.onCloseRejectModal();
  },

  /** 格式化时间 */
  formatTime(date: Date): string {
    if (!date) return '';
    const d = new Date(date);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  /** 预览照片 */
  onPreviewPhotos(e: WechatMiniprogram.TouchEvent) {
    const { url, urls } = e.currentTarget.dataset;
    wx.previewImage({ urls: urls || [url], current: url });
  },

  /** Tab 切换 */
  onTabChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ activeTab: e.detail.index || e.detail.name });
  },

  /** 空方法，阻止事件冒泡 */
  noop() {},

  onShareAppMessage() {
    return { title: '管理后台', path: '/pages/admin/admin' };
  },
});
