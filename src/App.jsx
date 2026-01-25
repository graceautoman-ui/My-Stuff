// Section 1: Imports and Storage Key
// The file imports React hooks (`useEffect`, `useMemo`, `useState`) from "react" for state and side-effect management.
// It also defines a constant `STORAGE_KEY` which will be used as the key for localStorage operations.

import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "./lib/supabaseClient";
import {
  uploadItemsToSupabase,
  downloadItemsFromSupabase,
  deleteItemFromSupabase,
  mergeItems,
  dbToLocalItem,
} from "./lib/syncUtils";

const STORAGE_KEY = "grace_stuff_clothes_v1";
const STORAGE_KEY_DAUGHTER = "grace_stuff_daughter_clothes_v1";

// Section 2: Main App Component Function
// The `App` function defines the main component for the app.

function App() {
  // Section 2a: Auth State (Supabase)
  // Authentication state management using Supabase
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // 同步相关状态
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const syncChannelRef = useRef(null);
  const isInitialSyncRef = useRef(false);
  
  // 数据导入相关状态
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState("");
  const [importError, setImportError] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    // 1) Read session once on mount
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Session read error:", error);
      }
      setSession(data?.session);
      if (data?.session) {
        // 登录后初始化同步
        initializeSync(data.session.user.id);
      }
    });

    // 2) Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession && !isInitialSyncRef.current) {
        // 登录后初始化同步
        initializeSync(newSession.user.id);
      } else if (!newSession) {
        // 登出时清理
        cleanupSync();
      }
    });

    return () => {
      subscription.unsubscribe();
      cleanupSync();
    };
  }, []);

  async function signInWithEmail() {
    setAuthError("");
    setLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });
    
    setLoading(false);
    
    if (error) {
      console.error("Login error:", error);
      setAuthError(error.message);
    } else {
      console.log("Login successful:", data.user?.email);
      setEmail("");
      setPassword("");
    }
  }

  async function signUpWithEmail() {
    setAuthError("");
    setLoading(true);
    
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
    });
    
    setLoading(false);
    
    if (error) {
      console.error("Sign up error:", error);
      setAuthError(error.message);
    } else {
      console.log("Sign up successful:", data.user?.email);
      setAuthError("注册成功！请检查邮箱验证链接（如果需要）。");
      // Switch to sign in mode after successful sign up
      setTimeout(() => {
        setIsSignUp(false);
        setEmail("");
        setPassword("");
        setAuthError("");
      }, 2000);
    }
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    if (isSignUp) {
      await signUpWithEmail();
    } else {
      await signInWithEmail();
    }
  }

  async function signOut() {
    cleanupSync();
    await supabase.auth.signOut();
  }

  // ========== 数据同步函数 ==========

  /**
   * 初始化同步：登录后执行
   * 1. 从云端下载数据
   * 2. 与本地数据合并
   * 3. 上传本地未同步的数据
   * 4. 订阅实时更新
   */
  async function initializeSync(userId) {
    if (isInitialSyncRef.current) return;
    isInitialSyncRef.current = true;
    setIsSyncing(true);
    setSyncError("");

    try {
      console.log("🔄 开始初始化同步...");

      // 1. 从云端下载数据
      console.log("📥 从云端下载数据...");
      const [clothesResult, daughterResult] = await Promise.all([
        downloadItemsFromSupabase(supabase, userId, "clothes_items"),
        downloadItemsFromSupabase(supabase, userId, "daughter_clothes_items"),
      ]);

      // 检查下载结果
      if (!clothesResult.success) {
        console.error("❌ 下载衣物数据失败:", clothesResult.error);
        if (clothesResult.error?.message?.includes("relation") || clothesResult.error?.message?.includes("does not exist")) {
          throw new Error("数据库表不存在！请在 Supabase Dashboard 中执行 supabase_setup.sql 脚本创建表。");
        }
      }
      if (!daughterResult.success) {
        console.error("❌ 下载女儿衣物数据失败:", daughterResult.error);
        if (daughterResult.error?.message?.includes("relation") || daughterResult.error?.message?.includes("does not exist")) {
          throw new Error("数据库表不存在！请在 Supabase Dashboard 中执行 supabase_setup.sql 脚本创建表。");
        }
      }

      console.log(`📥 下载完成: 衣物 ${clothesResult.items?.length || 0} 条, 女儿衣物 ${daughterResult.items?.length || 0} 条`);

      // 2. 读取本地数据并映射频率值
      const localClothesRaw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const localDaughterRaw = JSON.parse(localStorage.getItem(STORAGE_KEY_DAUGHTER) || "[]");
      const localClothes = localClothesRaw.map(item => ({
        ...item,
        frequency: mapFrequency(item.frequency),
        season: mapSeason(item.season)
      }));
      const localDaughter = localDaughterRaw.map(item => ({
        ...item,
        frequency: mapFrequency(item.frequency),
        season: mapSeason(item.season)
      }));
      console.log(`💾 本地数据: 衣物 ${localClothes.length} 条, 女儿衣物 ${localDaughter.length} 条`);

      // 3. 转换远程数据格式并映射频率值
      const remoteClothes = (clothesResult.items || []).map(item => {
        const localItem = dbToLocalItem(item);
        return {
          ...localItem,
          frequency: mapFrequency(localItem.frequency),
          season: mapSeason(localItem.season)
        };
      });
      const remoteDaughter = (daughterResult.items || []).map(item => {
        const localItem = dbToLocalItem(item);
        return {
          ...localItem,
          frequency: mapFrequency(localItem.frequency),
          season: mapSeason(localItem.season)
        };
      });

      // 4. 合并数据（处理冲突）
      const mergedClothes = mergeItems(localClothes, remoteClothes);
      const mergedDaughter = mergeItems(localDaughter, remoteDaughter);
      console.log(`🔄 合并后: 衣物 ${mergedClothes.length} 条, 女儿衣物 ${mergedDaughter.length} 条`);

      // 5. 更新状态和本地存储
      setClothesItems(mergedClothes);
      setDaughterClothesItems(mergedDaughter);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedClothes));
      localStorage.setItem(STORAGE_KEY_DAUGHTER, JSON.stringify(mergedDaughter));

      // 6. 上传合并后的数据到云端（确保云端是最新的）
      console.log("📤 上传数据到云端...");
      const [uploadClothesResult, uploadDaughterResult] = await Promise.all([
        uploadItemsToSupabase(supabase, mergedClothes, userId, "clothes_items"),
        uploadItemsToSupabase(supabase, mergedDaughter, userId, "daughter_clothes_items"),
      ]);

      if (!uploadClothesResult.success) {
        console.error("❌ 上传衣物数据失败:", uploadClothesResult.error);
        if (uploadClothesResult.error?.message?.includes("relation") || uploadClothesResult.error?.message?.includes("does not exist")) {
          throw new Error("数据库表不存在！请在 Supabase Dashboard 中执行 supabase_setup.sql 脚本创建表。");
        }
      }
      if (!uploadDaughterResult.success) {
        console.error("❌ 上传女儿衣物数据失败:", uploadDaughterResult.error);
        if (uploadDaughterResult.error?.message?.includes("relation") || uploadDaughterResult.error?.message?.includes("does not exist")) {
          throw new Error("数据库表不存在！请在 Supabase Dashboard 中执行 supabase_setup.sql 脚本创建表。");
        }
      }

      console.log(`📤 上传完成: 衣物 ${uploadClothesResult.count || 0} 条, 女儿衣物 ${uploadDaughterResult.count || 0} 条`);

      // 7. 订阅实时更新
      subscribeToRealtimeUpdates(userId);

      console.log("✅ 同步初始化完成");
      setSyncError("");
    } catch (error) {
      console.error("❌ 同步初始化失败:", error);
      setSyncError("同步失败: " + (error.message || "未知错误"));
    } finally {
      setIsSyncing(false);
    }
  }

  /**
   * 订阅 Supabase Realtime 更新
   */
  function subscribeToRealtimeUpdates(userId) {
    // 清理旧的订阅
    if (syncChannelRef.current) {
      supabase.removeChannel(syncChannelRef.current);
    }

    // 创建新的订阅
    const channel = supabase
      .channel(`user-${userId}-sync`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clothes_items",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("📥 收到衣物数据更新:", payload.eventType, payload.new);
          handleRealtimeUpdate(payload, "clothes");
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daughter_clothes_items",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("📥 收到女儿衣物数据更新:", payload.eventType, payload.new);
          handleRealtimeUpdate(payload, "daughter");
        }
      )
      .subscribe((status) => {
        console.log("📡 Realtime 订阅状态:", status);
      });

    syncChannelRef.current = channel;
  }

  /**
   * 处理 Realtime 更新
   */
  function handleRealtimeUpdate(payload, type) {
    const { eventType, new: newItem, old: oldItem } = payload;

    if (eventType === "INSERT" || eventType === "UPDATE") {
      const dbItem = dbToLocalItem(newItem);
      const localItem = { 
        ...dbItem, 
        frequency: mapFrequency(dbItem.frequency),
        season: mapSeason(dbItem.season)
      };
      if (type === "clothes") {
        setClothesItems((prev) => {
          const existing = prev.find((item) => item.id === localItem.id);
          if (existing) {
            // 更新现有项目（比较 updatedAt）
            const existingUpdated = new Date(existing.updatedAt || existing.createdAt || 0);
            const newUpdated = new Date(localItem.updatedAt || localItem.createdAt || 0);
            if (newUpdated > existingUpdated) {
              // 远程更新，更新本地，但保留本地数据中存在的字段（如果远程数据缺少这些字段）
              const mergedItem = {
                ...existing, // 先保留本地数据的所有字段
                ...localItem, // 然后用远程数据覆盖
                // 确保关键字段不会丢失（如果远程数据为空，使用本地数据）
                purchaseDate: localItem.purchaseDate || existing.purchaseDate || null,
                colorHex: localItem.colorHex || existing.colorHex || '#000000',
                subCategory: localItem.subCategory || existing.subCategory || null,
                mainCategory: localItem.mainCategory || existing.mainCategory || null,
                color: localItem.color || existing.color || '黑色',
                price: localItem.price !== null && localItem.price !== undefined ? localItem.price : (existing.price !== null && existing.price !== undefined ? existing.price : null),
                season: mapSeason(localItem.season || existing.season || '四季'),
                updatedAt: localItem.updatedAt, // 使用远程的更新时间
              };
              const updated = prev.map((item) =>
                item.id === localItem.id ? mergedItem : item
              );
              // 同时更新 localStorage
              localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
              return updated;
            }
            return prev;
          } else {
            // 添加新项目
            const updated = [localItem, ...prev];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
          }
        });
      } else {
        setDaughterClothesItems((prev) => {
          const existing = prev.find((item) => item.id === localItem.id);
          if (existing) {
            const existingUpdated = new Date(existing.updatedAt || existing.createdAt || 0);
            const newUpdated = new Date(localItem.updatedAt || localItem.createdAt || 0);
            if (newUpdated > existingUpdated) {
              // 远程更新，更新本地，但保留本地数据中存在的字段（如果远程数据缺少这些字段）
              const mergedItem = {
                ...existing, // 先保留本地数据的所有字段
                ...localItem, // 然后用远程数据覆盖
                // 确保关键字段不会丢失（如果远程数据为空，使用本地数据）
                purchaseDate: localItem.purchaseDate || existing.purchaseDate || null,
                colorHex: localItem.colorHex || existing.colorHex || '#000000',
                subCategory: localItem.subCategory || existing.subCategory || null,
                mainCategory: localItem.mainCategory || existing.mainCategory || null,
                color: localItem.color || existing.color || '黑色',
                price: localItem.price !== null && localItem.price !== undefined ? localItem.price : (existing.price !== null && existing.price !== undefined ? existing.price : null),
                season: mapSeason(localItem.season || existing.season || '四季'),
                updatedAt: localItem.updatedAt, // 使用远程的更新时间
              };
              const updated = prev.map((item) =>
                item.id === localItem.id ? mergedItem : item
              );
              localStorage.setItem(STORAGE_KEY_DAUGHTER, JSON.stringify(updated));
              return updated;
            }
            return prev;
          } else {
            const updated = [localItem, ...prev];
            localStorage.setItem(STORAGE_KEY_DAUGHTER, JSON.stringify(updated));
            return updated;
          }
        });
      }
    } else if (eventType === "DELETE") {
      // 删除项目
      if (type === "clothes") {
        setClothesItems((prev) => {
          const updated = prev.filter((item) => item.id !== oldItem.id);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
      } else {
        setDaughterClothesItems((prev) => {
          const updated = prev.filter((item) => item.id !== oldItem.id);
          localStorage.setItem(STORAGE_KEY_DAUGHTER, JSON.stringify(updated));
          return updated;
        });
      }
    }
  }

  /**
   * 清理同步订阅
   */
  function cleanupSync() {
    if (syncChannelRef.current) {
      supabase.removeChannel(syncChannelRef.current);
      syncChannelRef.current = null;
    }
    isInitialSyncRef.current = false;
  }

  /**
   * 上传单个项目到云端（在数据操作后调用）
   */
  async function syncItemToCloud(item, type, operation = "upsert") {
    if (!session?.user) return;

    const tableName = type === "clothes" ? "clothes_items" : "daughter_clothes_items";

    try {
      if (operation === "delete") {
        await deleteItemFromSupabase(supabase, item.id, tableName);
      } else {
        await uploadItemsToSupabase(supabase, [item], session.user.id, tableName);
      }
    } catch (error) {
      console.error(`同步${type === "clothes" ? "衣物" : "女儿衣物"}失败:`, error);
      // 不阻塞用户操作，静默失败
    }
  }

  /**
   * 导入 JSON 数据
   */
  async function handleImportData() {
    if (!session?.user) {
      setImportError("请先登录");
      return;
    }

    setIsImporting(true);
    setImportError("");

    try {
      // 解析 JSON 数据
      let parsedData;
      try {
        parsedData = JSON.parse(importData);
      } catch (e) {
        throw new Error("JSON 格式错误，请检查数据格式");
      }

      // 验证数据格式
      let clothesData = [];
      let daughterData = [];

      // 处理不同的数据格式
      if (Array.isArray(parsedData)) {
        // 如果是数组，假设是衣物数据
        clothesData = parsedData;
      } else if (parsedData.clothesItems || parsedData.clothes) {
        // 如果是对象，尝试提取 clothesItems 和 daughterClothesItems
        clothesData = parsedData.clothesItems || parsedData.clothes || [];
        daughterData = parsedData.daughterClothesItems || parsedData.daughter || [];
      } else if (parsedData.localStorage) {
        // 如果是导出格式（包含 localStorage 对象，值可能是 JSON 字符串）
        const localStorage = parsedData.localStorage;
        
        // 处理 grace_stuff_clothes_v1（可能是字符串或数组）
        if (localStorage.grace_stuff_clothes_v1) {
          if (typeof localStorage.grace_stuff_clothes_v1 === 'string') {
            // 如果是字符串，需要再次解析
            try {
              clothesData = JSON.parse(localStorage.grace_stuff_clothes_v1);
            } catch (e) {
              console.error("解析 clothes 数据失败:", e);
              clothesData = [];
            }
          } else if (Array.isArray(localStorage.grace_stuff_clothes_v1)) {
            clothesData = localStorage.grace_stuff_clothes_v1;
          }
        }
        
        // 处理 grace_stuff_daughter_clothes_v1（可能是字符串或数组）
        if (localStorage.grace_stuff_daughter_clothes_v1) {
          if (typeof localStorage.grace_stuff_daughter_clothes_v1 === 'string') {
            // 如果是字符串，需要再次解析
            try {
              daughterData = JSON.parse(localStorage.grace_stuff_daughter_clothes_v1);
            } catch (e) {
              console.error("解析 daughter 数据失败:", e);
              daughterData = [];
            }
          } else if (Array.isArray(localStorage.grace_stuff_daughter_clothes_v1)) {
            daughterData = localStorage.grace_stuff_daughter_clothes_v1;
          }
        }
      } else if (parsedData.grace_stuff_clothes_v1 || parsedData[STORAGE_KEY]) {
        // 如果是直接的 localStorage 格式（键值对，值可能是字符串或数组）
        const clothesRaw = parsedData.grace_stuff_clothes_v1 || parsedData[STORAGE_KEY];
        const daughterRaw = parsedData.grace_stuff_daughter_clothes_v1 || parsedData[STORAGE_KEY_DAUGHTER];
        
        // 处理可能是字符串的情况
        if (typeof clothesRaw === 'string') {
          try {
            clothesData = JSON.parse(clothesRaw);
          } catch (e) {
            clothesData = [];
          }
        } else if (Array.isArray(clothesRaw)) {
          clothesData = clothesRaw;
        }
        
        if (typeof daughterRaw === 'string') {
          try {
            daughterData = JSON.parse(daughterRaw);
          } catch (e) {
            daughterData = [];
          }
        } else if (Array.isArray(daughterRaw)) {
          daughterData = daughterRaw;
        }
      } else {
        throw new Error("无法识别数据格式，请确保是有效的 JSON 格式。支持格式：数组、对象（clothesItems/daughterClothesItems）、localStorage 导出格式");
      }

      // 验证数据项格式
      const validateItem = (item) => {
        return item && typeof item === 'object' && item.name && item.id;
      };

      // 应用频率和季节映射
      const validClothes = Array.isArray(clothesData) ? clothesData.filter(validateItem).map(item => ({
        ...item,
        frequency: mapFrequency(item.frequency),
        season: mapSeason(item.season)
      })) : [];
      const validDaughter = Array.isArray(daughterData) ? daughterData.filter(validateItem).map(item => ({
        ...item,
        frequency: mapFrequency(item.frequency),
        season: mapSeason(item.season)
      })) : [];

      if (validClothes.length === 0 && validDaughter.length === 0) {
        throw new Error("未找到有效的数据，请检查数据格式");
      }

      // 为每个项目添加 updatedAt（如果不存在），并映射频率值
      const processedClothes = validClothes.map(item => ({
        ...item,
        updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
        createdAt: item.createdAt || new Date().toISOString(),
        frequency: mapFrequency(item.frequency),
      }));

      const processedDaughter = validDaughter.map(item => ({
        ...item,
        updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
        createdAt: item.createdAt || new Date().toISOString(),
        frequency: mapFrequency(item.frequency),
      }));

      // 合并到现有数据（避免重复）
      const existingClothesIds = new Set(clothesItems.map(item => item.id));
      const existingDaughterIds = new Set(daughterClothesItems.map(item => item.id));

      const newClothes = processedClothes.filter(item => !existingClothesIds.has(item.id));
      const newDaughter = processedDaughter.filter(item => !existingDaughterIds.has(item.id));

      // 更新状态
      if (newClothes.length > 0) {
        setClothesItems(prev => [...newClothes, ...prev]);
      }
      if (newDaughter.length > 0) {
        setDaughterClothesItems(prev => [...newDaughter, ...prev]);
      }

      // 上传到云端
      let uploadErrors = [];
      if (newClothes.length > 0) {
        console.log(`📤 上传 ${newClothes.length} 条衣物数据到云端...`);
        const result = await uploadItemsToSupabase(supabase, newClothes, session.user.id, "clothes_items");
        if (!result.success) {
          console.error("衣物数据上传失败:", result.error);
          uploadErrors.push(`衣物数据上传失败: ${result.error?.message || "未知错误"}`);
        } else {
          console.log(`✅ 衣物数据上传成功: ${result.count} 条`);
        }
      }
      if (newDaughter.length > 0) {
        console.log(`📤 上传 ${newDaughter.length} 条女儿衣物数据到云端...`);
        const result = await uploadItemsToSupabase(supabase, newDaughter, session.user.id, "daughter_clothes_items");
        if (!result.success) {
          console.error("女儿衣物数据上传失败:", result.error);
          uploadErrors.push(`女儿衣物数据上传失败: ${result.error?.message || "未知错误"}`);
        } else {
          console.log(`✅ 女儿衣物数据上传成功: ${result.count} 条`);
        }
      }

      // 成功提示
      const totalImported = newClothes.length + newDaughter.length;
      const skipped = (validClothes.length - newClothes.length) + (validDaughter.length - newDaughter.length);
      
      let message = `成功导入 ${totalImported} 条数据到本地！`;
      if (skipped > 0) {
        message += `（跳过 ${skipped} 条重复数据）`;
      }
      
      if (uploadErrors.length > 0) {
        message += `\n\n⚠️ 警告：云端上传失败\n${uploadErrors.join("\n")}\n\n请检查：\n1. Supabase 数据库表是否已创建\n2. 浏览器控制台是否有详细错误信息`;
        alert(message);
        setImportError(uploadErrors.join("; "));
      } else {
        message += `\n\n✅ 数据已同步到云端，其他设备登录后会自动同步！`;
        alert(message);
        setShowImportModal(false);
        setImportData("");
      }
    } catch (error) {
      console.error("导入错误:", error);
      setImportError(error.message || "导入失败，请检查数据格式");
    } finally {
      setIsImporting(false);
    }
  }

  /**
   * 处理文件上传
   */
  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        setImportData(content);
        setImportError("");
      } catch (error) {
        setImportError("文件读取失败");
      }
    };
    reader.onerror = () => {
      setImportError("文件读取失败");
    };
    reader.readAsText(file);
  }

  // Section 2a-1: Category State
  // `category` state determines whether the user is viewing clothes, beauty products, or daughter's clothes.
  const [category, setCategory] = useState("clothes"); // clothes | beauty | daughterClothes

  // Section 2b: Clothes Items State (Local Storage Persistence)
  // The `clothesItems` state is loaded from localStorage if present, otherwise starts as an empty array.
  // This data persists clothing items using the defined `STORAGE_KEY`.

  const [clothesItems, setClothesItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // 映射历史数据的频率值和季节值，并修复 colorHex
      return parsed.map(item => {
        // 如果 colorHex 不存在，或者 colorHex 是黑色但 color 不是黑色（说明数据有问题），根据 color 字段推断
        let colorHex = item.colorHex;
        const colorName = item.color || '黑色';
        if (!colorHex || colorHex === null || colorHex === undefined || colorHex === '' 
            || (colorHex === '#000000' && colorName !== '黑色')) {
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
          colorHex = colorMap[colorName] || '#000000';
        }
        return {
          ...item,
          frequency: item.frequency ? (() => {
            const frequencyMap = {
              "从未": "从未",
              "很少": "偶尔",
              "偶尔": "偶尔",
              "每月几次": "有时",
              "每周一次": "有时",
              "每周多次": "经常",
              "每天": "每天",
            };
            return frequencyMap[item.frequency] || "偶尔";
          })() : "偶尔",
          season: mapSeason(item.season),
          colorHex: colorHex
        };
      });
    } catch {
      return [];
    }
  });

  // Section 2b-1: Daughter Clothes Items State (Local Storage Persistence)
  // The `daughterClothesItems` state is loaded from localStorage if present, otherwise starts as an empty array.
  // This data persists daughter's clothing items using the defined `STORAGE_KEY_DAUGHTER`.

  const [daughterClothesItems, setDaughterClothesItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DAUGHTER);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // 映射历史数据的频率值和季节值，并修复 colorHex
      return parsed.map(item => {
        // 如果 colorHex 不存在，或者 colorHex 是黑色但 color 不是黑色（说明数据有问题），根据 color 字段推断
        let colorHex = item.colorHex;
        const colorName = item.color || '黑色';
        if (!colorHex || colorHex === null || colorHex === undefined || colorHex === '' 
            || (colorHex === '#000000' && colorName !== '黑色')) {
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
          colorHex = colorMap[colorName] || '#000000';
        }
        return {
          ...item,
          frequency: item.frequency ? (() => {
            const frequencyMap = {
              "从未": "从未",
              "很少": "偶尔",
              "偶尔": "偶尔",
              "每月几次": "有时",
              "每周一次": "有时",
              "每周多次": "经常",
              "每天": "每天",
            };
            return frequencyMap[item.frequency] || "偶尔";
          })() : "偶尔",
          season: mapSeason(item.season),
          colorHex: colorHex
        };
      });
    } catch {
      return [];
    }
  });

  // Section 2c: Form Field States
  // States for the controlled form: item name, main category, subcategory, season, purchase date, price, frequency, and color.

  const [cName, setCName] = useState("");
  const [cMainCategory, setCMainCategory] = useState("上衣");
  const [cSubCategory, setCSubCategory] = useState("T恤");
  const [cSeason, setCSeason] = useState("四季"); // String for single-select
  const [cPurchaseDate, setCPurchaseDate] = useState("");
  const [cPrice, setCPrice] = useState("");
  const [cFrequency, setCFrequency] = useState("偶尔");
  const [cColor, setCColor] = useState("黑色");

  // Section 2c-1: Edit State
  // Tracks which item is being edited (null means no item is being edited).

  const [editingItemId, setEditingItemId] = useState(null); // null | itemId

  // Section 2c-2: End Reason Modal State
  // Tracks which item's end reason is being set (null means modal is closed).

  const [endReasonItemId, setEndReasonItemId] = useState(null); // null | itemId

  // Section 2c-3: Filter States
  // Filter states for main category and subcategory.

  const [filterYear, setFilterYear] = useState(""); // "" | "YYYY"
  const [filterSeason, setFilterSeason] = useState(""); // "" | season
  const [filterMainCategory, setFilterMainCategory] = useState(""); // "" | mainCategory
  const [filterSubCategory, setFilterSubCategory] = useState(""); // "" | subCategory

  // Section 2c-5: Selected Item State
  // Tracks which item is currently selected for single selection, or Set for batch delete.

  const [selectedItemId, setSelectedItemId] = useState(null); // null | itemId for single selection
  const [selectedItemIds, setSelectedItemIds] = useState(new Set()); // Set<itemId> for batch delete (only when using "全选")


  // Section 2d: Clothes Categories Definition
  // Main categories and their subcategories for clothing classification.

  const clothesCategories = useMemo(
    () => ({
      上衣: ["T恤", "衬衫", "毛衣", "卫衣", "外套", "背心", "马甲", "打底衣", "其他"],
      下装: ["长裤", "短裤", "半身裙", "打底裤", "其他"],
      连衣裙: ["长袖连衣裙", "短袖连衣裙", "无袖连衣裙", "吊带连衣裙", "其他"],
      内衣裤: ["内衣", "内裤", "袜子", "其他"],
      运动服: ["运动上衣", "运动裤", "运动套装", "其他"],
      套装: ["西装套装", "休闲套装", "睡衣套装", "其他"],
      鞋类: ["运动鞋", "皮鞋", "凉鞋", "靴子", "拖鞋", "其他"],
      包包类: ["手提包", "背包", "斜挎包", "钱包", "其他"],
      帽子类: ["棒球帽", "渔夫帽", "贝雷帽", "毛线帽", "其他"],
    }),
    []
  );

  // Section 2d-1: Main Categories List
  // A list of main category names.

  const mainCategories = useMemo(
    () => Object.keys(clothesCategories),
    [clothesCategories]
  );

  // Section 2d-2: Get Subcategories for Current Main Category
  // Returns the subcategories for the currently selected main category.

  const currentSubCategories = useMemo(
    () => clothesCategories[cMainCategory] || [],
    [clothesCategories, cMainCategory]
  );

  // Section 2d-2-1: Get Subcategories for Filter Main Category
  // Returns the subcategories for the currently selected filter main category.

  const filterSubCategories = useMemo(
    () => (filterMainCategory ? clothesCategories[filterMainCategory] || [] : []),
    [clothesCategories, filterMainCategory]
  );

  // Section 2d-3: Seasons Memoization
  // A memoized list of seasons for clothing items.

  const seasons = useMemo(
    () => ["四季", "春夏", "秋冬"],
    []
  );

  // Section 2d-4: Available Years Memoization
  // Extracts all unique years from purchaseDate fields in both clothesItems and daughterClothesItems.

  const availableYears = useMemo(() => {
    const yearSet = new Set();
    
    // Extract years from clothesItems
    clothesItems.forEach(item => {
      if (item.purchaseDate) {
        // purchaseDate format: "YYYY-MM" or "YYYY"
        const year = item.purchaseDate.split('-')[0];
        if (year && year.length === 4) {
          yearSet.add(year);
        }
      }
    });
    
    // Extract years from daughterClothesItems
    daughterClothesItems.forEach(item => {
      if (item.purchaseDate) {
        const year = item.purchaseDate.split('-')[0];
        if (year && year.length === 4) {
          yearSet.add(year);
        }
      }
    });
    
    // Sort years in descending order (newest first)
    return Array.from(yearSet).sort((a, b) => b.localeCompare(a));
  }, [clothesItems, daughterClothesItems]);

  // Section 2d-3-1: Years and Months for Date Picker
  // Generate years from 2020 to current year, and months 1-12.

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearList = [];
    for (let year = 2020; year <= currentYear; year++) {
      yearList.push(year);
    }
    return yearList;
  }, []);

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }, []);

  // Section 2d-4: Frequency Options
  // A memoized list of frequency options for wearing clothes.

  // Section 2d-4-1: Frequency Mapping Function
  // Maps old frequency values to new frequency values for data migration.

  const mapFrequency = (oldFrequency) => {
    if (!oldFrequency) return "偶尔"; // 默认值
    
    // 如果已经是新格式的值，直接返回
    const newFrequencies = ["从未", "偶尔", "有时", "经常", "每天"];
    if (newFrequencies.includes(oldFrequency)) {
      return oldFrequency;
    }
    
    const frequencyMap = {
      "从未": "从未",
      "很少": "偶尔",
      "偶尔": "偶尔",
      "每月几次": "有时",
      "每周一次": "有时",
      "每周多次": "经常",
      "每天": "每天",
    };
    
    return frequencyMap[oldFrequency] || "偶尔"; // 如果找不到映射，使用默认值
  };

  const frequencies = useMemo(
    () => ["从未", "偶尔", "有时", "经常", "每天"],
    []
  );

  // Section 2d-4-1: End Reason Options
  // Options for ending reason: 丢弃, 出售, 送人.

  const endReasons = useMemo(
    () => ["丢弃", "出售", "送人"],
    []
  );

  // Section 2d-5: Color Options
  // A list of color options with their hex color codes for display.

  const colors = useMemo(
    () => [
      { name: "黑色", hex: "#000000" },
      { name: "白色", hex: "#FFFFFF" },
      { name: "灰色", hex: "#808080" },
      { name: "红色", hex: "#FF0000" },
      { name: "蓝色", hex: "#0000FF" },
      { name: "浅蓝色", hex: "#ADD8E6" },
      { name: "绿色", hex: "#008000" },
      { name: "黄色", hex: "#FFFF00" },
      { name: "粉色", hex: "#FFC0CB" },
      { name: "紫色", hex: "#800080" },
      { name: "浅紫色", hex: "#DDA0DD" },
      { name: "棕色", hex: "#A52A2A" },
      { name: "米色", hex: "#F5F5DC" },
      { name: "卡其色", hex: "#C3B091" },
      { name: "驼色", hex: "#D2B48C" },
      { name: "军绿色", hex: "#4B5320" },
      { name: "藏青色", hex: "#1E3A5F" },
      { name: "其他", hex: "#CCCCCC" },
    ],
    []
  );

  // Section 2d-6: Subcategory Icons
  // A mapping of subcategories to their icon representations.

  const subCategoryIcons = useMemo(
    () => ({
      // 上衣
      "T恤": "👕",
      衬衫: "👔",
      毛衣: "🧶",
      卫衣: "🎽",
      外套: "🧥",
      背心: "🦺",
      马甲: "🎽",
      打底衣: "👕",
      // 下装
      长裤: "👖",
      短裤: "🩳",
      半身裙: "👗",
      打底裤: "👖",
      // 连衣裙
      长袖连衣裙: "👗",
      短袖连衣裙: "👗",
      无袖连衣裙: "👗",
      吊带连衣裙: "👗",
      // 内衣裤
      内衣: "🩱",
      内裤: "🩲",
      袜子: "🧦",
      // 运动服
      运动上衣: "👕",
      运动裤: "👖",
      运动套装: "🏋️",
      // 套装
      西装套装: "👔",
      休闲套装: "👕",
      睡衣套装: "🛏️",
      // 鞋类
      运动鞋: "👟",
      皮鞋: "👞",
      凉鞋: "🩴",
      靴子: "👢",
      拖鞋: "🩴",
      // 包包类
      手提包: "👜",
      背包: "🎒",
      斜挎包: "👝",
      钱包: "💼",
      // 帽子类
      棒球帽: "🧢",
      渔夫帽: "🎩",
      贝雷帽: "👒",
      毛线帽: "🧶",
      // 默认
      其他: "👕",
    }),
    []
  );

  // Section 2d-7: Get Icon for Subcategory
  // Returns the icon for a subcategory.

  function getSubCategoryIcon(subCategory) {
    return subCategoryIcons[subCategory] || "👕";
  }

  // Section 2d-7-0: Map Season Data
  // Maps old season values to new single-select options.
  // Mapping rules:
  // - 四季 -> 四季
  // - 春秋 -> 春夏
  // - 夏 -> 春夏
  // - 冬 -> 秋冬
  // For arrays, maps each element and returns the first mapped value (or "四季" as default).

  function mapSeason(season) {
    if (!season) return "四季";
    
    // Handle array format (old multi-select)
    if (Array.isArray(season)) {
      if (season.length === 0) return "四季";
      // Map each season and return the first one
      // Priority: if contains "四季", return "四季"; else map the first one
      if (season.includes("四季")) return "四季";
      if (season.includes("春秋")) return "春夏";
      if (season.includes("夏")) return "春夏";
      if (season.includes("冬")) return "秋冬";
      // If array contains new format, return the first one
      if (season.includes("春夏")) return "春夏";
      if (season.includes("秋冬")) return "秋冬";
      // Fallback: map the first element
      const first = season[0];
      if (first === "四季") return "四季";
      if (first === "春秋") return "春夏";
      if (first === "夏") return "春夏";
      if (first === "冬") return "秋冬";
      return first; // Already in new format
    }
    
    // Handle string format
    if (season === "四季") return "四季";
    if (season === "春秋") return "春夏";
    if (season === "夏") return "春夏";
    if (season === "冬") return "秋冬";
    // Already in new format
    if (season === "春夏" || season === "秋冬") return season;
    // Unknown value, default to "四季"
    return "四季";
  }

  // Section 2d-7-1: Normalize Season Data
  // Converts season data to string format (single-select).

  function normalizeSeason(season) {
    return mapSeason(season);
  }

  // Section 2d-7-2: Format Season for Display
  // Returns the season string directly (no formatting needed for single-select).

  function formatSeasonForDisplay(season) {
    return normalizeSeason(season);
  }

  // Section 2d-7-3: Parse Purchase Date
  // Parses purchase date string (YYYY-MM format) to year and month.

  function parsePurchaseDate(dateStr) {
    if (!dateStr) return { year: null, month: null };
    try {
      const match = dateStr.match(/^(\d{4})-(\d{2})$/);
      if (match) {
        return { year: parseInt(match[1]), month: parseInt(match[2]) };
      }
      // Try full date format
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return { year: date.getFullYear(), month: date.getMonth() + 1 };
      }
    } catch {
      // ignore
    }
    return { year: null, month: null };
  }

  // Section 2d-7-4: Format Purchase Date
  // Formats year and month to YYYY-MM format.
  // If only year is provided, returns YYYY-01 format to preserve year selection.

  function formatPurchaseDate(year, month) {
    if (!year) return "";
    if (!month) return `${year}-01`; // Use 01 as placeholder month to preserve year
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  // Section 2c-1: Handle Main Category Change
  // When main category changes, reset subcategory to the first option of the new category.
  // But only if the current subcategory is not in the new category's subcategories list.

  useEffect(() => {
    if (currentSubCategories.length > 0) {
      // 如果当前子分类不在新主分类的选项列表中，才重置为第一个选项
      if (!currentSubCategories.includes(cSubCategory)) {
        setCSubCategory(currentSubCategories[0]);
      }
    }
  }, [cMainCategory, currentSubCategories, cSubCategory]);

  // Section 2e-0: Sorted and Filtered Clothes Items
  // Sorts clothes items: items with endReason go to the end.
  // Filters by main category and subcategory if filters are set.

  const sortedClothesItems = useMemo(() => {
    let filtered = clothesItems;
    
    // Filter by year if set
    if (filterYear) {
      filtered = filtered.filter((item) => {
        if (!item.purchaseDate) return false;
        const year = item.purchaseDate.split('-')[0];
        return year === filterYear;
      });
    }
    
    // Filter by season if set
    if (filterSeason) {
      filtered = filtered.filter((item) => {
        const itemSeason = mapSeason(item.season);
        return itemSeason === filterSeason;
      });
    }
    
    // Filter by main category if set
    if (filterMainCategory) {
      filtered = filtered.filter((item) => item.mainCategory === filterMainCategory);
    }
    
    // Filter by subcategory if set
    if (filterSubCategory) {
      filtered = filtered.filter((item) => item.subCategory === filterSubCategory);
    }
    
    const active = filtered.filter((item) => !item.endReason);
    const ended = filtered.filter((item) => item.endReason);
    return [...active, ...ended];
  }, [clothesItems, filterYear, filterSeason, filterMainCategory, filterSubCategory]);

  // Section 2e-0-1: Sorted and Filtered Daughter Clothes Items
  // Sorts daughter clothes items: items with endReason go to the end.
  // Filters by main category and subcategory if filters are set.

  const sortedDaughterClothesItems = useMemo(() => {
    let filtered = daughterClothesItems;
    
    // Filter by year if set
    if (filterYear) {
      filtered = filtered.filter((item) => {
        if (!item.purchaseDate) return false;
        const year = item.purchaseDate.split('-')[0];
        return year === filterYear;
      });
    }
    
    // Filter by season if set
    if (filterSeason) {
      filtered = filtered.filter((item) => {
        const itemSeason = mapSeason(item.season);
        return itemSeason === filterSeason;
      });
    }
    
    // Filter by main category if set
    if (filterMainCategory) {
      filtered = filtered.filter((item) => item.mainCategory === filterMainCategory);
    }
    
    // Filter by subcategory if set
    if (filterSubCategory) {
      filtered = filtered.filter((item) => item.subCategory === filterSubCategory);
    }
    
    const active = filtered.filter((item) => !item.endReason);
    const ended = filtered.filter((item) => item.endReason);
    return [...active, ...ended];
  }, [daughterClothesItems, filterYear, filterSeason, filterMainCategory, filterSubCategory]);

  // Section 2e-0-2: Filter Statistics for Clothes Items
  // Calculates statistics for filtered clothes items: count and total price.

  const clothesFilterStats = useMemo(() => {
    const count = sortedClothesItems.length;
    const totalPrice = sortedClothesItems.reduce((sum, item) => {
      const price = item.price;
      return sum + (price !== null && price !== undefined ? Number(price) : 0);
    }, 0);
    return { count, totalPrice };
  }, [sortedClothesItems]);

  // Section 2e-0-3: Filter Statistics for Daughter Clothes Items
  // Calculates statistics for filtered daughter clothes items: count and total price.

  const daughterClothesFilterStats = useMemo(() => {
    const count = sortedDaughterClothesItems.length;
    const totalPrice = sortedDaughterClothesItems.reduce((sum, item) => {
      const price = item.price;
      return sum + (price !== null && price !== undefined ? Number(price) : 0);
    }, 0);
    return { count, totalPrice };
  }, [sortedDaughterClothesItems]);

  // Section 2e: Persist Clothes Items to Local Storage
  // Whenever `clothesItems` changes, save the updated array to localStorage.
  // This keeps user data persistent between sessions.

  // Section 2e-0: Migrate Frequency Values
  // On component mount, check and migrate all frequency values in existing data.
  // This ensures all historical data is properly mapped to new frequency options.

  // 注意：数据迁移已在useState初始化时完成，这里不再需要额外的迁移逻辑
  // 如果未来需要迁移其他字段，可以在这里添加

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clothesItems));
    } catch {
      // ignore storage failure (rare)
    }
  }, [clothesItems]);

  // Section 2e-1: Persist Daughter Clothes Items to Local Storage
  // Whenever `daughterClothesItems` changes, save the updated array to localStorage.
  // This keeps daughter's clothes data persistent between sessions.

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DAUGHTER, JSON.stringify(daughterClothesItems));
    } catch {
      // ignore storage failure (rare)
    }
  }, [daughterClothesItems]);

  // Section 2f: Calculate Purchase Duration
  // Calculates the duration in years from purchase date to today.
  // Supports both month format (YYYY-MM) and full date format.

  function calculatePurchaseDuration(purchaseDate) {
    if (!purchaseDate) return null;
    try {
      // Handle month format (YYYY-MM) or full date format
      const dateStr = purchaseDate.includes("T") || purchaseDate.includes(" ") 
        ? purchaseDate 
        : purchaseDate + (purchaseDate.match(/^\d{4}-\d{2}$/) ? "-01" : "");
      const purchase = new Date(dateStr);
      if (isNaN(purchase.getTime())) return null;
      const today = new Date();
      const years = (today - purchase) / (1000 * 60 * 60 * 24 * 365.25);
      return years > 0 ? years.toFixed(1) : "0.0";
    } catch {
      return null;
    }
  }

  // Section 2f-1: Add Clothes Item Handler
  // Adds a new clothing item with a unique ID, main category, subcategory, name, season, purchase date, price, frequency, color, and creation date to the state.
  // After adding, resets the form fields.

  function addClothesItem() {
    const name = cName.trim();
    if (!name) return;

    const selectedColor = colors.find((c) => c.name === cColor);
    const item = {
      id: crypto.randomUUID(),
      name,
      mainCategory: cMainCategory,
      subCategory: cSubCategory,
      season: mapSeason(cSeason),
      purchaseDate: cPurchaseDate || null,
      price: cPrice.trim() ? parseFloat(cPrice) || null : null,
      frequency: mapFrequency(cFrequency),
      color: cColor,
      colorHex: selectedColor?.hex || "#CCCCCC",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setClothesItems((prev) => [item, ...prev]);
    
    // 同步到云端
    syncItemToCloud(item, "clothes", "upsert");
    
    setCName("");
    setCMainCategory("上衣");
    setCSubCategory("T恤");
    setCSeason("四季");
    setCPurchaseDate("");
    setCPrice("");
    setCFrequency("偶尔");
    setCColor("黑色");
  }

  // Section 2g: Remove Clothes Item Handler
  // Removes a clothing item by its unique ID.

  function removeClothesItem(id) {
    const item = clothesItems.find((x) => x.id === id);
    setClothesItems((prev) => prev.filter((x) => x.id !== id));
    
    // 同步删除到云端
    if (item) {
      syncItemToCloud(item, "clothes", "delete");
    }
  }

  // Section 2g-1: Update Clothes Item Handler
  // Updates an existing clothing item with new values.

  function updateClothesItem(id) {
    const name = cName.trim();
    if (!name) return;

    const selectedColor = colors.find((c) => c.name === cColor);
    let updatedItem = null;
    setClothesItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          updatedItem = {
            ...item,
            name,
            mainCategory: cMainCategory,
            subCategory: cSubCategory,
            season: mapSeason(cSeason),
            purchaseDate: cPurchaseDate || null,
            price: cPrice.trim() ? parseFloat(cPrice) || null : null,
            frequency: mapFrequency(cFrequency),
            color: cColor,
            colorHex: selectedColor?.hex || item.colorHex || "#CCCCCC",
            updatedAt: new Date().toISOString(),
          };
          return updatedItem;
        }
        return item;
      })
    );
    
    // 同步更新到云端
    if (updatedItem) {
      syncItemToCloud(updatedItem, "clothes", "upsert");
    }
    
    setEditingItemId(null);
    // 保存完成后，清除选中状态
    if (selectedItemId === id) {
      setSelectedItemId(null);
    }
    setCName("");
    setCMainCategory("上衣");
    setCSubCategory("T恤");
    setCSeason("四季");
    setCPurchaseDate("");
    setCPrice("");
    setCFrequency("偶尔");
    setCColor("黑色");
  }

  // Section 2g-2: Start Edit Clothes Item Handler
  // Loads an item's data into the form for editing.

  function startEditClothesItem(item) {
    setEditingItemId(item.id);
    setCName(item.name);
    const mainCategory = item.mainCategory || "上衣";
    // 确保子分类在主分类的选项列表中，否则使用该主分类的第一个选项
    const availableSubCategories = clothesCategories[mainCategory] || [];
    const subCategory = item.subCategory && availableSubCategories.includes(item.subCategory)
      ? item.subCategory
      : (availableSubCategories[0] || "其他");
    // 先设置主分类，然后立即设置子分类
    setCMainCategory(mainCategory);
    setCSubCategory(subCategory);
    setCSeason(normalizeSeason(item.season));
    setCPurchaseDate(item.purchaseDate || "");
    setCPrice(item.price !== null && item.price !== undefined ? String(item.price) : "");
    setCFrequency(mapFrequency(item.frequency || "偶尔"));
    setCColor(item.color || "黑色");
  }

  // Section 2g-3: Cancel Edit Handler
  // Cancels editing and resets form fields.

  function cancelEdit() {
    setEditingItemId(null);
    setCName("");
    setCMainCategory("上衣");
    setCSubCategory("T恤");
    setCSeason("四季");
    setCPurchaseDate("");
    setCPrice("");
    setCFrequency("偶尔");
    setCColor("黑色");
  }

  // Section 2g-3-1: Copy Clothes Item Handler
  // Copies an item's data into the form for creating a new item (e.g., same item in different color).

  function copyClothesItem(item) {
    setEditingItemId(null); // Ensure we're in add mode, not edit mode
    setCName(item.name);
    setCMainCategory(item.mainCategory || "上衣");
    setCSubCategory(item.subCategory || "T恤");
    setCSeason(normalizeSeason(item.season));
    setCPurchaseDate(item.purchaseDate || "");
    setCPrice(item.price !== null && item.price !== undefined ? String(item.price) : "");
    setCFrequency(mapFrequency(item.frequency || "偶尔"));
    setCColor("黑色"); // Reset color so user can choose different color
    // Scroll to form area (optional, but helpful UX)
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Section 2g-4: Set End Reason Handler
  // Sets the end reason and date for a clothing item.

  function setEndReason(id, reason) {
    let updatedItem = null;
    setClothesItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          updatedItem = {
            ...item,
            endReason: reason,
            endDate: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          return updatedItem;
        }
        return item;
      })
    );
    
    // 同步更新到云端
    if (updatedItem) {
      syncItemToCloud(updatedItem, "clothes", "upsert");
    }
    
    setEndReasonItemId(null);
  }

  // Section 2f-2: Add Daughter Clothes Item Handler
  // Adds a new clothing item for daughter with a unique ID, main category, subcategory, name, season, purchase date, price, frequency, color, and creation date to the state.
  // After adding, resets the form fields.

  function addDaughterClothesItem() {
    const name = cName.trim();
    if (!name) return;

    const selectedColor = colors.find((c) => c.name === cColor);
    const item = {
      id: crypto.randomUUID(),
      name,
      mainCategory: cMainCategory,
      subCategory: cSubCategory,
      season: mapSeason(cSeason),
      purchaseDate: cPurchaseDate || null,
      price: cPrice.trim() ? parseFloat(cPrice) || null : null,
      frequency: mapFrequency(cFrequency),
      color: cColor,
      colorHex: selectedColor?.hex || "#CCCCCC",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDaughterClothesItems((prev) => [item, ...prev]);
    
    // 同步到云端
    syncItemToCloud(item, "daughter", "upsert");
    
    setCName("");
    setCMainCategory("上衣");
    setCSubCategory("T恤");
    setCSeason("四季");
    setCPurchaseDate("");
    setCPrice("");
    setCFrequency("偶尔");
    setCColor("黑色");
  }

  // Section 2g-1: Remove Daughter Clothes Item Handler
  // Removes a daughter's clothing item by its unique ID.

  function removeDaughterClothesItem(id) {
    const item = daughterClothesItems.find((x) => x.id === id);
    setDaughterClothesItems((prev) => prev.filter((x) => x.id !== id));
    
    // 同步删除到云端
    if (item) {
      syncItemToCloud(item, "daughter", "delete");
    }
  }

  // Section 2g-5: Update Daughter Clothes Item Handler
  // Updates an existing daughter clothing item with new values.

  function updateDaughterClothesItem(id) {
    const name = cName.trim();
    if (!name) return;

    const selectedColor = colors.find((c) => c.name === cColor);
    let updatedItem = null;
    setDaughterClothesItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          updatedItem = {
            ...item,
            name,
            mainCategory: cMainCategory,
            subCategory: cSubCategory,
            season: mapSeason(cSeason),
            purchaseDate: cPurchaseDate || null,
            price: cPrice.trim() ? parseFloat(cPrice) || null : null,
            frequency: mapFrequency(cFrequency),
            color: cColor,
            colorHex: selectedColor?.hex || item.colorHex || "#CCCCCC",
            updatedAt: new Date().toISOString(),
          };
          return updatedItem;
        }
        return item;
      })
    );
    
    // 同步更新到云端
    if (updatedItem) {
      syncItemToCloud(updatedItem, "daughter", "upsert");
    }
    
    setEditingItemId(null);
    // 保存完成后，清除选中状态
    if (selectedItemId === id) {
      setSelectedItemId(null);
    }
    setCName("");
    setCMainCategory("上衣");
    setCSubCategory("T恤");
    setCSeason("四季");
    setCPurchaseDate("");
    setCPrice("");
    setCFrequency("偶尔");
    setCColor("黑色");
  }

  // Section 2g-6: Start Edit Daughter Clothes Item Handler
  // Loads a daughter item's data into the form for editing.

  function startEditDaughterClothesItem(item) {
    setEditingItemId(item.id);
    setCName(item.name);
    const mainCategory = item.mainCategory || "上衣";
    // 确保子分类在主分类的选项列表中，否则使用该主分类的第一个选项
    const availableSubCategories = clothesCategories[mainCategory] || [];
    const subCategory = item.subCategory && availableSubCategories.includes(item.subCategory)
      ? item.subCategory
      : (availableSubCategories[0] || "其他");
    // 先设置主分类，然后立即设置子分类
    setCMainCategory(mainCategory);
    setCSubCategory(subCategory);
    setCSeason(normalizeSeason(item.season));
    setCPurchaseDate(item.purchaseDate || "");
    setCPrice(item.price !== null && item.price !== undefined ? String(item.price) : "");
    setCFrequency(mapFrequency(item.frequency || "偶尔"));
    setCColor(item.color || "黑色");
  }

  // Section 2g-7: Set End Reason for Daughter Handler
  // Sets the end reason and date for a daughter clothing item.

  function setEndReasonForDaughter(id, reason) {
    let updatedItem = null;
    setDaughterClothesItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          updatedItem = {
            ...item,
            endReason: reason,
            endDate: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          return updatedItem;
        }
        return item;
      })
    );
    
    // 同步更新到云端
    if (updatedItem) {
      syncItemToCloud(updatedItem, "daughter", "upsert");
    }
    
    setEndReasonItemId(null);
  }

  // Section 2g-7-1: Copy Daughter Clothes Item Handler
  // Copies a daughter item's data into the form for creating a new item (e.g., same item in different color).

  function copyDaughterClothesItem(item) {
    setEditingItemId(null); // Ensure we're in add mode, not edit mode
    setCName(item.name);
    setCMainCategory(item.mainCategory || "上衣");
    setCSubCategory(item.subCategory || "T恤");
    setCSeason(normalizeSeason(item.season));
    setCPurchaseDate(item.purchaseDate || "");
    setCPrice(item.price !== null && item.price !== undefined ? String(item.price) : "");
    setCFrequency(mapFrequency(item.frequency || "偶尔"));
    setCColor("黑色"); // Reset color so user can choose different color
    // Scroll to form area (optional, but helpful UX)
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Section 2h: Render Logic
  // The returned JSX presents the UI:
  // - A header and description
  // - Toggle buttons to switch category: clothes or beauty
  // - For clothing:
  //   - Form to add a new item, with name, categories, season, purchase date, price, and frequency fields.
  //   - A list of clothing items, each displaying name, categories, season, purchase date, price, frequency, and can be deleted.
  // - For beauty:
  //   - Placeholder text indicating this section is under development.

  // Show login screen if not authenticated
  if (!session) {
    return (
      <div style={{ 
        padding: "clamp(16px, 4vw, 24px)", 
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "clamp(16px, 4vw, 24px)",
        boxSizing: "border-box"
      }}>
        <div style={{ 
          textAlign: "center", 
          maxWidth: 400, 
          width: "100%",
          padding: "0 16px",
          boxSizing: "border-box"
        }}>
          <h1 style={{ 
            marginBottom: 8,
            fontSize: "clamp(24px, 6vw, 32px)"
          }}>Grace&apos;s stuff</h1>
          <p style={{ 
            marginTop: 0, 
            color: "#2d8659", 
            marginBottom: "clamp(24px, 6vw, 32px)",
            fontSize: "clamp(18px, 5vw, 24px)",
            fontWeight: 700,
            letterSpacing: "0.5px",
            textAlign: "center",
            padding: "clamp(12px, 3vw, 16px)",
            backgroundColor: "#f0f7ff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0, 102, 204, 0.15)",
            whiteSpace: "nowrap"
          }}>
            Less is more-长期主义
          </p>
          
          <form onSubmit={handleAuthSubmit} style={{ 
            display: "flex", 
            flexDirection: "column", 
            gap: "clamp(12px, 3vw, 16px)",
            width: "100%",
            maxWidth: 320,
            margin: "0 auto"
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="email"
                placeholder="邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                style={{
                  padding: "clamp(12px, 3vw, 14px) clamp(14px, 3.5vw, 16px)",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  fontSize: "clamp(14px, 3.5vw, 16px)",
                  width: "100%",
                  boxSizing: "border-box",
                  WebkitAppearance: "none"
                }}
              />
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                style={{
                  padding: "clamp(12px, 3vw, 14px) clamp(14px, 3.5vw, 16px)",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  fontSize: "clamp(14px, 3.5vw, 16px)",
                  width: "100%",
                  boxSizing: "border-box",
                  WebkitAppearance: "none"
                }}
              />
            </div>
            
            {authError && (
              <div style={{
                padding: "8px 12px",
                borderRadius: 6,
                backgroundColor: "#fee",
                color: "#c33",
                fontSize: 13,
                textAlign: "left"
              }}>
                {authError}
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "clamp(12px, 3vw, 14px) clamp(20px, 5vw, 24px)",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: loading ? "#ccc" : "#fff",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "clamp(15px, 4vw, 16px)",
                fontWeight: 500,
                width: "100%",
                minHeight: "44px", // iOS recommended touch target size
                WebkitAppearance: "none"
              }}
            >
              {loading ? "处理中..." : (isSignUp ? "注册" : "登录")}
            </button>
            
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError("");
                setEmail("");
                setPassword("");
              }}
              disabled={loading}
              style={{
                padding: "clamp(8px, 2vw, 10px) clamp(14px, 3.5vw, 16px)",
                borderRadius: 6,
                border: "none",
                background: "transparent",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "clamp(13px, 3.5vw, 14px)",
                color: "#666",
                textDecoration: "underline",
                minHeight: "44px" // iOS recommended touch target size
              }}
            >
              {isSignUp ? "已有账号？去登录" : "没有账号？去注册"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: "16px", 
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      maxWidth: "100%",
      boxSizing: "border-box"
    }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "flex-start", 
        marginBottom: 16,
        flexWrap: "wrap",
        gap: 12
      }}>
        <div style={{ flex: "1", minWidth: "200px" }}>
          <h1 style={{ marginBottom: 8, marginTop: 0, fontSize: "clamp(20px, 5vw, 28px)" }}>Grace&apos;s stuff</h1>
          <p style={{ 
            marginTop: 0, 
            color: "#2d8659", 
            fontSize: "clamp(16px, 4vw, 20px)",
            fontWeight: 700,
            letterSpacing: "0.5px",
            padding: "clamp(10px, 2.5vw, 14px)",
            backgroundColor: "#f0f7ff",
            borderRadius: "10px",
            boxShadow: "0 2px 6px rgba(0, 102, 204, 0.15)",
            marginBottom: 8,
            whiteSpace: "nowrap"
          }}>
            Less is more-长期主义
          </p>
        </div>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 8,
          flexWrap: "wrap"
        }}>
          {session?.user && (
            <span style={{ 
              color: "#666", 
              fontSize: "clamp(11px, 2.5vw, 13px)",
              wordBreak: "break-all",
              maxWidth: "150px",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}>
              {session.user.email || session.user.user_metadata?.user_name || "已登录"}
            </span>
          )}
          <button
            onClick={() => setShowImportModal(true)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #4CAF50",
              background: "#fff",
              cursor: "pointer",
              fontSize: "clamp(12px, 3vw, 14px)",
              color: "#4CAF50",
              whiteSpace: "nowrap"
            }}
          >
            导入数据
          </button>
          <button
            onClick={async () => {
              if (!session?.user) {
                alert("请先登录");
                return;
              }
              if (confirm("确定要将本地数据上传到云端吗？这会将所有本地数据同步到 Supabase。")) {
                setIsSyncing(true);
                setSyncError("");
                try {
                  console.log("📤 手动上传本地数据到云端...");
                  const result1 = await uploadItemsToSupabase(supabase, clothesItems, session.user.id, "clothes_items");
                  const result2 = await uploadItemsToSupabase(supabase, daughterClothesItems, session.user.id, "daughter_clothes_items");
                  
                  if (result1.success && result2.success) {
                    alert(`✅ 上传成功！\n衣物: ${result1.count} 条\n女儿衣物: ${result2.count} 条\n\n其他设备登录后会自动同步这些数据。`);
                    setSyncError("");
                  } else {
                    const errors = [];
                    if (!result1.success) errors.push(`衣物: ${result1.error?.message || "上传失败"}`);
                    if (!result2.success) errors.push(`女儿衣物: ${result2.error?.message || "上传失败"}`);
                    alert(`❌ 上传失败：\n${errors.join("\n")}\n\n请检查浏览器控制台的详细错误信息。`);
                    setSyncError(errors.join("; "));
                  }
                } catch (error) {
                  console.error("上传失败:", error);
                  alert(`❌ 上传失败: ${error.message}\n\n请检查：\n1. Supabase 表是否已创建\n2. 浏览器控制台的错误信息`);
                  setSyncError(error.message);
                } finally {
                  setIsSyncing(false);
                }
              }
            }}
            disabled={isSyncing}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #2196F3",
              background: isSyncing ? "#ccc" : "#fff",
              cursor: isSyncing ? "not-allowed" : "pointer",
              fontSize: "clamp(12px, 3vw, 14px)",
              color: "#2196F3",
              whiteSpace: "nowrap"
            }}
          >
            {isSyncing ? "同步中..." : "上传到云端"}
          </button>
          <button
            onClick={signOut}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
              fontSize: "clamp(12px, 3vw, 14px)",
              color: "#666",
              whiteSpace: "nowrap"
            }}
          >
            登出
          </button>
        </div>
      </div>

      <div style={{ 
        display: "flex", 
        gap: 8, 
        margin: "16px 0",
        flexWrap: "wrap"
      }}>
        <button
          onClick={() => {
            setCategory("clothes");
            setSelectedItemId(null);
            setSelectedItemIds(new Set());
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: category === "clothes" ? "#eee" : "white",
            cursor: "pointer",
            fontSize: "clamp(13px, 3.5vw, 15px)",
            flex: "1",
            minWidth: "80px"
          }}
        >
          Grace的衣物
        </button>

        <button
          onClick={() => {
            setCategory("daughterClothes");
            setSelectedItemId(null);
            setSelectedItemIds(new Set());
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: category === "daughterClothes" ? "#eee" : "white",
            cursor: "pointer",
            fontSize: "clamp(13px, 3.5vw, 15px)",
            flex: "1",
            minWidth: "100px"
          }}
        >
          Skye的衣物
        </button>

        <button
          onClick={() => {
            setCategory("beauty");
            setSelectedItemId(null);
            setSelectedItemIds(new Set());
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: category === "beauty" ? "#eee" : "white",
            cursor: "pointer",
            fontSize: "clamp(13px, 3.5vw, 15px)",
            flex: "1",
            minWidth: "90px"
          }}
        >
          护肤/化妆
        </button>
      </div>

      <div
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 12,
          padding: "clamp(12px, 3vw, 16px)",
          maxWidth: "100%",
          boxSizing: "border-box"
        }}
      >
        {category === "clothes" ? (
          <div style={{ paddingBottom: sortedClothesItems.length > 0 ? "80px" : "0" }}>
            <h2 style={{ marginTop: 0 }}>Grace的衣物</h2>

            {/* Filter Section */}
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
                margin: "12px 0",
                padding: "12px",
                backgroundColor: "#f9f9f9",
                borderRadius: 10,
                border: "1px solid #e0e0e0",
              }}
            >
              <span style={{ fontSize: 14, color: "#666", marginRight: 4 }}>筛选：</span>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  fontSize: 14,
                  marginRight: 8,
                }}
              >
                <option value="">全部年份</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}年
                  </option>
                ))}
              </select>
              <select
                value={filterSeason}
                onChange={(e) => setFilterSeason(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  fontSize: 14,
                  marginRight: 8,
                }}
              >
                <option value="">全部季节</option>
                {seasons.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={filterMainCategory}
                onChange={(e) => {
                  setFilterMainCategory(e.target.value);
                  setFilterSubCategory(""); // Reset subcategory filter when main category changes
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  fontSize: 14,
                }}
              >
                <option value="">全部主分类</option>
                {mainCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={filterSubCategory}
                onChange={(e) => setFilterSubCategory(e.target.value)}
                disabled={!filterMainCategory}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  fontSize: 14,
                  opacity: filterMainCategory ? 1 : 0.6,
                  cursor: filterMainCategory ? "pointer" : "not-allowed",
                }}
              >
                <option value="">全部子分类</option>
                {filterSubCategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>

              {(filterYear || filterSeason || filterMainCategory || filterSubCategory) && (
                <button
                  onClick={() => {
                    setFilterYear("");
                    setFilterSeason("");
                    setFilterMainCategory("");
                    setFilterSubCategory("");
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  清除筛选
                </button>
              )}
            </div>

            {/* Filter Statistics */}
            {(filterYear || filterSeason || filterMainCategory || filterSubCategory) && (
              <div
                style={{
                  margin: "8px 0 12px 0",
                  padding: "8px 12px",
                  backgroundColor: "#f0f7ff",
                  borderRadius: 8,
                  border: "1px solid #d0e7ff",
                  fontSize: 14,
                  color: "#333",
                }}
              >
                <span style={{ fontWeight: 500 }}>筛选统计：</span>
                <span style={{ marginLeft: 12 }}>
                  共 {clothesFilterStats.count} 件
                </span>
                {clothesFilterStats.totalPrice > 0 && (
                  <span style={{ marginLeft: 16, color: "#0066cc" }}>
                    总金额：¥{clothesFilterStats.totalPrice.toFixed(2)}
                  </span>
                )}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
                margin: "12px 0",
              }}
            >
              <input
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="名称（必填）例如：黑色羊毛大衣"
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  minWidth: 260,
                }}
              />

              <select
                value={cMainCategory}
                onChange={(e) => setCMainCategory(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              >
                {mainCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={cSubCategory}
                onChange={(e) => setCSubCategory(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              >
                {currentSubCategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>

              <select
                value={cSeason}
                onChange={(e) => setCSeason(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              >
                {seasons.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {(() => {
                const currentDate = parsePurchaseDate(cPurchaseDate);
                const selectedYear = currentDate.year;
                // If month is 1 and it might be a placeholder, check if it's actually selected
                const selectedMonth = currentDate.month;
                // Check if the date string ends with "-01" and no month was explicitly selected
                const isPlaceholderMonth = cPurchaseDate && cPurchaseDate.endsWith("-01") && !selectedMonth;
                
                return (
                  <>
                    <select
                      value={selectedYear || ""}
                      onChange={(e) => {
                        const year = e.target.value ? parseInt(e.target.value) : null;
                        if (year) {
                          // If year is selected, preserve month if exists, otherwise use placeholder
                          setCPurchaseDate(formatPurchaseDate(year, selectedMonth));
                        } else {
                          // If year is cleared, clear everything
                          setCPurchaseDate("");
                        }
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #ccc",
                      }}
                    >
                      <option value="">年</option>
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}年
                        </option>
                      ))}
                    </select>
                    <select
                      value={isPlaceholderMonth ? "" : (selectedMonth || "")}
                      onChange={(e) => {
                        const month = e.target.value ? parseInt(e.target.value) : null;
                        if (selectedYear) {
                          setCPurchaseDate(formatPurchaseDate(selectedYear, month));
                        }
                      }}
                      disabled={!selectedYear}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #ccc",
                        opacity: selectedYear ? 1 : 0.6,
                        cursor: selectedYear ? "pointer" : "not-allowed",
                      }}
                    >
                      <option value="">月</option>
                      {months.map((month) => (
                        <option key={month} value={month}>
                          {month}月
                        </option>
                      ))}
                    </select>
                  </>
                );
              })()}

              <select
                value={cColor}
                onChange={(e) => setCColor(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              >
                {colors.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                value={cPrice}
                onChange={(e) => setCPrice(e.target.value)}
                placeholder="价格（元，可选）"
                min="0"
                step="0.01"
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  minWidth: 120,
                }}
              />

              <select
                value={cFrequency}
                onChange={(e) => setCFrequency(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              >
                {frequencies.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>

              <button
                onClick={editingItemId ? () => updateClothesItem(editingItemId) : addClothesItem}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: editingItemId ? "1px solid #ccc" : "1px solid #4CAF50",
                  background: editingItemId ? "#fff" : "#4CAF50",
                  color: editingItemId ? "#000" : "#fff",
                  cursor: "pointer",
                }}
              >
                {editingItemId ? "保存" : "+ 新增"}
              </button>
              {editingItemId && (
                <button
                  onClick={cancelEdit}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  取消
                </button>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              {sortedClothesItems.length === 0 ? (
                <p style={{ color: "#666" }}>
                  还没有衣物记录。先录入 3–5 件常穿的。
                </p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {/* 表头 */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                      gap: 8,
                      padding: "8px 12px",
                      backgroundColor: "#f5f5f5",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#333",
                      border: "1px solid #e0e0e0",
                    }}
                  >
                    <div>购入时间</div>
                    <div>购入时长</div>
                    <div>价格</div>
                    <div>季节</div>
                    <div>穿着频度</div>
                    <div>颜色</div>
                  </div>
                  {sortedClothesItems.map((it) => {
                    const isSelected = selectedItemId === it.id || selectedItemIds.has(it.id) || editingItemId === it.id;
                    return (
                      <div
                        key={it.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          // 如果是全选模式，不处理单个点击
                          if (selectedItemIds.size > 0 && !selectedItemIds.has(it.id)) {
                            return; // 全选模式下，只允许通过全选按钮操作
                          }
                          // 单选模式
                          if (selectedItemId === it.id) {
                            setSelectedItemId(null);
                            setSelectedItemIds(new Set());
                          } else {
                            setSelectedItemId(it.id);
                            setSelectedItemIds(new Set());
                          }
                        }}
                        style={{
                          border: isSelected ? "2px solid #0066cc" : "1px solid #eee",
                          borderRadius: 12,
                          padding: 12,
                          opacity: it.endReason ? 0.6 : 1,
                          backgroundColor: isSelected 
                            ? "#e6f2ff" 
                            : it.endReason 
                              ? "#f5f5f5" 
                              : "transparent",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            marginBottom: 8,
                            alignItems: "center",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {it.colorHex && (
                              <div
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 4,
                                  backgroundColor: it.colorHex,
                                  border: it.colorHex === "#FFFFFF" ? "1px solid #ddd" : "none",
                                  flexShrink: 0,
                                }}
                                title={it.color || ""}
                              />
                            )}
                            {(it.subCategory || it.type) && (
                              <div
                                style={{
                                  fontSize: 20,
                                  lineHeight: 1,
                                  flexShrink: 0,
                                }}
                                title={it.subCategory || it.type || ""}
                              >
                                {getSubCategoryIcon(it.subCategory || it.type)}
                              </div>
                            )}
                            <div style={{ fontWeight: 700 }}>{it.name}</div>
                          </div>
                        </div>
                        {/* 数据行 - 表格形式 */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                            gap: 8,
                            color: "#666",
                            fontSize: 14,
                            padding: "4px 0",
                          }}
                        >
                          <div>
                            {it.purchaseDate ? (() => {
                              try {
                                // Handle month format (YYYY-MM) or full date format
                                if (it.purchaseDate.match(/^\d{4}-\d{2}$/)) {
                                  const [year, month] = it.purchaseDate.split("-");
                                  return `${year}年${parseInt(month)}月`;
                                } else {
                                  // Full date format - show year and month only
                                  const date = new Date(it.purchaseDate);
                                  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
                                }
                              } catch {
                                return it.purchaseDate;
                              }
                            })() : "-"}
                          </div>
                          <div>
                            {it.purchaseDate && calculatePurchaseDuration(it.purchaseDate)
                              ? `${calculatePurchaseDuration(it.purchaseDate)}年`
                              : "-"}
                          </div>
                          <div>
                            {it.price !== null && it.price !== undefined
                              ? `¥${Number(it.price).toFixed(2)}`
                              : "-"}
                          </div>
                          <div>{it.season ? mapSeason(it.season) : "-"}</div>
                          <div>{it.frequency ? mapFrequency(it.frequency) : "-"}</div>
                          <div>{it.color || "-"}</div>
                        </div>
                        {/* 缘尽信息单独显示 */}
                        {it.endReason && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #eee", color: "#999", fontSize: 13 }}>
                            缘尽：{it.endReason}
                            {it.endDate && (
                              <>
                                {" "}
                                ({(() => {
                                  try {
                                    const date = new Date(it.endDate);
                                    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
                                  } catch {
                                    return "";
                                  }
                                })()})
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 全选和批量删除区域 - 固定在页面底部 */}
              {sortedClothesItems.length > 0 && (
                <div
                  style={{
                    position: "fixed",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    padding: "12px",
                    backgroundColor: "#f9f9f9",
                    borderTop: "1px solid #e0e0e0",
                    alignItems: "center",
                    zIndex: 1000,
                    boxShadow: "0 -2px 8px rgba(0,0,0,0.1)",
                  }}
                >
                  <button
                    onClick={() => {
                      const allSelected = sortedClothesItems.length > 0 && 
                        sortedClothesItems.every(item => selectedItemIds.has(item.id));
                      if (allSelected) {
                        // 如果已全选，则取消全选
                        setSelectedItemIds(new Set());
                        setSelectedItemId(null);
                      } else {
                        // 全选当前列表的所有条目
                        setSelectedItemIds(new Set(sortedClothesItems.map(item => item.id)));
                        setSelectedItemId(null); // 清空单选
                      }
                    }}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "1px solid #0066cc",
                      background: sortedClothesItems.length > 0 && 
                        sortedClothesItems.every(item => selectedItemIds.has(item.id)) 
                          ? "#0066cc" 
                          : "#fff",
                      color: sortedClothesItems.length > 0 && 
                        sortedClothesItems.every(item => selectedItemIds.has(item.id)) 
                          ? "#fff" 
                          : "#0066cc",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    {sortedClothesItems.length > 0 && 
                      sortedClothesItems.every(item => selectedItemIds.has(item.id)) 
                        ? "取消全选" 
                        : "全选"}
                  </button>
                  {/* 单选模式：显示编辑、复制、删除、缘尽按钮 */}
                  {selectedItemId && selectedItemIds.size === 0 && (() => {
                    const selectedItem = sortedClothesItems.find(item => item.id === selectedItemId);
                    if (!selectedItem) return null;
                    return (
                      <>
                        <span style={{ fontSize: 14, color: "#666", marginLeft: 8 }}>
                          已选中：{selectedItem.name}
                        </span>
                        <button
                          onClick={() => {
                            startEditClothesItem(selectedItem);
                            // 编辑时不清除选中状态，保持高亮直到保存完成
                          }}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            border: "1px solid #0066cc",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: 14,
                            color: "#0066cc",
                            fontWeight: 500,
                          }}
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => {
                            copyClothesItem(selectedItem);
                            setSelectedItemId(null);
                          }}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            border: "1px solid #0066cc",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: 14,
                            color: "#0066cc",
                            fontWeight: 500,
                          }}
                        >
                          复制
                        </button>
                        <button
                          onClick={() => {
                            setEndReasonItemId(selectedItemId);
                            setSelectedItemId(null);
                          }}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            border: "1px solid #ff9800",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: 14,
                            color: "#ff9800",
                            fontWeight: 500,
                          }}
                        >
                          缘尽
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`确定要删除 "${selectedItem.name}" 吗？此操作不可撤销。`)) {
                              removeClothesItem(selectedItemId);
                              setSelectedItemId(null);
                            }
                          }}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            border: "1px solid #dc3545",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: 14,
                            color: "#dc3545",
                            fontWeight: 500,
                          }}
                        >
                          删除
                        </button>
                        <button
                          onClick={() => {
                            setSelectedItemId(null);
                            setSelectedItemIds(new Set());
                          }}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            border: "1px solid #999",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: 14,
                            color: "#666",
                            fontWeight: 500,
                            marginLeft: "auto",
                          }}
                        >
                          取消选中
                        </button>
                      </>
                    );
                  })()}
                  {/* 全选模式：只显示批量删除按钮 */}
                  {selectedItemIds.size > 0 && (
                    <>
                      <span style={{ fontSize: 14, color: "#666", marginLeft: 8 }}>
                        已选中 {selectedItemIds.size} 项
                      </span>
                      <button
                        onClick={() => {
                          if (window.confirm(`确定要删除选中的 ${selectedItemIds.size} 项吗？此操作不可撤销。`)) {
                            selectedItemIds.forEach(id => {
                              removeClothesItem(id);
                            });
                            setSelectedItemIds(new Set());
                          }
                        }}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: "1px solid #dc3545",
                          background: "#fff",
                          cursor: "pointer",
                          fontSize: 14,
                          color: "#dc3545",
                          fontWeight: 500,
                          marginLeft: "auto",
                        }}
                      >
                        批量删除 ({selectedItemIds.size})
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : category === "daughterClothes" ? (
          <div style={{ paddingBottom: sortedDaughterClothesItems.length > 0 ? "80px" : "0" }}>
            <h2 style={{ marginTop: 0 }}>Skye的衣物</h2>

            {/* Filter Section */}
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
                margin: "12px 0",
                padding: "12px",
                backgroundColor: "#f9f9f9",
                borderRadius: 10,
                border: "1px solid #e0e0e0",
              }}
            >
              <span style={{ fontSize: 14, color: "#666", marginRight: 4 }}>筛选：</span>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  fontSize: 14,
                  marginRight: 8,
                }}
              >
                <option value="">全部年份</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}年
                  </option>
                ))}
              </select>
              <select
                value={filterSeason}
                onChange={(e) => setFilterSeason(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  fontSize: 14,
                  marginRight: 8,
                }}
              >
                <option value="">全部季节</option>
                {seasons.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={filterMainCategory}
                onChange={(e) => {
                  setFilterMainCategory(e.target.value);
                  setFilterSubCategory(""); // Reset subcategory filter when main category changes
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  fontSize: 14,
                }}
              >
                <option value="">全部主分类</option>
                {mainCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={filterSubCategory}
                onChange={(e) => setFilterSubCategory(e.target.value)}
                disabled={!filterMainCategory}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  fontSize: 14,
                  opacity: filterMainCategory ? 1 : 0.6,
                  cursor: filterMainCategory ? "pointer" : "not-allowed",
                }}
              >
                <option value="">全部子分类</option>
                {filterSubCategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>

              {(filterYear || filterSeason || filterMainCategory || filterSubCategory) && (
                <button
                  onClick={() => {
                    setFilterYear("");
                    setFilterSeason("");
                    setFilterMainCategory("");
                    setFilterSubCategory("");
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  清除筛选
                </button>
              )}
            </div>

            {/* Filter Statistics */}
            {(filterYear || filterSeason || filterMainCategory || filterSubCategory) && (
              <div
                style={{
                  margin: "8px 0 12px 0",
                  padding: "8px 12px",
                  backgroundColor: "#f0f7ff",
                  borderRadius: 8,
                  border: "1px solid #d0e7ff",
                  fontSize: 14,
                  color: "#333",
                }}
              >
                <span style={{ fontWeight: 500 }}>筛选统计：</span>
                <span style={{ marginLeft: 12 }}>
                  共 {daughterClothesFilterStats.count} 件
                </span>
                {daughterClothesFilterStats.totalPrice > 0 && (
                  <span style={{ marginLeft: 16, color: "#0066cc" }}>
                    总金额：¥{daughterClothesFilterStats.totalPrice.toFixed(2)}
                  </span>
                )}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
                margin: "12px 0",
              }}
            >
              <input
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="名称（必填）例如：粉色连衣裙"
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  minWidth: 260,
                }}
              />

              <select
                value={cMainCategory}
                onChange={(e) => setCMainCategory(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              >
                {mainCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={cSubCategory}
                onChange={(e) => setCSubCategory(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              >
                {currentSubCategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>

              <select
                value={cSeason}
                onChange={(e) => setCSeason(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              >
                {seasons.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {(() => {
                const currentDate = parsePurchaseDate(cPurchaseDate);
                const selectedYear = currentDate.year;
                // If month is 1 and it might be a placeholder, check if it's actually selected
                const selectedMonth = currentDate.month;
                // Check if the date string ends with "-01" and no month was explicitly selected
                const isPlaceholderMonth = cPurchaseDate && cPurchaseDate.endsWith("-01") && !selectedMonth;
                
                return (
                  <>
                    <select
                      value={selectedYear || ""}
                      onChange={(e) => {
                        const year = e.target.value ? parseInt(e.target.value) : null;
                        if (year) {
                          // If year is selected, preserve month if exists, otherwise use placeholder
                          setCPurchaseDate(formatPurchaseDate(year, selectedMonth));
                        } else {
                          // If year is cleared, clear everything
                          setCPurchaseDate("");
                        }
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #ccc",
                      }}
                    >
                      <option value="">年</option>
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}年
                        </option>
                      ))}
                    </select>
                    <select
                      value={isPlaceholderMonth ? "" : (selectedMonth || "")}
                      onChange={(e) => {
                        const month = e.target.value ? parseInt(e.target.value) : null;
                        if (selectedYear) {
                          setCPurchaseDate(formatPurchaseDate(selectedYear, month));
                        }
                      }}
                      disabled={!selectedYear}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #ccc",
                        opacity: selectedYear ? 1 : 0.6,
                        cursor: selectedYear ? "pointer" : "not-allowed",
                      }}
                    >
                      <option value="">月</option>
                      {months.map((month) => (
                        <option key={month} value={month}>
                          {month}月
                        </option>
                      ))}
                    </select>
                  </>
                );
              })()}

              <select
                value={cColor}
                onChange={(e) => setCColor(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              >
                {colors.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                value={cPrice}
                onChange={(e) => setCPrice(e.target.value)}
                placeholder="价格（元，可选）"
                min="0"
                step="0.01"
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  minWidth: 120,
                }}
              />

              <select
                value={cFrequency}
                onChange={(e) => setCFrequency(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              >
                {frequencies.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>

              <button
                onClick={editingItemId ? () => updateDaughterClothesItem(editingItemId) : addDaughterClothesItem}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: editingItemId ? "1px solid #ccc" : "1px solid #4CAF50",
                  background: editingItemId ? "#fff" : "#4CAF50",
                  color: editingItemId ? "#000" : "#fff",
                  cursor: "pointer",
                }}
              >
                {editingItemId ? "保存" : "+ 新增"}
              </button>
              {editingItemId && (
                <button
                  onClick={cancelEdit}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  取消
                </button>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              {sortedDaughterClothesItems.length === 0 ? (
                <p style={{ color: "#666" }}>
                  还没有衣物记录。先录入 3–5 件常穿的。
                </p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {/* 表头 */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                      gap: 8,
                      padding: "8px 12px",
                      backgroundColor: "#f5f5f5",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#333",
                      border: "1px solid #e0e0e0",
                    }}
                  >
                    <div>购入时间</div>
                    <div>购入时长</div>
                    <div>价格</div>
                    <div>季节</div>
                    <div>穿着频度</div>
                    <div>颜色</div>
                  </div>
                  {sortedDaughterClothesItems.map((it) => {
                    const isSelected = selectedItemId === it.id || selectedItemIds.has(it.id) || editingItemId === it.id;
                    return (
                      <div
                        key={it.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          // 如果是全选模式，不处理单个点击
                          if (selectedItemIds.size > 0 && !selectedItemIds.has(it.id)) {
                            return; // 全选模式下，只允许通过全选按钮操作
                          }
                          // 单选模式
                          if (selectedItemId === it.id) {
                            setSelectedItemId(null);
                            setSelectedItemIds(new Set());
                          } else {
                            setSelectedItemId(it.id);
                            setSelectedItemIds(new Set());
                          }
                        }}
                        style={{
                          border: isSelected ? "2px solid #0066cc" : "1px solid #eee",
                          borderRadius: 12,
                          padding: 12,
                          opacity: it.endReason ? 0.6 : 1,
                          backgroundColor: isSelected 
                            ? "#e6f2ff" 
                            : it.endReason 
                              ? "#f5f5f5" 
                              : "transparent",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            marginBottom: 8,
                            alignItems: "center",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {it.colorHex && (
                              <div
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 4,
                                  backgroundColor: it.colorHex,
                                  border: it.colorHex === "#FFFFFF" ? "1px solid #ddd" : "none",
                                  flexShrink: 0,
                                }}
                                title={it.color || ""}
                              />
                            )}
                            {(it.subCategory || it.type) && (
                              <div
                                style={{
                                  fontSize: 20,
                                  lineHeight: 1,
                                  flexShrink: 0,
                                }}
                                title={it.subCategory || it.type || ""}
                              >
                                {getSubCategoryIcon(it.subCategory || it.type)}
                              </div>
                            )}
                            <div style={{ fontWeight: 700 }}>{it.name}</div>
                          </div>
                        </div>
                        {/* 数据行 - 表格形式 */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                            gap: 8,
                            color: "#666",
                            fontSize: 14,
                            padding: "4px 0",
                          }}
                        >
                          <div>
                            {it.purchaseDate ? (() => {
                              try {
                                // Handle month format (YYYY-MM) or full date format
                                if (it.purchaseDate.match(/^\d{4}-\d{2}$/)) {
                                  const [year, month] = it.purchaseDate.split("-");
                                  return `${year}年${parseInt(month)}月`;
                                } else {
                                  // Full date format - show year and month only
                                  const date = new Date(it.purchaseDate);
                                  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
                                }
                              } catch {
                                return it.purchaseDate;
                              }
                            })() : "-"}
                          </div>
                          <div>
                            {it.purchaseDate && calculatePurchaseDuration(it.purchaseDate)
                              ? `${calculatePurchaseDuration(it.purchaseDate)}年`
                              : "-"}
                          </div>
                          <div>
                            {it.price !== null && it.price !== undefined
                              ? `¥${Number(it.price).toFixed(2)}`
                              : "-"}
                          </div>
                          <div>{it.season ? mapSeason(it.season) : "-"}</div>
                          <div>{it.frequency ? mapFrequency(it.frequency) : "-"}</div>
                          <div>{it.color || "-"}</div>
                        </div>
                        {/* 缘尽信息单独显示 */}
                        {it.endReason && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #eee", color: "#999", fontSize: 13 }}>
                            缘尽：{it.endReason}
                            {it.endDate && (
                              <>
                                {" "}
                                ({(() => {
                                  try {
                                    const date = new Date(it.endDate);
                                    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
                                  } catch {
                                    return "";
                                  }
                                })()})
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 全选和批量删除区域 - 固定在页面底部 */}
              {sortedDaughterClothesItems.length > 0 && (
                <div
                  style={{
                    position: "fixed",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    padding: "12px",
                    backgroundColor: "#f9f9f9",
                    borderTop: "1px solid #e0e0e0",
                    alignItems: "center",
                    zIndex: 1000,
                    boxShadow: "0 -2px 8px rgba(0,0,0,0.1)",
                  }}
                >
                  <button
                    onClick={() => {
                      const allSelected = sortedDaughterClothesItems.length > 0 && 
                        sortedDaughterClothesItems.every(item => selectedItemIds.has(item.id));
                      if (allSelected) {
                        // 如果已全选，则取消全选
                        setSelectedItemIds(new Set());
                        setSelectedItemId(null);
                      } else {
                        // 全选当前列表的所有条目
                        setSelectedItemIds(new Set(sortedDaughterClothesItems.map(item => item.id)));
                        setSelectedItemId(null); // 清空单选
                      }
                    }}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "1px solid #0066cc",
                      background: sortedDaughterClothesItems.length > 0 && 
                        sortedDaughterClothesItems.every(item => selectedItemIds.has(item.id)) 
                          ? "#0066cc" 
                          : "#fff",
                      color: sortedDaughterClothesItems.length > 0 && 
                        sortedDaughterClothesItems.every(item => selectedItemIds.has(item.id)) 
                          ? "#fff" 
                          : "#0066cc",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    {sortedDaughterClothesItems.length > 0 && 
                      sortedDaughterClothesItems.every(item => selectedItemIds.has(item.id)) 
                        ? "取消全选" 
                        : "全选"}
                  </button>
                  {/* 单选模式：显示编辑、复制、删除、缘尽按钮 */}
                  {selectedItemId && selectedItemIds.size === 0 && (() => {
                    const selectedItem = sortedDaughterClothesItems.find(item => item.id === selectedItemId);
                    if (!selectedItem) return null;
                    return (
                      <>
                        <span style={{ fontSize: 14, color: "#666", marginLeft: 8 }}>
                          已选中：{selectedItem.name}
                        </span>
                        <button
                          onClick={() => {
                            startEditDaughterClothesItem(selectedItem);
                            // 编辑时不清除选中状态，保持高亮直到保存完成
                          }}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            border: "1px solid #0066cc",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: 14,
                            color: "#0066cc",
                            fontWeight: 500,
                          }}
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => {
                            copyDaughterClothesItem(selectedItem);
                            setSelectedItemId(null);
                          }}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            border: "1px solid #0066cc",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: 14,
                            color: "#0066cc",
                            fontWeight: 500,
                          }}
                        >
                          复制
                        </button>
                        <button
                          onClick={() => {
                            setEndReasonItemId(selectedItemId);
                            setSelectedItemId(null);
                          }}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            border: "1px solid #ff9800",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: 14,
                            color: "#ff9800",
                            fontWeight: 500,
                          }}
                        >
                          缘尽
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`确定要删除 "${selectedItem.name}" 吗？此操作不可撤销。`)) {
                              removeDaughterClothesItem(selectedItemId);
                              setSelectedItemId(null);
                            }
                          }}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            border: "1px solid #dc3545",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: 14,
                            color: "#dc3545",
                            fontWeight: 500,
                          }}
                        >
                          删除
                        </button>
                        <button
                          onClick={() => {
                            setSelectedItemId(null);
                            setSelectedItemIds(new Set());
                          }}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            border: "1px solid #999",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: 14,
                            color: "#666",
                            fontWeight: 500,
                            marginLeft: "auto",
                          }}
                        >
                          取消选中
                        </button>
                      </>
                    );
                  })()}
                  {/* 全选模式：只显示批量删除按钮 */}
                  {selectedItemIds.size > 0 && (
                    <>
                      <span style={{ fontSize: 14, color: "#666", marginLeft: 8 }}>
                        已选中 {selectedItemIds.size} 项
                      </span>
                      <button
                        onClick={() => {
                          if (window.confirm(`确定要删除选中的 ${selectedItemIds.size} 项吗？此操作不可撤销。`)) {
                            selectedItemIds.forEach(id => {
                              removeDaughterClothesItem(id);
                            });
                            setSelectedItemIds(new Set());
                          }
                        }}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: "1px solid #dc3545",
                          background: "#fff",
                          cursor: "pointer",
                          fontSize: 14,
                          color: "#dc3545",
                          fontWeight: 500,
                          marginLeft: "auto",
                        }}
                      >
                        批量删除 ({selectedItemIds.size})
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h2 style={{ marginTop: 0 }}>护肤/化妆</h2>
            <p style={{ color: "#666" }}>
              下一步再做：新增 + 列表（含开封日期 / 到期）。
            </p>
          </div>
        )}
      </div>


      {/* End Reason Modal */}
      {endReasonItemId && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setEndReasonItemId(null)}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: 24,
              borderRadius: 12,
              minWidth: 300,
              maxWidth: 400,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>选择缘尽方式</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {endReasons.map((reason) => (
                <button
                  key={reason}
                  onClick={() => {
                    if (category === "clothes") {
                      setEndReason(endReasonItemId, reason);
                    } else if (category === "daughterClothes") {
                      setEndReasonForDaughter(endReasonItemId, reason);
                    }
                  }}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 14,
                    textAlign: "left",
                  }}
                >
                  {reason}
                </button>
              ))}
            </div>
            <button
              onClick={() => setEndReasonItemId(null)}
              style={{
                marginTop: 16,
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
                fontSize: 14,
                width: "100%",
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 数据导入模态框 */}
      {showImportModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => {
            if (!isImporting) {
              setShowImportModal(false);
              setImportData("");
              setImportError("");
            }
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: 24,
              borderRadius: 12,
              minWidth: 300,
              maxWidth: 600,
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>导入历史数据</h3>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 16 }}>
              请粘贴之前下载的 JSON 数据，或上传 JSON 文件
            </p>

            {/* 文件上传 */}
            <div style={{ marginBottom: 16 }}>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                disabled={isImporting}
                style={{
                  fontSize: 14,
                  padding: "8px",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* 文本输入 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
                或直接粘贴 JSON 数据：
              </label>
              <textarea
                value={importData}
                onChange={(e) => {
                  setImportData(e.target.value);
                  setImportError("");
                }}
                disabled={isImporting}
                placeholder='例如: [{"id":"...","name":"...","mainCategory":"上衣",...}] 或 {"clothesItems":[...],"daughterClothesItems":[...]}'
                style={{
                  width: "100%",
                  minHeight: "200px",
                  padding: "12px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  fontSize: 13,
                  fontFamily: "monospace",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
            </div>

            {/* 错误提示 */}
            {importError && (
              <div
                style={{
                  padding: "12px",
                  borderRadius: 6,
                  backgroundColor: "#fee",
                  color: "#c33",
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                {importError}
              </div>
            )}

            {/* 按钮 */}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportData("");
                  setImportError("");
                }}
                disabled={isImporting}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  background: "#fff",
                  cursor: isImporting ? "not-allowed" : "pointer",
                  fontSize: 14,
                }}
              >
                取消
              </button>
              <button
                onClick={handleImportData}
                disabled={isImporting || !importData.trim()}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "1px solid #4CAF50",
                  background: isImporting || !importData.trim() ? "#ccc" : "#4CAF50",
                  color: "white",
                  cursor: isImporting || !importData.trim() ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {isImporting ? "导入中..." : "导入数据"}
              </button>
            </div>

            {/* 提示信息 */}
            <div style={{ marginTop: 16, padding: "12px", backgroundColor: "#f5f5f5", borderRadius: 6, fontSize: 12, color: "#666" }}>
              <strong>提示：</strong>
              <ul style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
                <li>支持直接粘贴 JSON 数组格式的数据</li>
                <li>支持包含 clothesItems 和 daughterClothesItems 的对象格式</li>
                <li>支持 localStorage 导出的格式</li>
                <li>重复的数据（相同 ID）会被自动跳过</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Section 3: Export
// Exports the App component as the default export of this module.

export default App;