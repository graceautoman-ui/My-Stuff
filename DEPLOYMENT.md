# 应用部署指南 - 实现跨网络数据同步

## 当前状态

✅ **数据同步已实现**：
- 数据存储在 Supabase 云端数据库
- 实时同步功能已实现（Realtime）
- 跨设备同步逻辑已就绪

✅ **需要做的**：
- 将应用部署到公网可访问的服务器

## 部署方案

### 方案 1: GitHub Pages（推荐，免费）

#### 步骤 1: 安装部署工具
```bash
npm install --save-dev gh-pages
```

#### 步骤 2: 修改 package.json
添加部署脚本：
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && gh-pages -d dist"
  }
}
```

#### 步骤 3: 修改 vite.config.js
确保 base 路径正确（如果使用 GitHub Pages 子路径）：
```javascript
export default defineConfig({
  plugins: [react()],
  base: '/My-Stuff/', // 或 '/你的仓库名/'
  // ...
})
```

#### 步骤 4: 部署
```bash
npm run deploy
```

#### 步骤 5: 配置 GitHub Pages
1. 在 GitHub 仓库中，进入 Settings → Pages
2. Source 选择 `gh-pages` 分支
3. 保存后，应用将在 `https://[你的用户名].github.io/My-Stuff/` 可访问

---

### 方案 2: Vercel（推荐，最简单，免费）

#### 步骤 1: 安装 Vercel CLI
```bash
npm install -g vercel
```

#### 步骤 2: 登录 Vercel
```bash
vercel login
```

#### 步骤 3: 部署
在项目根目录运行：
```bash
vercel
```

#### 步骤 4: 配置
- 第一次部署会询问配置，按提示操作
- 之后每次推送代码到 GitHub，Vercel 会自动部署

**优点**：
- 自动 HTTPS
- 全球 CDN
- 自动部署
- 免费额度充足

---

### 方案 3: Netlify（免费，简单）

#### 步骤 1: 安装 Netlify CLI
```bash
npm install -g netlify-cli
```

#### 步骤 2: 登录
```bash
netlify login
```

#### 步骤 3: 部署
```bash
npm run build
netlify deploy --prod --dir=dist
```

#### 步骤 4: 配置
- 在 Netlify Dashboard 中配置构建命令和发布目录
- 连接 GitHub 仓库实现自动部署

---

### 方案 4: Cloudflare Pages（免费，快速）

1. 在 Cloudflare Dashboard 中创建 Pages 项目
2. 连接 GitHub 仓库
3. 配置：
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`
4. 保存后自动部署

---

## 部署后的使用

### 1. 访问应用
部署完成后，你会得到一个公网 URL，例如：
- GitHub Pages: `https://[用户名].github.io/My-Stuff/`
- Vercel: `https://[项目名].vercel.app`
- Netlify: `https://[项目名].netlify.app`

### 2. 跨网络同步测试

**设备 A（PC，Wi-Fi A）**：
1. 访问部署的 URL
2. 登录账号
3. 添加/修改/删除数据

**设备 B（手机，Wi-Fi B，不同网络）**：
1. 访问相同的 URL
2. 使用相同账号登录
3. 应该能看到设备 A 的数据
4. 修改数据后，设备 A 应该实时更新

### 3. 数据同步流程

```
设备 A (网络A) → 操作数据 → Supabase 云端数据库
                                    ↓
设备 B (网络B) ← Realtime 推送 ← Supabase 云端数据库
```

## 重要配置检查

### 1. Supabase 配置
确保 Supabase 的配置允许跨域访问（默认已配置）

### 2. 环境变量（如果需要）
如果使用环境变量，需要在部署平台配置：
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 3. 404 页面处理（SPA 路由）
如果使用客户端路由，需要配置重定向到 `index.html`

**Vercel**: 创建 `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Netlify**: 创建 `public/_redirects`:
```
/*    /index.html   200
```

**GitHub Pages**: 需要配置 404.html 重定向

## 推荐方案

**最简单快速**: Vercel
- 一键部署
- 自动 HTTPS
- 全球 CDN
- 免费

**最稳定**: GitHub Pages
- 与代码仓库集成
- 完全免费
- 适合开源项目

## 部署后测试清单

- [ ] 应用可以正常访问
- [ ] 登录功能正常
- [ ] 数据可以添加/修改/删除
- [ ] 在不同设备（不同网络）登录，数据同步正常
- [ ] 实时更新功能正常（设备 A 修改，设备 B 自动更新）

## 故障排查

### 问题：部署后无法访问
- 检查 base 路径配置
- 检查构建是否成功
- 检查部署平台的配置

### 问题：数据不同步
- 检查 Supabase 表是否创建
- 检查 Realtime 是否启用
- 检查浏览器控制台错误
- 确认两个设备使用相同账号登录

### 问题：登录失败
- 检查 Supabase URL 和 Key 是否正确
- 检查网络连接
- 检查 Supabase Dashboard 中的认证设置
