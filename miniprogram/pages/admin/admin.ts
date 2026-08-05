/**
 * 管理员后台
 *
 * 功能：
 * - 审核待审批的猫咪 (pending → approved / rejected)
 * - 修改猫咪信息
 * - 删除错误数据
 */
import { apiGetCats, apiAdminUpdateCat } from '../../utils/api';
import { showToast, showConfirm } from '../../utils/util';

const app = getApp<IAppOption>();

Page({
  data: {
    // 权限检查
    isAdmin: false,

    // 标签页
    activeTab: 0,

    // 待审核列表
    pendingCats: [] as ICat[],

    // 所有猫咪
    allCats: [] as ICat[],

    loading: true,
    error: '',
  },

  onLoad() {
    // 检查管理员权限
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
    const pendingRes = await apiGetCats({ status: 'pending', pageSize: 50 });
    if (pendingRes.code === 0) {
      this.setData({ pendingCats: pendingRes.data.cats || [] });
    }

    // 加载全部猫咪
    const allRes = await apiGetCats({ status: 'all', pageSize: 50 });
    if (allRes.code === 0) {
      this.setData({ allCats: allRes.data.cats || [] });
    }

    this.setData({ loading: false });
  },

  // ==================== 审核操作 ====================

  /** 审核通过 */
  async onApprove(e: WechatMiniprogram.TouchEvent) {
    const { catId } = e.currentTarget.dataset;
    const confirmed = await showConfirm('确认审核通过这只猫咪吗？');
    if (!confirmed) return;

    const res = await apiAdminUpdateCat({
      catId,
      action: 'approve',
    });

    if (res.code === 0) {
      showToast('已审核通过', 'success');
      this.loadData();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  /** 审核拒绝 */
  async onReject(e: WechatMiniprogram.TouchEvent) {
    const { catId } = e.currentTarget.dataset;
    const confirmed = await showConfirm('确认拒绝吗？该猫咪将不会显示在列表中。');
    if (!confirmed) return;

    const res = await apiAdminUpdateCat({
      catId,
      action: 'reject',
    });

    if (res.code === 0) {
      showToast('已拒绝', 'success');
      this.loadData();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  /** 删除猫咪 */
  async onDelete(e: WechatMiniprogram.TouchEvent) {
    const { catId } = e.currentTarget.dataset;
    const confirmed = await showConfirm(
      '删除后数据将无法恢复，确认删除吗？',
      '⚠️ 危险操作'
    );
    if (!confirmed) return;

    const res = await apiAdminUpdateCat({
      catId,
      action: 'delete',
    });

    if (res.code === 0) {
      showToast('已删除', 'success');
      this.loadData();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  /** Tab 切换 */
  onTabChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ activeTab: e.detail.index || e.detail.name });
  },
});
