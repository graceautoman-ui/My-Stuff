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
  
  // 如果 colorHex 不存在，根据 color 字段推断
  let colorHex = localItem.colorHex;
  if (!colorHex || colorHex === null || colorHex === undefined) {
    const colorName = localItem.color || '黑色';
    colorHex = getColorHexFromName(colorName);
  }
  
  // 处理 purchaseDate：确保格式正确
  let purchaseDate = localItem.purchaseDate;
  if (purchaseDate) {
    // 如果是 YYYY-MM 格式，转换为 YYYY-MM-01（添加日期部分）
    if (purchaseDate.match(/^\d{4}-\d{2}$/)) {
      purchaseDate = purchaseDate + '-01';
    }
    // 尝试转换为 ISO 格式，如果失败则保持原样
    try {
      const date = new Date(purchaseDate);
      if (!isNaN(date.getTime())) {
        // 如果是有效的日期，转换为 ISO 格式
        purchaseDate = date.toISOString().split('T')[0]; // YYYY-MM-DD 格式
      }
    } catch {
      // 如果转换失败，保持原样
    }
  } else {
    purchaseDate = null;
  }
  
  return {
    id: localItem.id,
    user_id: userId,
    name: localItem.name || '',
    main_category: localItem.mainCategory || '上衣',
    sub_category: localItem.subCategory || 'T恤',
    season: season,
    purchase_date: purchaseDate,
    price: price,
    frequency: localItem.frequency || '偶尔',
    color: localItem.color || '黑色',
    color_hex: colorHex,
    created_at: createdAt,
    updated_at: new Date().toISOString(),
    end_reason: localItem.endReason || null,
    end_date: endDate,
  };
}

/**
 * 根据颜色名称获取对应的 hex 值
 */
function getColorHexFromName(colorName) {
  const colorMap = {
    "黑色": "#000000",
    "白色": "#FFFFFF",
    "灰色": "#808080",
    "红色": "#FF0000",
    "蓝色": "#0000FF",
    "浅蓝色": "#ADD8E6",
    "绿色": "#008000",
    "黄色": "#FFFF00",
    "粉色": "#FFC0CB",
    "紫色": "#800080",
    "浅紫色": "#DDA0DD",
    "棕色": "#A52A2A",
    "米色": "#F5F5DC",
    "卡其色": "#C3B091",
    "驼色": "#D2B48C",
    "军绿色": "#4B5320",
    "藏青色": "#1E3A5F",
    "其他": "#CCCCCC",
  };
  return colorMap[colorName] || '#000000';
}

/**
 * 将数据库格式转换为本地格式
 */
export function dbToLocalItem(dbItem) {
  // 如果 color_hex 不存在或为空，尝试根据 color 字段推断
  let colorHex = dbItem.color_hex;
  if (!colorHex || colorHex === '#000000' || colorHex === null || colorHex === undefined) {
    // 如果 color_hex 不存在或是黑色，尝试根据 color 字段推断
    const colorName = dbItem.color || '黑色';
    colorHex = getColorHexFromName(colorName);
  }
  
  // 处理 purchaseDate：如果是 YYYY-MM-DD 格式，转换为 YYYY-MM 格式（本地存储格式）
  let purchaseDate = dbItem.purchase_date;
  if (purchaseDate) {
    // 如果是 YYYY-MM-DD 格式，提取年月部分
    if (purchaseDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      purchaseDate = purchaseDate.substring(0, 7); // 提取 YYYY-MM
    }
    // 如果是其他格式，尝试解析并转换
    else if (!purchaseDate.match(/^\d{4}-\d{2}$/)) {
      try {
        const date = new Date(purchaseDate);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          purchaseDate = `${year}-${month}`;
        }
      } catch {
        // 如果解析失败，保持原样
      }
    }
  } else {
    purchaseDate = null;
  }
  
  // 处理 subCategory：确保有默认值
  let subCategory = dbItem.sub_category;
  if (!subCategory || subCategory === null || subCategory === undefined || subCategory === '') {
    // 如果 sub_category 为空，根据 main_category 设置默认值
    const mainCategory = dbItem.main_category || '上衣';
    if (mainCategory === '上衣') {
      subCategory = 'T恤';
    } else if (mainCategory === '下装') {
      subCategory = '长裤';
    } else if (mainCategory === '外套') {
      subCategory = '大衣';
    } else if (mainCategory === '鞋') {
      subCategory = '运动鞋';
    } else if (mainCategory === '包') {
      subCategory = '双肩包';
    } else {
      subCategory = '其他';
    }
  }
  
  return {
    id: dbItem.id,
    name: dbItem.name,
    mainCategory: dbItem.main_category || '上衣',
    subCategory: subCategory,
    // 数据库中的season是数组，转换为字符串（单选）
    season: Array.isArray(dbItem.season) && dbItem.season.length > 0 
      ? dbItem.season[0] 
      : (typeof dbItem.season === 'string' ? dbItem.season : '四季'),
    purchaseDate: purchaseDate,
    price: dbItem.price !== null ? parseFloat(dbItem.price) : null,
    frequency: dbItem.frequency || '偶尔',
    color: dbItem.color || '黑色',
    colorHex: colorHex,
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
        // 对于 colorHex，如果远程数据是黑色（可能是默认值），但本地数据有有效的颜色，保留本地的
        let mergedColorHex = remoteItem.colorHex;
        if ((!mergedColorHex || mergedColorHex === '#000000' || mergedColorHex === null || mergedColorHex === undefined) 
            && localItem.colorHex 
            && localItem.colorHex !== '#000000' 
            && localItem.colorHex !== '#CCCCCC') {
          // 远程数据是黑色（可能是默认值），但本地数据有有效的颜色，保留本地的
          mergedColorHex = localItem.colorHex;
        } else if (!mergedColorHex || mergedColorHex === null || mergedColorHex === undefined) {
          // 如果远程数据完全没有 colorHex，尝试根据 color 字段推断
          mergedColorHex = getColorHexFromName(remoteItem.color || localItem.color || '黑色');
        }
        
        // 处理 subCategory：如果远程数据为空，保留本地的
        let mergedSubCategory = remoteItem.subCategory;
        if (!mergedSubCategory || mergedSubCategory === null || mergedSubCategory === undefined || mergedSubCategory === '') {
          mergedSubCategory = localItem.subCategory || null;
          // 如果本地也没有，根据 mainCategory 设置默认值
          if (!mergedSubCategory) {
            const mainCategory = remoteItem.mainCategory || localItem.mainCategory || '上衣';
            if (mainCategory === '上衣') {
              mergedSubCategory = 'T恤';
            } else if (mainCategory === '下装') {
              mergedSubCategory = '长裤';
            } else if (mainCategory === '外套') {
              mergedSubCategory = '大衣';
            } else if (mainCategory === '鞋') {
              mergedSubCategory = '运动鞋';
            } else if (mainCategory === '包') {
              mergedSubCategory = '双肩包';
            } else {
              mergedSubCategory = '其他';
            }
          }
        }
        
        const mergedItem = {
          ...remoteItem,
          // 保留本地数据中存在的字段，如果远程数据中这些字段为空或不存在
          purchaseDate: remoteItem.purchaseDate || localItem.purchaseDate || null,
          colorHex: mergedColorHex,
          subCategory: mergedSubCategory,
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
