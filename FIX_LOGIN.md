# 修复登录问题

## 问题分析

从错误信息看：
- ✅ 账号已注册（"User already registered"）
- ❌ 登录失败（"Invalid login credentials"）

**可能原因**：
1. 注册后需要邮箱验证，但未验证
2. 密码输入错误
3. Supabase 邮箱验证设置问题

## 解决方案

### 方案 1: 关闭邮箱验证（推荐，开发阶段）

1. **打开 Supabase Dashboard**
   - 访问 https://app.supabase.com/
   - 选择你的项目

2. **关闭邮箱验证**
   - 进入 **Authentication** → **Providers** → **Email**
   - 找到 **"Confirm email"** 选项
   - **关闭它**（Toggle OFF）
   - 点击 **Save**

3. **重新登录**
   - 使用注册的邮箱和密码
   - 应该可以登录了

### 方案 2: 在 Supabase Dashboard 中重置密码

1. **查看已注册的用户**
   - Supabase Dashboard → **Authentication** → **Users**
   - 找到你注册的邮箱

2. **重置密码**
   - 点击用户右侧的 **⋯** 菜单
   - 选择 **Reset password**
   - 或者直接编辑用户，设置新密码

3. **使用新密码登录**

### 方案 3: 检查用户状态

1. **查看用户详情**
   - Supabase Dashboard → **Authentication** → **Users**
   - 点击你的用户邮箱
   - 查看：
     - **Email confirmed**: 应该是 `true`
     - **User status**: 应该是 `ACTIVE`

2. **如果 Email confirmed 是 false**
   - 手动设置为 `true`
   - 或者关闭邮箱验证要求

## 快速修复步骤（推荐）

### 步骤 1: 关闭邮箱验证

```
Supabase Dashboard 
→ Authentication 
→ Providers 
→ Email 
→ Confirm email: OFF
→ Save
```

### 步骤 2: 确认用户状态

```
Supabase Dashboard 
→ Authentication 
→ Users 
→ 点击你的邮箱
→ 确认 Email confirmed: true
→ 如果 false，手动改为 true
```

### 步骤 3: 重新登录

1. 访问应用
2. 使用注册的邮箱和密码登录
3. 应该可以成功登录

## 如果还是不行

### 方法 1: 重置密码

在 Supabase Dashboard 中：
1. Authentication → Users
2. 找到你的用户
3. 点击 **Reset password**
4. 检查邮箱，点击重置链接
5. 设置新密码
6. 使用新密码登录

### 方法 2: 删除用户重新注册

1. Supabase Dashboard → Authentication → Users
2. 找到你的用户
3. 点击删除
4. 在应用中重新注册

### 方法 3: 检查 Supabase 配置

确认以下设置：
- ✅ Email provider 已启用
- ❌ Confirm email 已关闭（开发阶段）
- ✅ Site URL 已设置
- ✅ Redirect URLs 已配置

## 测试步骤

1. **关闭邮箱验证**（最重要！）
2. **确认用户 Email confirmed = true**
3. **使用注册的邮箱密码登录**
4. **应该可以成功登录**

## 常见问题

### Q: 为什么注册后不能直接登录？
A: 如果启用了邮箱验证，注册后需要验证邮箱才能登录。开发阶段建议关闭。

### Q: 如何确认邮箱验证是否关闭？
A: Supabase Dashboard → Authentication → Providers → Email → Confirm email 应该是 OFF

### Q: 密码忘记了怎么办？
A: 在 Supabase Dashboard 中重置密码，或删除用户重新注册。
