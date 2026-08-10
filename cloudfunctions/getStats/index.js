/**
 * getStats 云函数 — 获取全局统计 & 记录当日访问
 *
 * 返回：
 * - catCount:        在册猫咪总数（已审核）
 * - sterilizedCount: 已绝育数量
 * - vaccinatedCount: 已打疫苗数量
 * - catsByColor:     毛色分布 [{name, count}]
 * - catsByGender:    性别分布 [{name, count}]
 * - catsByAge:       年龄段分布 [{name, count}]
 * - recordCount:     总记录数
 * - todayVisits:     当日访问量
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, CAT_STATUS, success, fail, getCollection, getDB } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  try {
    const _ = getDB().command;

    // 活跃猫咪：已审核 且 未被领养/去喵星/失踪
    const activeWhere = {
      status: CAT_STATUS.APPROVED,
      adopted: _.neq(true),
      passedAway: _.neq(true),
      missing: _.neq(true),
    };

    // ==================== 并行查询所有基础统计 ====================
    const [
      catTotalRes,
      sterilizedRes,
      vaccinatedRes,
      allCatsRes,
      adoptedRes,
      passedAwayRes,
      missingRes,
    ] = await Promise.all([
      getCollection(COLLECTIONS.CATS).where(activeWhere).count(),
      getCollection(COLLECTIONS.CATS).where({ ...activeWhere, 'health.sterilized': true }).count(),
      getCollection(COLLECTIONS.CATS).where({ ...activeWhere, 'health.vaccinated': true }).count(),
      getCollection(COLLECTIONS.CATS).where(activeWhere).field({ color: true, gender: true, age: true, cat_name: true }).get(),
      getCollection(COLLECTIONS.CATS).where({ adopted: true }).count(),
      getCollection(COLLECTIONS.CATS).where({ passedAway: true }).count(),
      getCollection(COLLECTIONS.CATS).where({ missing: true }).count(),
    ]);

    // 记录数：统计所有已审核的记录
    const recordTotalRes = await getCollection(COLLECTIONS.RECORDS)
      .where({ status: 'approved' })
      .count();

    // ==================== 计算分布 ====================
    const cats = allCatsRes.data;

    // 毛色分布
    const colorMap = {};
    cats.forEach(c => { const k = c.color || '未知'; colorMap[k] = (colorMap[k] || 0) + 1; });

    // 性别分布
    const genderMap = { male: 0, female: 0, unknown: 0 };
    cats.forEach(c => { const k = c.gender || 'unknown'; genderMap[k] = (genderMap[k] || 0) + 1; });

    // 年龄分布
    const ageMap = {};
    cats.forEach(c => { const k = c.age || 'unknown'; ageMap[k] = (ageMap[k] || 0) + 1; });

    // 命名率：有名字的猫咪（排除空名和默认名）
    const namedCount = cats.filter(c => c.cat_name && c.cat_name.trim() && c.cat_name !== '未命名猫咪').length;

    // ==================== 当日访问量（仅读取，集合可能还不存在） ====================
    let todayVisits = 0;
    try {
      // 使用北京时间 (UTC+8)
      const now = new Date();
      const today = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const visitsColl = getCollection(COLLECTIONS.DAILY_VISITS);
      const visitRes = await visitsColl.where({ date: dateStr }).limit(1).get();

      if (visitRes.data.length > 0) {
        todayVisits = visitRes.data[0].count;
      }
    } catch (e) {
      // dailyVisits 集合尚未创建（trackVisit 还没被调用过），忽略
      console.warn('[getStats] 获取当日访问量失败（集合可能未创建）:', e.message);
    }

    // ==================== 整理返回 ====================
    const catCount = catTotalRes.total;

    // 辅助：排序分布
    const sortByCount = (map) =>
      Object.entries(map)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    return success({
      catCount,
      sterilizedCount: sterilizedRes.total,
      vaccinatedCount: vaccinatedRes.total,
      namedCount,
      sterilizationRate: catCount > 0 ? Math.round((sterilizedRes.total / catCount) * 100) : 0,
      vaccinationRate: catCount > 0 ? Math.round((vaccinatedRes.total / catCount) * 100) : 0,
      namingRate: catCount > 0 ? Math.round((namedCount / catCount) * 100) : 0,
      catsByColor: sortByCount(colorMap),
      catsByGender: [
        { name: '公猫', count: genderMap.male || 0 },
        { name: '母猫', count: genderMap.female || 0 },
        { name: '未知', count: genderMap.unknown || 0 },
      ].filter(g => g.count > 0 || true), // 保留所有性别项
      catsByAge: sortByCount(ageMap),
      recordCount: recordTotalRes.total,
      todayVisits,
      adoptedCount: adoptedRes.total,
      passedAwayCount: passedAwayRes.total,
      missingCount: missingRes.total,
    });

  } catch (err) {
    console.error('[getStats] 异常:', err);
    return fail('查询失败：' + err.message);
  }
};
