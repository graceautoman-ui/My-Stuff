-- 为衣物表增加「材质」字段 material（单选，可选值：纯棉/羊毛/羊绒/聚酯纤维/混纺/牛仔/真丝/皮革/羽绒/针织）
-- 在 Supabase Dashboard > SQL Editor 中执行，可重复执行（幂等）

-- clothes_items
ALTER TABLE clothes_items ADD COLUMN IF NOT EXISTS material text DEFAULT NULL;

-- daughter_clothes_items
ALTER TABLE daughter_clothes_items ADD COLUMN IF NOT EXISTS material text DEFAULT NULL;

-- 说明：字段为空表示不限制材质，历史数据允许为空、逐步回补。
