// 数据同步工具函数

/**
 * 将本地衣物数据转换为数据库格式
 */
export function localToDbItem(localItem, userId) {
  return {
    id: localItem.id,
    user_id: userId,
    name: localItem.name,
    main_category: localItem.mainCategory,
    sub_category: localItem.subCategory,
    season: localItem.season || ['四季'],
    purchase_date: localItem.purchaseDate || null,
    price: localItem.price || null,
    frequency: localItem.frequency || '偶尔',
    color: localItem.color || '黑色',
    color_hex: localItem.colorHex || '#000000',
    created_at: localItem.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    end_reason: localItem.endReason || null,
    end_date: localItem.endDate || null,
  };
}

/**
 * 将数据库格式转换为本地格式
 */
export function dbToLocalItem(dbItem) {
  return {
    id: dbItem.id,
    name: dbItem.name,
    mainCategory: dbItem.main_category,
    subCategory: dbItem.sub_category,
    season: dbItem.season || ['四季'],
    purchaseDate: dbItem.purchase_date || null,
    price: dbItem.price !== null ? parseFloat(dbItem.price) : null,
    frequency: dbItem.frequency || '偶尔',
    color: dbItem.color || '黑色',
    colorHex: dbItem.color_hex || '#000000',
    createdAt: dbItem.created_at || new Date().toISOString(),
    updatedAt: dbItem.updated_at || new Date().toISOString(),
    endReason: dbItem.end_reason || null,
    endDate: dbItem.end_date || null,
  };
}

/**
 * 合并本地和远程数据，处理冲突
 * 策略：保留最新的 updated_at 版本
 */
export function mergeItems(localItems, remoteItems) {
  const merged = new Map();
  
  // 先添加远程数据
  remoteItems.forEach(item => {
    merged.set(item.id, item);
  });
  
  // 处理本地数据
  localItems.forEach(localItem => {
    const remoteItem = merged.get(localItem.id);
    
    if (!remoteItem) {
      // 本地独有的项目，添加
      merged.set(localItem.id, localItem);
    } else {
      // 冲突：比较 updated_at
      const localUpdated = new Date(localItem.updatedAt || localItem.createdAt || 0);
      const remoteUpdated = new Date(remoteItem.updatedAt || remoteItem.createdAt || 0);
      
      if (localUpdated > remoteUpdated) {
        // 本地更新，保留本地版本
        merged.set(localItem.id, localItem);
      }
      // 否则保留远程版本（已在 merged 中）
    }
  });
  
  return Array.from(merged.values());
}

/**
 * 批量上传数据到 Supabase
 */
export async function uploadItemsToSupabase(supabase, items, userId, tableName) {
  if (!items || items.length === 0) return { success: true, count: 0 };
  
  try {
    const dbItems = items.map(item => localToDbItem(item, userId));
    
    // 使用 upsert 插入或更新
    const { data, error } = await supabase
      .from(tableName)
      .upsert(dbItems, { onConflict: 'id' });
    
    if (error) {
      console.error(`Error uploading to ${tableName}:`, error);
      return { success: false, error };
    }
    
    return { success: true, count: dbItems.length };
  } catch (error) {
    console.error(`Exception uploading to ${tableName}:`, error);
    return { success: false, error };
  }
}

/**
 * 从 Supabase 下载数据
 */
export async function downloadItemsFromSupabase(supabase, userId, tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error(`Error downloading from ${tableName}:`, error);
      return { success: false, error, items: [] };
    }
    
    const localItems = (data || []).map(dbToLocalItem);
    return { success: true, items: localItems };
  } catch (error) {
    console.error(`Exception downloading from ${tableName}:`, error);
    return { success: false, error, items: [] };
  }
}

/**
 * 删除 Supabase 中的数据
 */
export async function deleteItemFromSupabase(supabase, itemId, tableName) {
  try {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', itemId);
    
    if (error) {
      console.error(`Error deleting from ${tableName}:`, error);
      return { success: false, error };
    }
    
    return { success: true };
  } catch (error) {
    console.error(`Exception deleting from ${tableName}:`, error);
    return { success: false, error };
  }
}
