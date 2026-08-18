# 紫喵园 · 网页管理后台

与小程序共用同一套云开发数据库的独立网页后台，用浏览器管理猫咪审核、编辑提案、记录审核、猫咪内容编辑、记录管理、用户管理、赞助管理、子管理员管理与数据看板。

- 前端：Vue3 + Vite + Element Plus + vue-router（hash 路由）
- 认证：账号密码 + token（独立于小程序用户体系，见下方说明）
- 部署：CloudBase 静态托管

## 为什么需要新的认证方式

小程序云函数靠 `cloud.getWXContext().OPENID` 判断管理员，但浏览器里没有微信上下文、拿不到 openid。所以后台新增了 token 认证：管理员账号存在独立的 `admins` 集合，登录后返回 token，网页端每次调用云函数都带上 token。

## 目录结构

```
web-admin/
├── src/
│   ├── main.ts              # 初始化 cloudbase + 路由 + Element Plus
│   ├── router.ts            # hash 路由 + 登录守卫
│   ├── api.ts               # callFunction 封装（匿名登录 + 注入 token）
│   ├── auth.ts              # token 的 localStorage 存取
│   ├── imageCache.ts        # cloud:// fileID → 临时 https 链接（模块级缓存）
│   ├── labels.ts            # 枚举字段中文映射 + 时间格式化
│   ├── components/CloudImage.vue
│   └── views/
│       ├── Login.vue        # 登录
│       ├── Layout.vue       # 侧边栏 + 顶栏布局
│       ├── Dashboard.vue    # 数据看板（对接公开 getStats）
│       ├── ReviewCats.vue   # 待审核猫咪
│       ├── ReviewEdits.vue  # 编辑提案审核
│       ├── ReviewRecords.vue# 记录审核
│       ├── AllCats.vue      # 全部猫咪（编辑内容/照片、切换领养/去喵星/失踪、删除）
│       ├── Records.vue      # 记录管理（审核 + 编辑描述/照片 + 删除）
│       ├── Users.vue        # 用户管理（角色切换 + 封禁/解封 + 贡献统计）
│       ├── Supporters.vue   # 赞助管理（新增/编辑/删除赞助记录）
│       └── Admins.vue       # 子管理员管理（仅最高管理员可见）
```

## 部署步骤

### 1. 部署云函数

在微信开发者工具里，把 `cloudfunctions/` 目录下的**所有**云函数逐个「上传并部署（云端安装依赖）」（共 32 个，完整清单见根目录 `cloudbaserc.json`）。

> 涉及网页后台的云函数已加 `requireAdmin` 双通道鉴权：网页走 token、小程序走 openid，小程序端原有管理功能不受影响。

### 2. 设置环境变量 + 初始化管理员

1. 在云开发控制台给 `initAdmin` 云函数配置环境变量 `ADMIN_INIT_KEY`，值用一个随机字符串（例如 `openssl rand -hex 16` 生成）。
2. 在云开发控制台「云函数 → initAdmin → 云端测试」调用一次：

```json
{
  "initKey": "你上一步设置的 ADMIN_INIT_KEY",
  "username": "admin",
  "password": "你的强密码"
}
```

返回 `code: 0` 即创建成功。`initAdmin` 只在 `admins` 集合为空时生效，创建的是**最高管理员**（`role: super`）。之后新增管理员、改角色、重置密码、删除都在后台「子管理员管理」页完成，无需再改代码。

### 3. 构建前端

```bash
cd web-admin
npm install
npm run build
```

产物在 `dist/` 目录。

### 4. 部署到 CloudBase 静态托管

用 CloudBase CLI：

```bash
npm install -g @cloudbase/cli
tcb login
tcb hosting deploy dist -e cloud2-d1gbjipxm9c21dd8d
```

部署完成后，访问控制台给出的默认域名（如 `https://cloud2-d1gbjipxm9c21dd8d-xxx.tcloudbaseapp.com/`）即可打开后台。

## 本地开发

```bash
cd web-admin
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`。本地开发同样走真实云环境（匿名登录 + 云函数），所以需要先完成上面的云函数部署与管理员初始化。

> `src/api.ts` 里的 `ENV_ID` 需与你的环境一致，当前为 `cloud2-d1gbjipxm9c21dd8d`。

## 安全说明

- 管理员分两级：`super`（最高管理员）与 `admin`（子管理员）。只有最高管理员能进「子管理员管理」页增删管理员、改角色、重置密码；子管理员可正常使用其余后台功能。
- 密码用 Node 内置 `crypto.scryptSync` 加盐哈希，存储格式为 `salt:hash`，不引入额外依赖。
- token 用 `crypto.randomBytes(32)` 生成，有效期 7 天，存于 `adminTokens` 集合；到期后 `requireAdmin` 会拒绝。
- 建议给静态托管域名绑定 HTTPS（CloudBase 默认提供），生产环境不要公开 `ADMIN_INIT_KEY`。
- 网页端匿名登录用的是 cloudbase web SDK，仅用于获得调用云函数的权限，真正的后台鉴权靠 token，匿名身份本身无管理权限。
