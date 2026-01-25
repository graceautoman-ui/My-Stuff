# 多设备同步问题排查指南

## 问题：手机端看不到电脑端导入的数据

### 🔍 快速检查清单

#### 1. Supabase 数据库表是否已创建？（最重要！）

**检查步骤**：
1. 打开 [Supabase Dashboard](https://app.supabase.com/)
2. 选择你的项目
3. 进入 **Database** → **Tables**
4. 查看是否有以下两个表：
   - ✅ `clothes_items`
   - ✅ `daughter_clothes_items`

**如果没有这些表**：
- 进入 **SQL Editor**
- 复制 `supabase_setup.sql` 文件的全部内容
- 粘贴并执行（点击 Run）
- 等待执行完成

#### 2. Realtime 是否已启用？（重要！）

**检查步骤**：
1. Supabase Dashboard → **Database** → **Replication**
2. 找到 `clothes_items` 表
3. 确认右侧的开关是 **ON**（绿色）
4. 找到 `daughter_clothes_items` 表
5. 确认右侧的开关是 **ON**（绿色）

**如果没有启用**：
- 点击开关启用 Realtime
- 两个表都需要启用

#### 3. 数据是否真的上传到云端？

**检查步骤**：
1. Supabase Dashboard → **Database** → **Tables**
2. 点击 `clothes_items` 表
3. 查看 **Table Editor** 标签
4. 应该能看到你导入的数据
5. 同样检查 `daughter_clothes_items` 表

**如果没有数据**：
- 说明上传失败
- 查看浏览器控制台（F12）的错误信息
- 可能是表不存在或权限问题

#### 4. 手机端登录后是否执行了同步？

**检查步骤**：
1. 在手机浏览器中打开应用
2. 登录后，打开开发者工具（如果可能）或查看网络请求
3. 应该看到同步相关的日志

**如果没有同步**：
- 可能是网络问题
- 或者表不存在导致同步失败

---

## 🔧 详细排查步骤

### 步骤 1: 检查数据库表

1. **打开 Supabase Dashboard**
   - https://app.supabase.com/
   - 选择你的项目

2. **检查表是否存在**
   - Database → Tables
   - 应该看到 `clothes_items` 和 `daughter_clothes_items`

3. **如果表不存在**：
   ```sql
   -- 执行 supabase_setup.sql 脚本
   -- 在 SQL Editor 中运行
   ```

### 步骤 2: 检查数据是否在云端

1. **查看表数据**
   - Database → Tables → `clothes_items` → Table Editor
   - 应该能看到你导入的数据行

2. **如果没有数据**：
   - 说明导入时上传失败
   - 需要重新导入或手动上传

### 步骤 3: 检查 Realtime

1. **启用 Realtime**
   - Database → Replication
   - 两个表都要启用

2. **验证状态**
   - 开关应该是绿色（ON）

### 步骤 4: 测试同步

1. **电脑端**：
   - 打开浏览器控制台（F12）
   - 登录后查看日志
   - 应该看到 "🔄 开始初始化同步..."
   - 应该看到 "✅ 同步初始化完成"

2. **手机端**：
   - 登录后应该自动同步
   - 如果看不到数据，检查控制台错误

---

## 🐛 常见错误和解决方案

### 错误 1: "relation does not exist" 或 "表不存在"

**原因**：数据库表没有创建

**解决**：
1. 执行 `supabase_setup.sql` 脚本
2. 确认表已创建
3. 重新导入数据

### 错误 2: "permission denied" 或 "权限被拒绝"

**原因**：Row Level Security (RLS) 策略问题

**解决**：
1. 确认已执行 `supabase_setup.sql`（包含 RLS 策略）
2. 确认用户已登录
3. 检查 RLS 策略是否正确

### 错误 3: Realtime 订阅失败

**原因**：Realtime 未启用

**解决**：
1. Database → Replication
2. 启用两个表的 Realtime
3. 刷新页面重新登录

### 错误 4: 数据上传成功但手机端看不到

**可能原因**：
1. 手机端登录的账号不同
2. Realtime 未启用
3. 手机端同步失败

**解决**：
1. 确认两个设备使用相同账号
2. 确认 Realtime 已启用
3. 手机端刷新页面或重新登录

---

## 📋 完整检查清单

- [ ] Supabase 数据库表已创建（`clothes_items` 和 `daughter_clothes_items`）
- [ ] Realtime 已启用（两个表都启用）
- [ ] 电脑端导入数据后，Supabase 表中有数据
- [ ] 电脑端登录后，控制台显示 "✅ 同步初始化完成"
- [ ] 手机端和电脑端使用相同账号登录
- [ ] 手机端登录后，控制台没有错误信息
- [ ] 手机端刷新页面后数据出现

---

## 🚀 快速修复步骤

如果数据没有同步，按以下步骤操作：

### 1. 确认数据库表已创建
```
Supabase Dashboard → SQL Editor → 执行 supabase_setup.sql
```

### 2. 确认 Realtime 已启用
```
Supabase Dashboard → Database → Replication → 启用两个表
```

### 3. 重新导入数据（如果需要）
```
应用 → 导入数据 → 重新导入
```

### 4. 检查数据是否在云端
```
Supabase Dashboard → Database → Tables → 查看数据
```

### 5. 手机端重新登录
```
手机 → 登出 → 重新登录 → 查看数据
```

---

## 💡 调试技巧

### 查看浏览器控制台

**电脑端**：
1. 按 F12 打开开发者工具
2. 切换到 Console 标签
3. 查看同步相关的日志：
   - "🔄 开始初始化同步..."
   - "📥 下载完成: ..."
   - "📤 上传完成: ..."
   - "✅ 同步初始化完成"
   - "📡 Realtime 订阅状态: SUBSCRIBED"

**手机端**：
- 如果可能，使用远程调试工具
- 或查看网络请求（Network 标签）

### 检查 Supabase 数据

1. **查看表数据**：
   - Supabase Dashboard → Database → Tables → `clothes_items` → Table Editor
   - 应该能看到你的数据

2. **查看用户 ID**：
   - Authentication → Users
   - 找到你的用户，记住 User UID
   - 在 Table Editor 中筛选 `user_id = 你的UID`

---

## 如果还是不行

请提供以下信息：
1. 浏览器控制台的完整错误信息（F12 → Console）
2. Supabase Dashboard 中表是否有数据
3. Realtime 是否已启用
4. 两个设备是否使用相同账号
