/**
 * 枚举字段的中文映射与格式化工具
 */
export const AGE_LABEL: Record<string, string> = {
  kitten: '幼猫',
  adult: '成年猫',
  elderly: '老年猫',
  unknown: '未知',
};

export const GENDER_LABEL: Record<string, string> = {
  male: '公猫',
  female: '母猫',
  unknown: '未知',
};

export const REL_TYPE_LABEL: Record<string, string> = {
  parent_child: '亲子',
  sibling: '兄弟姐妹',
  mate: '伴侣',
  ex_mate: '前伴侣',
  friend: '好朋友',
  rival: '对头',
  other: '其他',
};

export const RECORD_TYPE_LABEL: Record<string, string> = {
  photo: '照片',
  note: '便利贴',
};

export function formatTime(t: any): string {
  if (!t) return '';
  const d = new Date(t);
  if (isNaN(d.getTime())) return String(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
