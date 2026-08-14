/**
 * getRecords 云函数 — 管理员分页获取记录列表
 *
 * 支持按状态筛选：status 可传 'pending' | 'approved' | 'rejected' | 'all'（默认 all）
 * 返回记录时关联猫咪名称，并兼容旧记录把单张 photo 转为 photos 数组。
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS, success, fail, getCollection, requireAdmin,
} = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  // 权限校验：仅管理员
  const admin = await requireAdmin(event);
  if (!admin) {
    return fail('权限不足，仅管理员可操作', -403);
  }

  const { status = 'all', page = 1, pageSize = 20 } = event;

  try {
    const where = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const coll = getCollection(COLLECTIONS.RECORDS);

    // 总数
    const countRes = await coll.where(where).count();
    const total = countRes.total;

    // 分页查询
    const listRes = await coll
      .where(where)
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    // 关联猫咪名称
    const catIds = [...new Set(listRes.data.map(r => r.catId).filter(Boolean))];
    const catNameMap = {};
    if (catIds.length > 0) {
      const _ = cloud.database().command;
      const catsRes = await getCollection(COLLECTIONS.CATS)
        .where({ _id: _.in(catIds) })
        .field({ cat_name: true })
        .get();

      for (const cat of catsRes.data) {
        catNameMap[cat._id] = cat.cat_name || '未命名猫咪';
      }
    }

    const records = listRes.data.map(r => ({
      ...r,
      catName: catNameMap[r.catId] || '未知猫咪',
      photos: r.photos || (r.photo ? [r.photo] : []),
    }));

    return success({
      records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });

  } catch (err) {
    console.error('[getRecords] 异常:', err);
    return fail('查询失败：' + err.message);
  }
};
