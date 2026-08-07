/**
 * updateCatRelationship 云函数 — 管理猫咪关系
 *
 * 支持：
 * - add: 添加关系
 * - remove: 删除关系
 *
 * 无需管理员权限，所有登录用户均可操作
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, success, fail, getCollection } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return fail('请先登录', -401);
  }

  const { action } = event;

  if (!action || !['add', 'remove'].includes(action)) {
    return fail('无效的操作类型，支持：add / remove');
  }

  try {
    switch (action) {

      // ==================== 添加关系 ====================
      case 'add': {
        const { catId, otherCatId, type, description, parentIsCurrent } = event;

        // 参数校验
        if (!catId || !otherCatId || !type) {
          return fail('缺少必要参数：catId, otherCatId, type');
        }

        const validTypes = ['parent_child', 'sibling', 'mate', 'ex_mate', 'friend', 'rival', 'other'];
        if (!validTypes.includes(type)) {
          return fail('无效的关系类型');
        }

        // 不能和自己建立关系
        if (catId === otherCatId) {
          return fail('不能和自己建立关系');
        }

        // other 类型必须填写描述
        if (type === 'other' && (!description || !description.trim())) {
          return fail('"其他"关系需要填写描述');
        }

        const relationshipsColl = getCollection(COLLECTIONS.RELATIONSHIPS);
        const now = new Date();

        // 确定 catId1 和 catId2
        let relCatId1, relCatId2;
        if (type === 'parent_child') {
          // parent_child: catId1 = 父母方, catId2 = 子女方
          if (parentIsCurrent) {
            relCatId1 = catId;
            relCatId2 = otherCatId;
          } else {
            relCatId1 = otherCatId;
            relCatId2 = catId;
          }
        } else {
          // 对称类型：按 _id 字母序排列
          if (catId < otherCatId) {
            relCatId1 = catId;
            relCatId2 = otherCatId;
          } else {
            relCatId1 = otherCatId;
            relCatId2 = catId;
          }
        }

        // 检查是否已存在同一对猫咪的同一类型关系
        const existRes = await relationshipsColl
          .where({ catId1: relCatId1, catId2: relCatId2, type })
          .limit(1)
          .get();

        if (existRes.data.length > 0) {
          return fail('这两个猫咪之间已有此关系');
        }

        // 确认两只猫咪都存在
        const catsColl = getCollection(COLLECTIONS.CATS);
        const cat1Res = await catsColl.doc(relCatId1).get();
        const cat2Res = await catsColl.doc(relCatId2).get();
        if (!cat1Res.data || !cat2Res.data) {
          return fail('猫咪不存在');
        }

        // 插入关系文档
        const doc = {
          catId1: relCatId1,
          catId2: relCatId2,
          type,
          description: description ? description.trim() : '',
          createTime: now,
          updateTime: now,
        };

        const addRes = await relationshipsColl.add({ data: doc });
        doc._id = addRes._id;

        console.log('[updateCatRelationship] 关系已添加:', addRes._id, relCatId1, '<=>', relCatId2, type);
        return success(doc, '关系已添加');
      }

      // ==================== 删除关系 ====================
      case 'remove': {
        const { relationshipId } = event;

        if (!relationshipId) {
          return fail('缺少关系ID');
        }

        const relationshipsColl = getCollection(COLLECTIONS.RELATIONSHIPS);

        // 确认关系存在
        const relRes = await relationshipsColl.doc(relationshipId).get();
        if (!relRes.data) {
          return fail('关系不存在');
        }

        await relationshipsColl.doc(relationshipId).remove();

        console.log('[updateCatRelationship] 关系已删除:', relationshipId);
        return success(null, '关系已删除');
      }

      default:
        return fail('未知操作');
    }

  } catch (err) {
    console.error('[updateCatRelationship] 异常:', err);
    return fail('操作失败：' + err.message);
  }
};
