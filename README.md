# 🐱 深理猫谱 (SUATCat)

校园猫咪数字档案与互动平台 —— 发现、记录、分享校园里每一只猫咪的故事。

## ✨ 功能

- **猫咪档案** — 浏览校园猫咪图鉴，按毛色、性别、年龄筛选，搜索猫咪名字
- **发现猫咪** — 拍照上传发现新猫咪，填写基本信息提交审核
- **猫咪详情** — 查看猫咪完整档案：照片、信息、健康状态
- **发现记录** — 为已有猫咪上传新照片，记录相遇时刻
- **便利贴** — 给猫咪贴上文字便签，分享你的观察与心情
- **管理审核** — 管理员审批新猫咪、更新健康状态

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | 微信小程序原生 + TypeScript |
| UI 组件 | [Vant Weapp](https://vant-ui.github.io/vant-weapp/) |
| 后端 | 微信云开发 (CloudBase) |
| 数据库 | 云数据库 (NoSQL 文档型) |
| 存储 | 云存储 (图片上传) |
| 云函数 | Node.js + wx-server-sdk |

## 📁 项目结构

```
SUATCat/
├── miniprogram/               # 小程序前端
│   ├── app.ts                 # 入口：云开发初始化、登录
│   ├── app.json               # 路由配置、tabBar
│   ├── app.wxss               # 全局样式
│   ├── config/index.js        # 全局配置（环境ID、枚举、常量）
│   ├── utils/
│   │   ├── api.js             # 云函数调用封装
│   │   ├── constants.js       # 路由、存储键、云函数名
│   │   └── util.js            # 工具函数
│   ├── styles/theme.wxss      # 主题色彩、CSS 变量、工具类
│   ├── components/
│   │   └── cat-card/          # 猫咪卡片组件
│   ├── pages/
│   │   ├── index/             # 首页：Banner + 推荐猫咪 + 快捷入口
│   │   ├── cats/list/         # 档案列表：搜索 + 毛色/性别/年龄筛选
│   │   ├── cats/detail/       # 猫咪详情：照片、信息、健康、记录、便利贴
│   │   ├── cats/records/      # 记录/便利贴完整列表
│   │   ├── upload/            # 上传：新建猫咪 / 添加记录
│   │   ├── profile/           # 个人中心
│   │   └── admin/             # 管理审核面板
│   └── typings/index.d.ts     # TypeScript 类型定义
├── cloudfunctions/            # 云函数
│   ├── login/                 # 用户登录与自动注册
│   ├── getCats/               # 猫咪列表查询（分页、筛选、搜索）
│   ├── getCatDetail/          # 猫咪详情 + 关联记录
│   ├── addCat/                # 新建猫咪档案
│   ├── uploadRecord/          # 上传发现记录 / 便利贴
│   └── adminUpdateCat/        # 管理员审批、更新、删除
├── tsconfig.json
└── project.config.json        # 微信开发者工具配置
```

## 🎨 设计

温暖治愈的校园风格，配色以薄荷绿 `#7EC8A8` 为主色调，搭配奶油米黄 `#FFF8EC` 背景与暖橙 `#F2A65A` 点缀，卡片式布局、圆角、柔和阴影。

## 🚀 本地开发

1. 克隆项目，用**微信开发者工具**打开根目录
2. 在 `miniprogram/config/index.js` 中填写你的云环境 ID
3. 终端进入 `miniprogram/`，执行 `npm install`
4. 在开发者工具中：**工具 → 构建 npm**
5. 右键 `cloudfunctions/` 下每个云函数目录，选择**上传并部署**

## 📦 云开发

### 数据库集合

| 集合 | 说明 |
|------|------|
| `users` | 用户信息（openid、昵称、角色） |
| `cats` | 猫咪档案（名字、照片、毛色、年龄、性别、健康、状态、位置） |
| `records` | 发现记录 & 便利贴（猫咪关联、照片、内容、发布者） |

### 用户角色

- `student`（默认）— 浏览、上传、记录、写便利贴
- `admin` — 以上全部 + 审核猫咪、更新健康状态

手动在 `users` 集合中将 `role` 字段设为 `"admin"` 即可获得管理权限。

## 📝 猫咪状态流转

```
用户提交 → pending（待审核）
              ↓
     admin approve → approved（已通过，公开可见）
     admin reject  → rejected（已拒绝）
```

## 🔮 未来规划

- AI 猫咪识别（FastAPI + PyTorch 后端对接）
- 生成分享海报
- 猫咪关系图谱
