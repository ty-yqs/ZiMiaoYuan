/**
 * getCats 云函数 — 获取猫咪列表
 *
 * 支持：分页、毛色筛选、性别筛选、关键词搜索
 * 仅返回已审核通过的猫咪
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, CAT_STATUS, success, fail, paginatedQuery, getCollection } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const {
    page = 1,
    pageSize = 10,
    color = '',
    gender = '',
    age = '',
    keyword = '',
    status = '', // 管理员可传 'pending' 等
    sortBy = 'createTime',
    sortOrder = 'desc',
    resolveUser = false, // 是否解析提交者昵称
  } = event;

  try {
    // 构建查询条件
    const where = {};

    // status 筛选逻辑：
    // - 不传 → 默认只返回已审核通过的
    // - 'all' → 不筛选状态，返回所有
    // - 'pending'/'approved'/'rejected' → 筛选对应状态
    if (status && status !== 'all') {
      where.status = status;
    } else if (!status) {
      where.status = CAT_STATUS.APPROVED;
    }
    // status === 'all' 时不添加 status 条件

    if (color) {
      where.color = color;
    }

    if (gender) {
      where.gender = gender;
    }

    if (age) {
      where.age = age;
    }

    // 关键词搜索：匹配名字或毛色
    if (keyword) {
      // 云数据库支持正则模糊查询
      where.cat_name = cloud.database().RegExp({
        regexp: keyword,
        options: 'i',
      });
    }

    const result = await paginatedQuery(COLLECTIONS.CATS, {
      where,
      page: Math.max(1, parseInt(page) || 1),
      pageSize: Math.min(50, parseInt(pageSize) || 10),
      orderBy: sortBy,
      order: sortOrder,
    });

    // 解析提交者昵称
    let cats = result.list;
    if (resolveUser) {
      const openids = [...new Set(cats.map(c => c._openid).filter(Boolean))];
      const userMap: Record<string, string> = {};

      if (openids.length > 0) {
        const _ = cloud.database().command;
        const usersRes = await getCollection(COLLECTIONS.USERS)
          .where({ _openid: _.in(openids) })
          .field({ _openid: true, nickname: true })
          .get();

        for (const u of usersRes.data) {
          userMap[u._openid] = u.nickname || '未知用户';
        }
      }

      cats = cats.map(c => ({
        ...c,
        submitterNickname: userMap[c._openid] || '未知用户',
      }));
    }

    return success({
      cats,
      cats: result.list,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    });

  } catch (err) {
    console.error('[getCats] 异常:', err);
    return fail('查询失败：' + err.message);
  }
};
