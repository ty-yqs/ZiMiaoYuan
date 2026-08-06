/**
 * proposeEdit 云函数 — 用户提交编辑提案
 *
 * 流程：
 * 1. 获取用户 openid
 * 2. 校验 catId 和允许的编辑字段
 * 3. 检查是否已有待审核的提案
 * 4. 创建编辑提案（status: pending）
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS, success, fail, getCollection,
} = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 用户可编辑的字段
const EDITABLE_FIELDS = ['cat_name', 'color', 'gender', 'age', 'description', 'health'];

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return fail('请先登录');
  }

  const { catId, updates = {} } = event;

  if (!catId) {
    return fail('缺少猫咪ID');
  }

  // 只允许编辑指定字段
  const proposedChanges = {};
  for (const field of EDITABLE_FIELDS) {
    if (updates[field] !== undefined) {
      proposedChanges[field] = updates[field];
    }
  }

  if (Object.keys(proposedChanges).length === 0) {
    return fail('没有可提交的修改');
  }

  try {
    // 确认猫咪存在
    const catRes = await getCollection(COLLECTIONS.CATS).doc(catId).get();
    if (!catRes.data) {
      return fail('猫咪不存在');
    }

    // 检查是否已有待审核的提案
    const pendingRes = await getCollection(COLLECTIONS.EDIT_PROPOSALS)
      .where({
        catId,
        status: 'pending',
      })
      .limit(1)
      .get();

    if (pendingRes.data.length > 0) {
      return fail('该猫咪已有待审核的编辑，请等待管理员处理');
    }

    // 查询用户昵称
    let nickname = '匿名猫友';
    try {
      const userRes = await getCollection(COLLECTIONS.USERS)
        .where({ _openid: OPENID })
        .limit(1)
        .get();
      if (userRes.data && userRes.data.length > 0 && userRes.data[0].nickname) {
        nickname = userRes.data[0].nickname;
      }
    } catch (e) {
      // 查不到用户就用默认昵称
    }

    const now = new Date();

    const proposal = {
      catId,
      userId: OPENID,
      nickname,
      proposedChanges,
      status: 'pending',
      createTime: now,
      updateTime: now,
    };

    const addRes = await getCollection(COLLECTIONS.EDIT_PROPOSALS).add({ data: proposal });
    proposal._id = addRes._id;

    console.log('[proposeEdit] 编辑提案已创建:', addRes._id, '猫咪:', catId);
    return success(proposal, '编辑已提交，等待管理员审核');

  } catch (err) {
    console.error('[proposeEdit] 异常:', err);
    return fail('提交失败：' + err.message);
  }
};
