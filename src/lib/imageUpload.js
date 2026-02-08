/**
 * 衣物照片上传：上传到 Supabase Storage，返回公开 URL。
 * 需在 Supabase Dashboard 创建 bucket「clothes-photos」并设为公开（或配置 RLS 允许读取）。
 */

const BUCKET = "clothes-photos";
const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function sanitizeFileName(name) {
  return (name || "photo").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

/**
 * 上传一张衣物照片
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId - auth.users.id
 * @param {string} itemId - 衣物 id
 * @param {File} file
 * @returns {Promise<string>} 公开访问的图片 URL
 */
export async function uploadClothesImage(supabase, userId, itemId, file) {
  if (!file || !ALLOWED_TYPES.includes(file.type)) {
    throw new Error("请选择图片文件（支持 JPG、PNG、WebP、GIF）");
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`图片大小不能超过 ${MAX_SIZE_MB}MB`);
  }

  const ext = (file.name.match(/\.([a-zA-Z0-9]+)$/) || [])[1] || "jpg";
  const path = `${userId}/${itemId}/${Date.now()}-${sanitizeFileName(file.name)}`.replace(/\.\w+$/, "") + "." + ext;

  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    console.error("Upload error:", error);
    throw new Error(error.message || "上传失败");
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

/**
 * 批量上传多张照片
 * @returns {Promise<string[]>} 公开 URL 数组
 */
export async function uploadClothesImages(supabase, userId, itemId, files) {
  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const url = await uploadClothesImage(supabase, userId, itemId, files[i]);
    urls.push(url);
  }
  return urls;
}

/**
 * 上传一张照片到「未关联」临时路径（用于批量补照片：先上传，后关联）
 * 路径：{userId}/_unlinked/{timestamp}-{filename}
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId - auth.users.id
 * @param {File} file
 * @returns {Promise<string>} 公开访问的图片 URL
 */
export async function uploadClothesImageUnlinked(supabase, userId, file) {
  if (!file || !ALLOWED_TYPES.includes(file.type)) {
    throw new Error("请选择图片文件（支持 JPG、PNG、WebP、GIF）");
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`图片大小不能超过 ${MAX_SIZE_MB}MB`);
  }

  const ext = (file.name.match(/\.([a-zA-Z0-9]+)$/) || [])[1] || "jpg";
  const path = `${userId}/_unlinked/${Date.now()}-${sanitizeFileName(file.name)}`.replace(/\.\w+$/, "") + "." + ext;

  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    console.error("Upload error (unlinked):", error);
    throw new Error(error.message || "上传失败");
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

/**
 * 从存储的 public URL 中取出 storage 路径（object path）
 * public URL 形如: https://xxx.supabase.co/storage/v1/object/public/clothes-photos/userId/itemId/file.jpg
 */
function pathFromPublicUrl(publicUrl) {
  if (!publicUrl || typeof publicUrl !== "string") return null;
  const match = publicUrl.match(/\/object\/public\/clothes-photos\/(.+)$/);
  return match ? match[1] : null;
}

const SIGNED_URL_CACHE_MAX = 300;
const signedUrlCache = new Map();
const signedUrlCacheOrder = [];

function getCachedSignedUrl(publicUrl) {
  const entry = signedUrlCache.get(publicUrl);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    signedUrlCache.delete(publicUrl);
    const i = signedUrlCacheOrder.indexOf(publicUrl);
    if (i !== -1) signedUrlCacheOrder.splice(i, 1);
    return null;
  }
  return entry.signedUrl;
}

function setCachedSignedUrl(publicUrl, signedUrl, expiresInSeconds) {
  while (signedUrlCache.size >= SIGNED_URL_CACHE_MAX && signedUrlCacheOrder.length > 0) {
    const oldest = signedUrlCacheOrder.shift();
    signedUrlCache.delete(oldest);
  }
  const expiresAt = Date.now() + expiresInSeconds * 1000 * 0.85;
  signedUrlCache.set(publicUrl, { signedUrl, expiresAt });
  if (signedUrlCacheOrder.indexOf(publicUrl) === -1) signedUrlCacheOrder.push(publicUrl);
}

/**
 * 获取用于展示的图片 URL。若 bucket 为私有，返回带鉴权的 Signed URL；否则返回原 URL。
 * 结果会按 publicUrl 缓存，同一张图在有效期内不会重复请求 Signed URL。
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} publicUrl - 存储的 public URL
 * @param {number} expiresIn - 签名有效期（秒），默认 24 小时，减少重复请求
 * @returns {Promise<string>} 可用的图片 URL
 */
export async function getDisplayImageUrl(supabase, publicUrl, expiresIn = 86400) {
  const path = pathFromPublicUrl(publicUrl);
  if (!path) return publicUrl;
  const cached = getCachedSignedUrl(publicUrl);
  if (cached) return cached;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) {
    console.warn("createSignedUrl failed, using public URL:", error);
    return publicUrl;
  }
  const signedUrl = data?.signedUrl || publicUrl;
  setCachedSignedUrl(publicUrl, signedUrl, expiresIn);
  return signedUrl;
}
