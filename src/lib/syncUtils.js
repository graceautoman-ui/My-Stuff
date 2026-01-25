// 数据同步工具函数

/**
 * 将本地衣物数据转换为数据库格式
 */
export function localToDbItem(localItem, userId) {
  // 处理 season：现在季节是单选（字符串），但数据库可能仍需要数组格式
  let season = localItem.season || '四季';
  // 如果是字符串，转换为数组（数据库格式）
  if (typeof season === 'string') {
    season = [season];
  } else if (Array.isArray(season)) {
    // 如果是数组，取第一个元素（兼容旧数据）
    season = season.length > 0 ? [season[0]] : ['四季'];
  } else {
    season = ['四季'];
  }
  
  // 处理 price：确保是数字或 null
  let price = localItem.price;
  if (price !== null && price !== undefined) {
    price = parseFloat(price);
    if (isNaN(price)) {
      price = null;
    }
  } else {
    price = null;
  }
  
  // 处理日期：确保是 ISO 格式字符串
  let createdAt = localItem.createdAt;
  if (createdAt) {
    try {
      const date = new Date(createdAt);
      if (!isNaN(date.getTime())) {
        createdAt = date.toISOString();
      } else {
        createdAt = new Date().toISOString();
      }
    } catch {
      createdAt = new Date().toISOString();
    }
  } else {
    createdAt = new Date().toISOString();
  }
  
  let endDate = localItem.endDate;
  if (endDate) {
    try {
      const date = new Date(endDate);
      if (!isNaN(date.getTime())) {
        endDate = date.toISOString();
      } else {
        endDate = null;
      }
    } catch {
      endDate = null;
    }
  } else {
    endDate = null;
  }
  
  return {
    id: localItem.id,
    user_id: userId,
    name: localItem.name || '',
    main_category: localItem.mainCategory || '上衣',
    sub_category: localItem.subCategory || 'T恤',
    season: season,
    purchase_date: localItem.purchaseDate || null,
    price: price,
    frequency: localItem.frequency || '偶尔',
    color: localItem.color || '黑色',
    color_hex: localItem.colorHex || '#000000',
    created_at: createdAt,
    updated_at: new Date().toISOString(),
    end_reason: localItem.endReason || null,
    end_date: endDate,
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
    // 数据库中的season是数组，转换为字符串（单选）
    season: Array.isArray(dbItem.season) && dbItem.season.length > 0 
      ? dbItem.season[0] 
      : (typeof dbItem.season === 'string' ? dbItem.season : '四季'),
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
      } else {
        // 远程更新，但需要保留本地数据中存在的字段（如果远程数据缺少这些字段）
        const mergedItem = {
          ...remoteItem,
          // 保留本地数据中存在的字段，如果远程数据中这些字段为空或不存在
          purchaseDate: remoteItem.purchaseDate || localItem.purchaseDate || null,
          colorHex: remoteItem.colorHex || localItem.colorHex || '#000000',
          subCategory: remoteItem.subCategory || localItem.subCategory || null,
          mainCategory: remoteItem.mainCategory || localItem.mainCategory || null,
          color: remoteItem.color || localItem.color || '黑色',
          price: remoteItem.price !== null && remoteItem.price !== undefined ? remoteItem.price : (localItem.price !== null && localItem.price !== undefined ? localItem.price : null),
          season: remoteItem.season || localItem.season || '四季',
          endReason: remoteItem.endReason || localItem.endReason || null,
          endDate: remoteItem.endDate || localItem.endDate || null,
        };
        merged.set(localItem.id, mergedItem);
      }
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
    const dbItems = items.map(item => {
      const dbItem = localToDbItem(item, userId);
      // 确保数据类型正确
      // season 必须是数组（数据库格式）
      if (!Array.isArray(dbItem.season)) {
        dbItem.season = dbItem.season ? [dbItem.season] : ['四季'];
      } else if (dbItem.season.length === 0) {
        dbItem.season = ['四季'];
      }
      // price 转换为数字或 null
      if (dbItem.price !== null && dbItem.price !== undefined) {
        dbItem.price = parseFloat(dbItem.price) || null;
      }
      // 确保日期格式正确
      if (dbItem.created_at && !dbItem.created_at.includes('T')) {
        dbItem.created_at = new Date(dbItem.created_at).toISOString();
      }
      if (dbItem.updated_at && !dbItem.updated_at.includes('T')) {
        dbItem.updated_at = new Date(dbItem.updated_at).toISOString();
      }
      if (dbItem.end_date && !dbItem.end_date.includes('T')) {
        dbItem.end_date = new Date(dbItem.end_date).toISOString();
      }
      return dbItem;
    });
    
    console.log(`准备上传 ${dbItems.length} 条数据到 ${tableName}`);
    if (dbItems.length > 0) {
      console.log("第一条数据示例:", JSON.stringify(dbItems[0], null, 2));
    }
    
    // 分批上传，每批 50 条（避免请求过大）
    const batchSize = 50;
    let successCount = 0;
    let lastError = null;
    
    for (let i = 0; i < dbItems.length; i += batchSize) {
      const batch = dbItems.slice(i, i + batchSize);
      console.log(`上传批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(dbItems.length / batchSize)}: ${batch.length} 条`);
      
      // 使用 upsert，因为 id 是主键
      const { data, error } = await supabase
        .from(tableName)
        .upsert(batch, { 
          onConflict: 'id' // 使用主键 id
        });
      
      if (error) {
        console.error(`批次上传失败 (${i}-${i + batch.length}):`, error);
        console.error("错误详情:", JSON.stringify(error, null, 2));
        console.error("失败批次数据示例:", batch[0]);
        lastError = error;
        // 继续尝试其他批次，不立即返回
      } else {
        successCount += batch.length;
        console.log(`✅ 批次上传成功: ${batch.length} 条`);
      }
    }
    
    if (lastError && successCount === 0) {
      // 所有批次都失败
      return { success: false, error: lastError };
    } else if (lastError) {
      // 部分成功
      console.warn(`⚠️ 部分上传成功: ${successCount}/${dbItems.length}`);
      return { success: true, count: successCount, partial: true, error: lastError };
    } else {
      // 全部成功
      console.log(`✅ 成功上传 ${successCount} 条数据到 ${tableName}`);
      return { success: true, count: successCount };
    }
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
