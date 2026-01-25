-- Supabase 数据库表创建脚本
-- 在 Supabase Dashboard > SQL Editor 中执行此脚本

-- 1. 创建衣物数据表
CREATE TABLE IF NOT EXISTS clothes_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
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

-- 2. 创建女儿衣物数据表
CREATE TABLE IF NOT EXISTS daughter_clothes_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
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

-- 3. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_clothes_items_user_id ON clothes_items(user_id);
CREATE INDEX IF NOT EXISTS idx_clothes_items_updated_at ON clothes_items(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_daughter_clothes_items_user_id ON daughter_clothes_items(user_id);
CREATE INDEX IF NOT EXISTS idx_daughter_clothes_items_updated_at ON daughter_clothes_items(updated_at DESC);

-- 4. 启用 Row Level Security (RLS)
ALTER TABLE clothes_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daughter_clothes_items ENABLE ROW LEVEL SECURITY;

-- 5. 创建 RLS 策略：用户只能访问自己的数据

-- clothes_items 表的策略
CREATE POLICY "Users can view their own clothes items"
  ON clothes_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clothes items"
  ON clothes_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clothes items"
  ON clothes_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clothes items"
  ON clothes_items FOR DELETE
  USING (auth.uid() = user_id);

-- daughter_clothes_items 表的策略
CREATE POLICY "Users can view their own daughter clothes items"
  ON daughter_clothes_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daughter clothes items"
  ON daughter_clothes_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daughter clothes items"
  ON daughter_clothes_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daughter clothes items"
  ON daughter_clothes_items FOR DELETE
  USING (auth.uid() = user_id);

-- 6. 创建触发器：自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clothes_items_updated_at
  BEFORE UPDATE ON clothes_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daughter_clothes_items_updated_at
  BEFORE UPDATE ON daughter_clothes_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. 启用 Realtime（在 Supabase Dashboard > Database > Replication 中启用）
-- 注意：需要在 Supabase Dashboard 中手动启用 Realtime
-- 路径：Database > Replication > 选择 clothes_items 和 daughter_clothes_items 表
