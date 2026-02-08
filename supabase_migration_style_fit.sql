-- 为衣物表增加「风格」「版型」字段：style_tags（多选）、fit（单选）
-- 在 Supabase Dashboard > SQL Editor 中执行，可重复执行（幂等）

-- style_tags：多选，可选值 简约/复古/中性/文艺/运动/通勤/优雅/知性
-- fit：单选，可选值 宽松/合身/修身

-- clothes_items
ALTER TABLE clothes_items ADD COLUMN IF NOT EXISTS style_tags text[] DEFAULT NULL;
ALTER TABLE clothes_items ADD COLUMN IF NOT EXISTS fit text DEFAULT NULL;

-- daughter_clothes_items
ALTER TABLE daughter_clothes_items ADD COLUMN IF NOT EXISTS style_tags text[] DEFAULT NULL;
ALTER TABLE daughter_clothes_items ADD COLUMN IF NOT EXISTS fit text DEFAULT NULL;

-- 说明：字段为空表示不限制，历史数据允许为空、逐步回补。
