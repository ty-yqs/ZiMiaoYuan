/**
 * 根据关系类型和双方性别生成关系标签
 * @param {string} type - 关系类型
 * @param {string} parentGender - parent_child: 父母方性别
 * @param {string} childGender - parent_child: 子女方性别
 * @param {string} gender1 - 猫1性别（对称类型使用）
 * @param {string} gender2 - 猫2性别（对称类型使用）
 */
function getLabel(type, parentGender, childGender, gender1, gender2) {
  switch (type) {
    case 'parent_child': {
      // 基于双方性别组合显示，不区分角色
      if (parentGender === 'female' && childGender === 'female') return '母女';
      if (parentGender === 'male' && childGender === 'male') return '父子';
      if (parentGender === 'female' && childGender === 'male') return '母子';
      if (parentGender === 'male' && childGender === 'female') return '父女';
      return '亲子';
    }
    case 'sibling': {
      const g1 = gender1;
      const g2 = gender2;
      if (g1 === 'male' && g2 === 'male') return '兄弟';
      if (g1 === 'female' && g2 === 'female') return '姐妹';
      if ((g1 === 'male' && g2 === 'female') || (g1 === 'female' && g2 === 'male')) return '兄妹';
      return '兄弟姐妹';
    }
    case 'mate':   return '伴侣';
    case 'ex_mate': return '前伴侣';
    case 'friend': return '好朋友';
    case 'rival':  return '对头';
    case 'other':  return '其他';
    default:       return '关联';
  }
}

/**
 * getCatDetail 云函数 — 获取猫咪详情 + 关联发现记录
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, success, fail, getCollection, getDB, getAppSettings, isGuestUser } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { catId } = event;

  if (!catId) {
    return fail('缺少猫咪ID');
  }

  try {
    // 查询猫咪档案
    const catRes = await getCollection(COLLECTIONS.CATS)
      .doc(catId)
      .get();

    if (!catRes.data || catRes.data.length === 0) {
      return fail('猫咪不存在');
    }

    const cat = catRes.data;

    // 读取功能开关（游客不可见时整体隐藏记录与便利贴）
    const settings = await getAppSettings();
    const { OPENID } = cloud.getWXContext();
    const isGuest = await isGuestUser(OPENID);
    const guestAllowed = !isGuest || settings.guestBrowseOpen;
    const recordsOpen = settings.recordsOpen !== false && guestAllowed;
    const notesOpen = settings.notesOpen !== false && guestAllowed;
    const detailActionsOpen = settings.detailActionsOpen !== false;
    const ratingOpen = settings.ratingOpen !== false;
    const ratingPublicOpen = settings.ratingPublicOpen !== false;

    // 查询关联的发现记录（按时间倒序，仅展示审核通过的）
    const _ = cloud.database().command;
    const recordsRes = await getCollection(COLLECTIONS.RECORDS)
      .where({ catId, status: 'approved' })
      .orderBy('createTime', 'desc')
      .limit(50)
      .get();

    // 按开关过滤记录：便利贴 type === 'note'，其余为发现记录
    let records = recordsRes.data || [];
    if (!recordsOpen && !notesOpen) {
      records = [];
    } else if (!recordsOpen) {
      records = records.filter(r => r.type === 'note');
    } else if (!notesOpen) {
      records = records.filter(r => !r.type || r.type !== 'note');
    }

    // 查询当前用户对该猫的评分（OPENID 已在上方获取）
    let myRating = 0;
    if (OPENID) {
      const ratingRes = await getCollection(COLLECTIONS.RATINGS)
        .where({ catId, _openid: OPENID })
        .limit(1)
        .get();
      if (ratingRes.data.length > 0) {
        myRating = ratingRes.data[0].rating;
      }
    }

    // 查询猫咪关系，并填充对方猫咪信息
    // _ 已在上方声明
    const relRes = await getCollection(COLLECTIONS.RELATIONSHIPS)
      .where(_.or([{ catId1: catId }, { catId2: catId }]))
      .orderBy('createTime', 'desc')
      .get();

    const relationships = [];
    if (relRes.data.length > 0) {
      // 收集所有对方猫咪 ID
      const otherCatIds = relRes.data.map(r =>
        r.catId1 === catId ? r.catId2 : r.catId1
      );

      // 批量获取对方猫咪基本信息
      const otherCatsRes = await getCollection(COLLECTIONS.CATS)
        .where({ _id: _.in(otherCatIds) })
        .field({ cat_name: true, avatar: true, gender: true })
        .get();

      const catMap = {};
      otherCatsRes.data.forEach(c => { catMap[c._id] = c; });
      // 也要把当前猫放进 map，parent_child 标签需要判断双方性别
      catMap[cat._id] = cat;

      // 组装展示数据
      for (const rel of relRes.data) {
        const isCat1 = catId === rel.catId1;
        const otherId = isCat1 ? rel.catId2 : rel.catId1;
        const otherCat = catMap[otherId];

        if (!otherCat) continue; // 跳过已删除的猫咪

        let label;
        if (rel.type === 'parent_child') {
          // catId1 = 父母方, catId2 = 子女方
          const parentGender = catMap[rel.catId1] ? catMap[rel.catId1].gender : 'unknown';
          const childGender = catMap[rel.catId2] ? catMap[rel.catId2].gender : 'unknown';
          label = getLabel(rel.type, parentGender, childGender, parentGender, childGender);
        } else {
          // 对称类型
          const gender1 = catMap[rel.catId1] ? catMap[rel.catId1].gender : 'unknown';
          const gender2 = catMap[rel.catId2] ? catMap[rel.catId2].gender : 'unknown';
          label = getLabel(rel.type, null, null, gender1, gender2);
        }

        relationships.push({
          _id: rel._id,
          type: rel.type,
          otherCat: {
            _id: otherCat._id,
            cat_name: otherCat.cat_name,
            avatar: otherCat.avatar,
            gender: otherCat.gender,
          },
          label,
          description: rel.description || '',
        });
      }
    }

    return success({
      cat,
      records,
      recordCount: records.length,
      myRating,
      relationships,
      settings: { recordsOpen, notesOpen, detailActionsOpen, ratingOpen, ratingPublicOpen },
    });

  } catch (err) {
    console.error('[getCatDetail] 异常:', err);
    return fail('查询失败：' + err.message);
  }
};
