/**
 * 深理猫谱 - 全局类型定义
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
  status: CatStatus;
  creator: string;            // 上传者 openid
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
  };
  checkLoginStatus: () => Promise<IUser | null>;
}

// ==================== 页面通用的 data 类型 ====================

interface IPageData {
  loading: boolean;
  error: string;
}
