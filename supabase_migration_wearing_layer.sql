-- 为衣物表增加「穿着层级」字段 wearing_layer（单选，可选值：内穿/内外皆可/外穿）
-- 在 Supabase Dashboard > SQL Editor 中执行，可重复执行（幂等）

-- clothes_items
ALTER TABLE clothes_items ADD COLUMN IF NOT EXISTS wearing_layer text DEFAULT NULL;

-- daughter_clothes_items
ALTER TABLE daughter_clothes_items ADD COLUMN IF NOT EXISTS wearing_layer text DEFAULT NULL;

-- 说明：字段为空表示不限制穿着层级，历史数据允许为空、逐步回补。
