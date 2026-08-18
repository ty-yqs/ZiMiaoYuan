/**
 * manageBanners 云函数 — 管理员管理首页轮播头图
 *
 * 支持：
 * - list:   列出全部头图（含禁用），按 sort 升序
 * - add:    新增头图（image / link / sort / enabled）
 * - edit:   编辑头图（image / link / sort / enabled）
 * - delete: 删除头图
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS, success, fail, getCollection, requireAdmin,
} = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ACTIONS = ['list', 'add', 'edit', 'delete'];

exports.main = async (event) => {
  const admin = await requireAdmin(event);
  if (!admin) {
    return fail('权限不足，仅管理员可操作', -403);
  }

  const { action } = event;

  if (!ACTIONS.includes(action)) {
    return fail('无效的操作类型，支持：' + ACTIONS.join(' / '));
  }

  try {
    const bannersColl = getCollection(COLLECTIONS.BANNERS);

    if (action === 'list') {
      const res = await bannersColl
        .orderBy('sort', 'asc')
        .orderBy('createTime', 'asc')
        .limit(100)
        .get();
      return success(res.data);
    }

    if (action === 'add') {
      const { image, link = '', sort = 0, enabled = true, articleId = '' } = event;

      const fileId = String(image || '').trim();
      if (!fileId) {
        return fail('请上传头图');
      }

      const data = {
        image: fileId,
        link: String(link || '').trim(),
        articleId: String(articleId || '').trim(),
        sort: Number(sort) || 0,
        enabled: enabled !== false,
        createTime: new Date(),
      };

      const addRes = await bannersColl.add({ data });
      data._id = addRes._id;

      console.log('[manageBanners] 新增头图:', addRes._id);
      return success(data, '头图已添加');
    }

    if (action === 'edit') {
      const { bannerId, image, link, sort, enabled, articleId } = event;
      if (!bannerId) {
        return fail('缺少头图ID');
      }

      const bannerRes = await bannersColl.doc(bannerId).get();
      if (!bannerRes.data) {
        return fail('头图不存在');
      }

      const updateData = {};

      if (image !== undefined && image !== null) {
        const fileId = String(image).trim();
        if (!fileId) {
          return fail('请上传头图');
        }
        updateData.image = fileId;
      }

      if (link !== undefined && link !== null) {
        updateData.link = String(link).trim();
      }

      if (articleId !== undefined && articleId !== null) {
        updateData.articleId = String(articleId).trim();
      }

      if (sort !== undefined && sort !== null) {
        updateData.sort = Number(sort) || 0;
      }

      if (enabled !== undefined && enabled !== null) {
        updateData.enabled = enabled !== false;
      }

      if (Object.keys(updateData).length === 0) {
        return fail('没有可更新的内容');
      }

      updateData.updateTime = new Date();
      await bannersColl.doc(bannerId).update({ data: updateData });
      console.log('[manageBanners] 头图已编辑:', bannerId, Object.keys(updateData));
      return success(null, '头图已更新');
    }

    if (action === 'delete') {
      const { bannerId } = event;
      if (!bannerId) {
        return fail('缺少头图ID');
      }
      await bannersColl.doc(bannerId).remove();
      console.log('[manageBanners] 已删除头图:', bannerId);
      return success(null, '已删除');
    }

  } catch (err) {
    console.error('[manageBanners] 异常:', err);
    return fail('操作失败：' + err.message);
  }
};
