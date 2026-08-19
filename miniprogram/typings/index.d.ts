/**
 * 紫喵园 - 全局类型定义
 */

// ==================== 用户相关 ====================

/** 用户角色 */
type UserRole = 'student' | 'admin';

/** 用户信息 */
interface IUser {
  _id: string;
  _openid: string;
  nickname: string;
  avatar: string;
  role: UserRole;
  createTime: Date;
}

// ==================== 猫咪相关 ====================

/** 猫咪性别 */
type CatGender = 'male' | 'female' | 'unknown';

/** 猫咪年龄段 */
type CatAge = 'kitten' | 'adult' | 'elderly' | 'unknown';

/** 审核状态 */
type CatStatus = 'pending' | 'approved' | 'rejected';

/** 猫咪档案 */
interface ICat {
  _id: string;
  cat_name: string;           // 猫咪名字
  photos: string[];           // cloud:// fileID 数组
  avatar: string;             // cloud:// fileID
  gender: CatGender;
  age: CatAge;
  color: string;              // 毛色描述
  description: string;
  location: {
    name: string;             // 地点名称
    latitude: number;
    longitude: number;
  };
  health: {
    sterilized: boolean;
    vaccinated: boolean;
  };
  adopted?: boolean;           // 是否已被领养
  passedAway?: boolean;        // 是否去喵星
  missing?: boolean;           // 是否失踪
  status: CatStatus;
  creator: string;            // 上传者 openid
  ratingAvg?: number | null;  // 亲人指数平均分
  ratingCount?: number;       // 评分人数
  createTime: Date;
  updateTime: Date;
}

// ==================== 发现记录相关 ====================

/** 发现记录 */
interface IRecord {
  _id: string;
  catId: string;              // 关联猫咪 _id
  userId: string;             // 发现者 openid
  nickname?: string;          // 发布者昵称
  type?: 'photo' | 'note';    // 记录类型
  photo: string;              // cloud:// fileID
  location: {
    name: string;
    latitude: number;
    longitude: number;
  };
  description: string;
  createTime: Date;
}

// ==================== 地理位置 ====================

interface ILatLng {
  latitude: number;
  longitude: number;
}

// ==================== 云函数返回 ====================

interface ICloudResult<T = any> {
  code: number;               // 0=成功, 非0=失败
  message: string;
  data: T;
}

// ==================== 全局 App 类型 ====================

interface IAppOption {
  globalData: {
    env: string;              // 云环境ID
    userInfo?: IUser;
    isAdmin: boolean;
    needRefreshDetail?: boolean; // 是否需要刷新详情页
    skipProfileCheck?: boolean;  // 登录页“暂不设置”后跳过本次个人中心校验
  };
  checkLoginStatus: () => Promise<IUser | null>;
}

// ==================== 猫咪关系 ====================

/** 关系类型 */
type RelationType = 'parent_child' | 'sibling' | 'mate' | 'ex_mate' | 'friend' | 'rival' | 'other';

/** 猫咪关系（数据库原始文档） */
interface IRelationshipRaw {
  _id: string;
  catId1: string;            // parent_child: 父母方；对称类型: 按 _id 字典序
  catId2: string;            // parent_child: 子女方；对称类型: 按 _id 字典序
  type: RelationType;
  description?: string;
  createTime: Date;
  updateTime: Date;
}

/** 猫咪关系（前端展示用，已填充对方猫咪信息） */
interface IRelationship {
  _id: string;
  otherCat: {
    _id: string;
    cat_name: string;
    avatar: string;
    gender: CatGender;
  };
  type: RelationType;
  label: string;             // 关系标签，双方显示相同（如 "母女"、"兄弟"、"伴侣"）
  description?: string;
}

// ==================== 评分相关 ====================

/** 用户评分记录 */
interface IRating {
  _id?: string;
  catId: string;
  rating: number;             // 1-5 星
  createTime: Date;
  updateTime: Date;
}

// ==================== 编辑提案 ====================

/** 编辑提案状态 */
type EditProposalStatus = 'pending' | 'approved' | 'rejected';

/** 编辑提案 */
interface IEditProposal {
  _id: string;
  catId: string;
  userId: string;
  nickname: string;
  proposedChanges: Partial<Pick<ICat, 'cat_name' | 'color' | 'gender' | 'age' | 'description'>>;
  status: EditProposalStatus;
  adminNote?: string;
  createTime: Date;
  updateTime: Date;
}

// ==================== 页面通用的 data 类型 ====================

interface IPageData {
  loading: boolean;
  error: string;
}
