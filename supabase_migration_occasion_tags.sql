-- 为衣物表增加「适用场合」字段 occasion_tags（多选，可选值：通勤/居家/运动/约会/度假/其他）
-- 在 Supabase Dashboard > SQL Editor 中执行

-- clothes_items
ALTER TABLE clothes_items ADD COLUMN IF NOT EXISTS occasion_tags text[] DEFAULT NULL;

-- daughter_clothes_items
ALTER TABLE daughter_clothes_items ADD COLUMN IF NOT EXISTS occasion_tags text[] DEFAULT NULL;

-- 说明：字段为空表示不限制场合，历史数据允许为空、逐步回补。
