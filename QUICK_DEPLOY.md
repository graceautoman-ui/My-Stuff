# 快速部署指南 - 5分钟上线

## 最简单的方法：使用 Vercel（推荐）

### 方法 1: 通过网页部署（最简单）

1. **访问 Vercel**
   - 打开 https://vercel.com
   - 使用 GitHub 账号登录

2. **导入项目**
   - 点击 "Add New Project"
   - 选择你的 GitHub 仓库 `stuff-vault`
   - 点击 "Import"

3. **配置项目**
   - Framework Preset: 选择 "Vite"
   - Root Directory: 留空（默认）
   - Build Command: `npm run build`（自动检测）
   - Output Directory: `dist`（自动检测）
   - Install Command: `npm install`（自动检测）

4. **部署**
   - 点击 "Deploy"
   - 等待 1-2 分钟
   - 完成后会得到一个 URL，例如：`https://stuff-vault.vercel.app`

5. **配置路径（如果需要）**
   - 如果使用 `/My-Stuff/` 路径，需要在 Vercel 项目设置中配置
   - 或者修改 `vite.config.js` 中的 `base: '/'` 使用根路径

### 方法 2: 通过命令行部署

```bash
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 登录
vercel login

# 3. 在项目目录中部署
vercel

# 4. 生产环境部署
vercel --prod
```

---

## 部署后的访问地址

部署完成后，你会得到一个类似这样的 URL：
```
https://stuff-vault.vercel.app
```

或者如果使用 GitHub Pages：
```
https://[你的GitHub用户名].github.io/My-Stuff/
```

---

## 跨网络同步测试

### 测试步骤：

1. **设备 A（PC，家里 Wi-Fi）**
   - 访问部署的 URL
   - 登录你的账号
   - 添加一些测试数据

2. **设备 B（手机，公司 Wi-Fi 或移动数据）**
   - 访问相同的 URL
   - 使用相同账号登录
   - 应该能看到设备 A 添加的数据
   - 修改数据，设备 A 应该实时更新

### 预期结果：

✅ **数据同步正常**：
- 设备 A 添加数据 → 设备 B 立即看到
- 设备 B 修改数据 → 设备 A 实时更新
- 设备 A 删除数据 → 设备 B 立即删除

✅ **实时更新**：
- 无需刷新页面
- 数据变化自动同步

---

## 如果使用根路径（推荐）

如果你想使用更简洁的 URL（如 `https://your-app.vercel.app`），可以修改配置：

### 修改 vite.config.js
```javascript
export default defineConfig({
  plugins: [react()],
  base: '/', // 改为根路径
  // ...
})
```

然后重新部署。

---

## 重要提示

1. **数据已存储在云端**：所有数据都在 Supabase，所以跨网络同步已经支持
2. **只需要部署前端**：后端（Supabase）已经在云端
3. **实时同步已实现**：通过 Supabase Realtime 实现
4. **任何设备都能访问**：只要知道 URL 和账号密码

---

## 部署后检查清单

- [ ] 应用可以正常访问
- [ ] 登录界面显示正常
- [ ] 可以成功登录
- [ ] 数据可以正常添加/修改/删除
- [ ] 在不同网络下的设备测试同步功能

---

## 需要帮助？

如果部署遇到问题，检查：
1. 构建是否成功（查看部署日志）
2. Supabase 配置是否正确
3. 网络连接是否正常
