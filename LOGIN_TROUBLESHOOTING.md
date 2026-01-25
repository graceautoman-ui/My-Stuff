# 登录问题排查指南

## 问题：Invalid login credentials

这个错误通常有以下几个原因：

### 原因 1: 还没有注册账号（最常见）

**解决方案**：
1. 在登录页面，点击 **"没有账号？去注册"**
2. 输入邮箱和密码（至少6位）
3. 点击 **"注册"**
4. 注册成功后，会自动切换到登录模式
5. 使用刚才注册的邮箱和密码登录

### 原因 2: 邮箱或密码输入错误

**检查项**：
- ✅ 邮箱格式是否正确（例如：`your@email.com`）
- ✅ 密码是否正确（注意大小写）
- ✅ 是否有多余的空格

### 原因 3: Supabase 邮箱认证未启用

**检查步骤**：
1. 打开 [Supabase Dashboard](https://app.supabase.com/)
2. 选择你的项目
3. 进入 **Authentication** → **Providers**
4. 确认 **Email** 提供者是 **Enabled**（启用）状态
5. 如果未启用，点击启用

### 原因 4: 邮箱验证要求

**检查步骤**：
1. 在 Supabase Dashboard 中
2. 进入 **Authentication** → **Providers** → **Email**
3. 查看 **"Confirm email"** 设置
4. 如果启用了邮箱验证：
   - 注册后需要检查邮箱，点击验证链接
   - 或者暂时关闭邮箱验证（开发阶段）

---

## 快速解决方案

### 方案 1: 先注册账号

1. 访问你的应用：`https://my-stuff-theta.vercel.app/`
2. 点击 **"没有账号？去注册"**
3. 输入：
   - 邮箱：`test@example.com`（使用真实邮箱）
   - 密码：至少6位（例如：`123456`）
4. 点击 **"注册"**
5. 注册成功后，使用相同邮箱密码登录

### 方案 2: 关闭邮箱验证（开发阶段）

如果注册后需要邮箱验证，可以暂时关闭：

1. Supabase Dashboard → **Authentication** → **Providers** → **Email**
2. 找到 **"Confirm email"** 选项
3. 关闭它（开发阶段可以关闭，生产环境建议开启）
4. 保存设置
5. 重新注册账号

---

## 测试步骤

### 1. 测试注册功能

1. 访问应用
2. 点击 "没有账号？去注册"
3. 输入邮箱和密码
4. 点击注册
5. 应该看到 "注册成功！" 提示

### 2. 测试登录功能

1. 使用刚才注册的邮箱和密码
2. 点击登录
3. 应该能成功登录并看到应用界面

---

## 常见错误信息

### "Invalid login credentials"
- **原因**：账号不存在或密码错误
- **解决**：先注册账号，或检查密码

### "Email not confirmed"
- **原因**：启用了邮箱验证，但未验证
- **解决**：检查邮箱点击验证链接，或关闭邮箱验证

### "User already registered"
- **原因**：该邮箱已注册
- **解决**：使用该邮箱登录，或使用其他邮箱注册

---

## 如果还是无法登录

1. **检查浏览器控制台**（F12 → Console）
   - 查看是否有其他错误信息
   - 把错误信息告诉我

2. **检查 Supabase Dashboard**
   - Authentication → Users
   - 查看是否有注册的用户
   - 查看用户状态

3. **尝试重置密码**
   - 如果账号存在但忘记密码，可以在 Supabase Dashboard 中重置

---

## 推荐设置（开发阶段）

在 Supabase Dashboard 中：

1. **Authentication** → **Providers** → **Email**
   - ✅ Enable email signup: **ON**
   - ❌ Confirm email: **OFF**（开发阶段关闭）
   - ✅ Secure email change: **OFF**（可选）

2. **Authentication** → **URL Configuration**
   - Site URL: `https://my-stuff-theta.vercel.app`
   - Redirect URLs: 添加 `https://my-stuff-theta.vercel.app/**`

这样设置后，注册和登录应该会更顺畅。
