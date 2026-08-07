/**
 * trackVisit 云函数 — 记录当日小程序访问
 *
 * 在 app.onLaunch 中调用，每次启动计数 +1
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, success, fail, getCollection } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const _ = cloud.database().command;

exports.main = async (event, context) => {
  try {
    // 使用北京时间 (UTC+8)
    const now = new Date();
    const today = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const visitsColl = getCollection(COLLECTIONS.DAILY_VISITS);
    const visitRes = await visitsColl.where({ date: dateStr }).limit(1).get();

    if (visitRes.data.length > 0) {
      await visitsColl.doc(visitRes.data[0]._id).update({
        data: { count: _.inc(1) },
      });
      return success({ todayVisits: visitRes.data[0].count + 1 });
    } else {
      await visitsColl.add({ data: { date: dateStr, count: 1 } });
      return success({ todayVisits: 1 });
    }

  } catch (err) {
    console.error('[trackVisit] 异常:', err);
    return fail('记录失败：' + err.message);
  }
};
