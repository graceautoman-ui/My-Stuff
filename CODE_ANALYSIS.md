# 代码架构解读

## 1. 整体架构

这是一个基于 React + Vite + Supabase 的个人物品管理应用，主要用于管理衣物和护肤/化妆用品。

### 技术栈
- **前端框架**: React 19.2.0
- **构建工具**: Vite 7.2.4
- **后端服务**: Supabase (PostgreSQL + Auth + Realtime)
- **数据存储**: localStorage (当前) + Supabase (待实现同步)

## 2. 核心功能模块

### 2.1 认证模块 (Authentication)
- **位置**: `App.jsx` 第 14-101 行
- **功能**:
  - 邮箱密码登录 (`signInWithEmail`)
  - 用户注册 (`signUpWithEmail`)
  - 登出 (`signOut`)
  - Session 管理 (通过 Supabase Auth)

### 2.2 数据存储模块 (Data Storage)
- **位置**: `App.jsx` 第 111-135 行, 474-492 行
- **当前实现**:
  - 使用 `localStorage` 存储数据
  - 两个存储键:
    - `grace_stuff_clothes_v1` - 个人衣物数据
    - `grace_stuff_daughter_clothes_v1` - 女儿衣物数据
  - 通过 `useEffect` 监听数据变化，自动保存到 localStorage

### 2.3 数据模型 (Data Model)

#### 衣物项目结构:
```javascript
{
  id: string,              // UUID
  name: string,            // 物品名称
  mainCategory: string,    // 主分类 (上衣/下装/连衣裙等)
  subCategory: string,     // 子分类 (T恤/衬衫等)
  season: string[],        // 季节 (四季/春夏/秋冬等)
  purchaseDate: string,    // 购买日期 (YYYY-MM)
  price: number,           // 价格
  frequency: string,       // 穿着频度 (经常/偶尔/很少)
  color: string,           // 颜色名称
  colorHex: string,        // 颜色十六进制值
  createdAt: string,        // 创建时间 (ISO 8601)
  endReason: string?,      // 缘尽原因 (可选)
  endDate: string?         // 缘尽日期 (可选)
}
```

### 2.4 数据操作模块 (CRUD Operations)

#### 个人衣物操作:
- `addClothesItem()` - 添加衣物 (第 519-547 行)
- `removeClothesItem(id)` - 删除衣物 (第 552-554 行)
- `updateClothesItem(id)` - 更新衣物 (第 559-591 行)
- `setEndReason(id, reason)` - 设置"缘尽"原因 (第 643-656 行)
- `startEditClothesItem(item)` - 开始编辑 (第 596-606 行)
- `copyClothesItem(item)` - 复制物品 (第 626-638 行)

#### 女儿衣物操作:
- 类似的操作函数，针对 `daughterClothesItems` 状态

### 2.5 UI 组件模块

#### 分类切换:
- 衣物 / 我女儿的衣物 / 护肤/化妆 (第 949-988 行)

#### 表单组件:
- 物品名称输入
- 主分类/子分类选择
- 季节多选
- 购买日期选择
- 价格输入
- 穿着频度选择
- 颜色选择

#### 列表展示:
- 筛选功能 (按主分类/子分类)
- 排序 (活跃物品在前，已"缘尽"在后)
- 统计信息 (数量、总价)

## 3. 数据流

### 当前数据流 (无同步):
```
用户操作 → React State 更新 → useEffect 触发 → localStorage 保存
```

### 目标数据流 (多设备同步):
```
用户操作 → React State 更新 → 
  ├─ localStorage 保存 (本地缓存)
  └─ Supabase 数据库更新 → Realtime 推送 → 其他设备接收更新
```

## 4. 当前问题分析

### 4.1 数据存储问题
- ✅ **优点**: 本地存储快速，离线可用
- ❌ **缺点**: 
  - 数据仅存储在浏览器本地
  - 无法跨设备同步
  - 清除浏览器数据会丢失所有数据

### 4.2 同步需求
用户需要在多个设备间同步数据:
- PC 端修改 → 手机端自动更新
- 手机端修改 → PC 端自动更新
- 冲突处理 (同一物品在不同设备同时修改)

## 5. 同步方案设计

### 5.1 数据库表结构

需要在 Supabase 创建两个表:

#### `clothes_items` 表:
```sql
CREATE TABLE clothes_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  main_category TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  season TEXT[] DEFAULT ARRAY['四季'],
  purchase_date TEXT,
  price DECIMAL(10,2),
  frequency TEXT DEFAULT '偶尔',
  color TEXT DEFAULT '黑色',
  color_hex TEXT DEFAULT '#000000',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  end_reason TEXT,
  end_date TIMESTAMPTZ,
  UNIQUE(user_id, id)
);
```

#### `daughter_clothes_items` 表:
类似结构，用于存储女儿衣物数据。

### 5.2 同步策略

#### 策略 1: 时间戳优先 (Timestamp-based)
- 每个数据项有 `updated_at` 字段
- 冲突时，保留最新的 `updated_at` 版本
- **优点**: 简单，适合大多数场景
- **缺点**: 可能丢失某些更新

#### 策略 2: 操作日志 (Operation Log)
- 记录所有操作 (CREATE/UPDATE/DELETE)
- 按时间顺序应用操作
- **优点**: 不丢失任何操作
- **缺点**: 实现复杂，需要处理操作冲突

#### 策略 3: 最后写入获胜 (Last Write Wins)
- 使用 `updated_at` 或版本号
- 简单有效
- **推荐**: 使用此策略

### 5.3 同步流程

#### 初始化 (登录后):
1. 从 Supabase 加载用户数据
2. 与本地 localStorage 数据合并
3. 上传本地未同步的数据
4. 订阅 Realtime 更新

#### 数据变更:
1. 更新 React State
2. 保存到 localStorage (立即)
3. 上传到 Supabase (异步)
4. Supabase Realtime 推送到其他设备

#### 接收更新:
1. 监听 Supabase Realtime 事件
2. 更新 React State
3. 更新 localStorage

### 5.4 冲突处理

场景: 设备 A 和设备 B 同时修改同一物品

处理流程:
1. 设备 A 修改 → 上传到 Supabase (updated_at: T1)
2. 设备 B 修改 → 上传到 Supabase (updated_at: T2, T2 > T1)
3. 设备 A 收到 Realtime 更新 → 检测到冲突
4. 比较 `updated_at` → 保留 T2 版本 (设备 B 的更新)
5. 更新本地 State 和 localStorage

## 6. 实现计划

### 阶段 1: 数据库设置
- [ ] 在 Supabase Dashboard 创建表
- [ ] 设置 Row Level Security (RLS) 策略
- [ ] 启用 Realtime 功能

### 阶段 2: 数据同步基础功能
- [ ] 实现数据上传函数
- [ ] 实现数据下载函数
- [ ] 实现初始化同步逻辑

### 阶段 3: 实时同步
- [ ] 订阅 Supabase Realtime
- [ ] 处理 INSERT/UPDATE/DELETE 事件
- [ ] 更新本地状态

### 阶段 4: 冲突处理
- [ ] 实现时间戳比较
- [ ] 实现冲突合并逻辑
- [ ] 添加冲突提示 (可选)

### 阶段 5: 优化和测试
- [ ] 性能优化 (批量操作)
- [ ] 错误处理
- [ ] 离线支持 (队列未同步操作)
- [ ] 多设备测试

## 7. 关键技术点

### 7.1 Supabase Realtime
```javascript
const channel = supabase
  .channel('clothes-items')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'clothes_items', filter: `user_id=eq.${userId}` },
    (payload) => {
      // 处理更新
    }
  )
  .subscribe();
```

### 7.2 Row Level Security (RLS)
```sql
-- 用户只能访问自己的数据
CREATE POLICY "Users can only see their own items"
ON clothes_items FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own items"
ON clothes_items FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### 7.3 数据合并逻辑
```javascript
function mergeItems(localItems, remoteItems) {
  const merged = [...remoteItems];
  const remoteIds = new Set(remoteItems.map(i => i.id));
  
  // 添加本地独有的项目
  localItems.forEach(localItem => {
    if (!remoteIds.has(localItem.id)) {
      merged.push(localItem);
    }
  });
  
  // 处理冲突: 保留最新的 updated_at
  // ...
  
  return merged;
}
```

## 8. 注意事项

1. **性能**: 大量数据时考虑分页加载
2. **网络**: 离线时队列操作，上线后批量同步
3. **安全性**: 确保 RLS 策略正确，用户只能访问自己的数据
4. **用户体验**: 同步时显示加载状态，避免重复操作
5. **数据迁移**: 首次同步时需要将现有 localStorage 数据上传
