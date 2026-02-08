-- 为衣物表增加「衣物照片」字段 image_urls（图片 URL 数组，一件衣物多张照片）
-- 在 Supabase Dashboard > SQL Editor 中执行，可重复执行（幂等）

-- clothes_items
ALTER TABLE clothes_items ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT NULL;

-- daughter_clothes_items
ALTER TABLE daughter_clothes_items ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT NULL;

-- 说明：允许为空，历史数据默认无照片，不强制回补。
-- 照片文件存 Supabase Storage：需在 Dashboard 创建 bucket「clothes-photos」并设为公开读（或配置 RLS）。
