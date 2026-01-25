// Section 1: Imports and Storage Key
// The file imports React hooks (`useEffect`, `useMemo`, `useState`) from "react" for state and side-effect management.
// It also defines a constant `STORAGE_KEY` which will be used as the key for localStorage operations.

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "grace_stuff_clothes_v1";
const STORAGE_KEY_DAUGHTER = "grace_stuff_daughter_clothes_v1";

// Section 2: Main App Component Function
// The `App` function defines the main component for the app.

function App() {
  // Section 2a: Category State
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
      return Array.isArray(parsed) ? parsed : [];
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
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Section 2c: Form Field States
  // States for the controlled form: item name, main category, subcategory, season, purchase date, price, frequency, and color.

  const [cName, setCName] = useState("");
  const [cMainCategory, setCMainCategory] = useState("上衣");
  const [cSubCategory, setCSubCategory] = useState("T恤");
  const [cSeason, setCSeason] = useState(["四季"]); // Array for multi-select
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

  const [filterMainCategory, setFilterMainCategory] = useState(""); // "" | mainCategory
  const [filterSubCategory, setFilterSubCategory] = useState(""); // "" | subCategory

  // Section 2c-4: Season Dropdown State
  // Controls the visibility of the season dropdown menu.

  const [seasonDropdownOpen, setSeasonDropdownOpen] = useState(false);

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
    () => ["四季", "春秋", "夏", "冬"],
    []
  );

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

  const frequencies = useMemo(
    () => ["每天", "每周多次", "每周一次", "每月几次", "偶尔", "很少", "从未"],
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

  // Section 2d-7-1: Normalize Season Data
  // Converts season data to array format (handles legacy string format).

  function normalizeSeason(season) {
    if (!season) return ["四季"];
    if (Array.isArray(season)) return season.length > 0 ? season : ["四季"];
    // Legacy: string format
    return [season];
  }

  // Section 2d-7-2: Format Season for Display
  // Formats season array as comma-separated string for display.

  function formatSeasonForDisplay(season) {
    const normalized = normalizeSeason(season);
    return normalized.join("、");
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

  useEffect(() => {
    if (currentSubCategories.length > 0) {
      setCSubCategory(currentSubCategories[0]);
    }
  }, [cMainCategory, currentSubCategories]);

  // Section 2e-0: Sorted and Filtered Clothes Items
  // Sorts clothes items: items with endReason go to the end.
  // Filters by main category and subcategory if filters are set.

  const sortedClothesItems = useMemo(() => {
    let filtered = clothesItems;
    
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
  }, [clothesItems, filterMainCategory, filterSubCategory]);

  // Section 2e-0-1: Sorted and Filtered Daughter Clothes Items
  // Sorts daughter clothes items: items with endReason go to the end.
  // Filters by main category and subcategory if filters are set.

  const sortedDaughterClothesItems = useMemo(() => {
    let filtered = daughterClothesItems;
    
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
  }, [daughterClothesItems, filterMainCategory, filterSubCategory]);

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
      season: cSeason,
      purchaseDate: cPurchaseDate || null,
      price: cPrice.trim() ? parseFloat(cPrice) || null : null,
      frequency: cFrequency,
      color: cColor,
      colorHex: selectedColor?.hex || "#CCCCCC",
      createdAt: new Date().toISOString(),
    };

    setClothesItems((prev) => [item, ...prev]);
    setCName("");
    setCMainCategory("上衣");
    setCSubCategory("T恤");
    setCSeason(["四季"]);
    setCPurchaseDate("");
    setCPrice("");
    setCFrequency("偶尔");
    setCColor("黑色");
  }

  // Section 2g: Remove Clothes Item Handler
  // Removes a clothing item by its unique ID.

  function removeClothesItem(id) {
    setClothesItems((prev) => prev.filter((x) => x.id !== id));
  }

  // Section 2g-1: Update Clothes Item Handler
  // Updates an existing clothing item with new values.

  function updateClothesItem(id) {
    const name = cName.trim();
    if (!name) return;

    const selectedColor = colors.find((c) => c.name === cColor);
    setClothesItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              name,
              mainCategory: cMainCategory,
              subCategory: cSubCategory,
              season: cSeason,
              purchaseDate: cPurchaseDate || null,
              price: cPrice.trim() ? parseFloat(cPrice) || null : null,
              frequency: cFrequency,
              color: cColor,
              colorHex: selectedColor?.hex || "#CCCCCC",
            }
          : item
      )
    );
    setEditingItemId(null);
    setCName("");
    setCMainCategory("上衣");
    setCSubCategory("T恤");
    setCSeason(["四季"]);
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
    setCMainCategory(item.mainCategory || "上衣");
    setCSubCategory(item.subCategory || "T恤");
    setCSeason(normalizeSeason(item.season));
    setCPurchaseDate(item.purchaseDate || "");
    setCPrice(item.price !== null && item.price !== undefined ? String(item.price) : "");
    setCFrequency(item.frequency || "偶尔");
    setCColor(item.color || "黑色");
  }

  // Section 2g-3: Cancel Edit Handler
  // Cancels editing and resets form fields.

  function cancelEdit() {
    setEditingItemId(null);
    setCName("");
    setCMainCategory("上衣");
    setCSubCategory("T恤");
    setCSeason(["四季"]);
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
    setCFrequency(item.frequency || "偶尔");
    setCColor("黑色"); // Reset color so user can choose different color
    // Scroll to form area (optional, but helpful UX)
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Section 2g-4: Set End Reason Handler
  // Sets the end reason and date for a clothing item.

  function setEndReason(id, reason) {
    setClothesItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              endReason: reason,
              endDate: new Date().toISOString(),
            }
          : item
      )
    );
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
      season: cSeason,
      purchaseDate: cPurchaseDate || null,
      price: cPrice.trim() ? parseFloat(cPrice) || null : null,
      frequency: cFrequency,
      color: cColor,
      colorHex: selectedColor?.hex || "#CCCCCC",
      createdAt: new Date().toISOString(),
    };

    setDaughterClothesItems((prev) => [item, ...prev]);
    setCName("");
    setCMainCategory("上衣");
    setCSubCategory("T恤");
    setCSeason(["四季"]);
    setCPurchaseDate("");
    setCPrice("");
    setCFrequency("偶尔");
    setCColor("黑色");
  }

  // Section 2g-1: Remove Daughter Clothes Item Handler
  // Removes a daughter's clothing item by its unique ID.

  function removeDaughterClothesItem(id) {
    setDaughterClothesItems((prev) => prev.filter((x) => x.id !== id));
  }

  // Section 2g-5: Update Daughter Clothes Item Handler
  // Updates an existing daughter clothing item with new values.

  function updateDaughterClothesItem(id) {
    const name = cName.trim();
    if (!name) return;

    const selectedColor = colors.find((c) => c.name === cColor);
    setDaughterClothesItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              name,
              mainCategory: cMainCategory,
              subCategory: cSubCategory,
              season: cSeason,
              purchaseDate: cPurchaseDate || null,
              price: cPrice.trim() ? parseFloat(cPrice) || null : null,
              frequency: cFrequency,
              color: cColor,
              colorHex: selectedColor?.hex || "#CCCCCC",
            }
          : item
      )
    );
    setEditingItemId(null);
    setCName("");
    setCMainCategory("上衣");
    setCSubCategory("T恤");
    setCSeason(["四季"]);
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
    setCMainCategory(item.mainCategory || "上衣");
    setCSubCategory(item.subCategory || "T恤");
    setCSeason(normalizeSeason(item.season));
    setCPurchaseDate(item.purchaseDate || "");
    setCPrice(item.price !== null && item.price !== undefined ? String(item.price) : "");
    setCFrequency(item.frequency || "偶尔");
    setCColor(item.color || "黑色");
  }

  // Section 2g-7: Set End Reason for Daughter Handler
  // Sets the end reason and date for a daughter clothing item.

  function setEndReasonForDaughter(id, reason) {
    setDaughterClothesItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              endReason: reason,
              endDate: new Date().toISOString(),
            }
          : item
      )
    );
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
    setCFrequency(item.frequency || "偶尔");
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

  return (
    <div style={{ padding: 24, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>Grace&apos;s stuff</h1>
      <p style={{ marginTop: 0, color: "#666" }}>
        Local-first. Simple. For my own use.
      </p>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <button
          onClick={() => setCategory("clothes")}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: category === "clothes" ? "#eee" : "white",
            cursor: "pointer",
          }}
        >
          衣物
        </button>

        <button
          onClick={() => setCategory("daughterClothes")}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: category === "daughterClothes" ? "#eee" : "white",
            cursor: "pointer",
          }}
        >
          我女儿的衣物
        </button>

        <button
          onClick={() => setCategory("beauty")}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: category === "beauty" ? "#eee" : "white",
            cursor: "pointer",
          }}
        >
          护肤/化妆
        </button>
      </div>

      <div
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 14,
          padding: 16,
        }}
      >
        {category === "clothes" ? (
          <div>
            <h2 style={{ marginTop: 0 }}>衣物</h2>

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

              {(filterMainCategory || filterSubCategory) && (
                <button
                  onClick={() => {
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
            {(filterMainCategory || filterSubCategory) && (
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

              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setSeasonDropdownOpen(!seasonDropdownOpen)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                    backgroundColor: "#fff",
                    cursor: "pointer",
                    minWidth: 120,
                    textAlign: "left",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "inherit",
                    fontWeight: "normal",
                    fontFamily: "inherit",
                    lineHeight: "normal",
                    height: "auto",
                  }}
                >
                  <span style={{ fontSize: "inherit", fontWeight: "normal" }}>{formatSeasonForDisplay(cSeason)}</span>
                  <span style={{ marginLeft: 8, fontSize: "inherit", fontWeight: "normal" }}>{seasonDropdownOpen ? "▲" : "▼"}</span>
                </button>
                {seasonDropdownOpen && (
                  <>
                    <div
                      style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 100,
                      }}
                      onClick={() => setSeasonDropdownOpen(false)}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        marginTop: 4,
                        padding: 8,
                        borderRadius: 8,
                        border: "1px solid #ccc",
                        backgroundColor: "#fff",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        zIndex: 101,
                        minWidth: 150,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {seasons.map((s) => (
                        <label
                          key={s}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: "pointer",
                            fontSize: 14,
                            padding: "6px 8px",
                            borderRadius: 4,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f5f5f5";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={cSeason.includes(s)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCSeason([...cSeason, s]);
                              } else {
                                const newSeasons = cSeason.filter((season) => season !== s);
                                // Ensure at least one season is selected
                                setCSeason(newSeasons.length > 0 ? newSeasons : ["四季"]);
                              }
                            }}
                            style={{ cursor: "pointer" }}
                          />
                          <span>{s}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>

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
                  {sortedClothesItems.map((it) => (
                    <div
                      key={it.id}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 12,
                        padding: 12,
                        opacity: it.endReason ? 0.6 : 1,
                        backgroundColor: it.endReason ? "#f5f5f5" : "transparent",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            marginBottom: 8,
                            alignItems: "flex-start",
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
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ color: "#666", fontSize: 14 }}>
                              <div>
                                {it.mainCategory && it.subCategory
                                  ? `${it.mainCategory} · ${it.subCategory}`
                                  : it.type || "未分类"}
                              </div>
                              <div style={{ marginTop: 4, color: "#888" }}>
                                {formatSeasonForDisplay(it.season)}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              <button
                                onClick={() => startEditClothesItem(it)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #ccc",
                                  background: "#fff",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  color: "#666",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => copyClothesItem(it)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #ccc",
                                  background: "#fff",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  color: "#666",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}
                              >
                                复制
                              </button>
                              <button
                                onClick={() => setEndReasonItemId(it.id)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #ccc",
                                  background: "#fff",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  color: "#666",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}
                              >
                                {it.endReason || "缘尽"}
                              </button>
                              <button
                                onClick={() => removeClothesItem(it.id)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #ccc",
                                  background: "#fff",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  color: "#666",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 16,
                            color: "#666",
                            fontSize: 14,
                            flexWrap: "wrap",
                          }}
                        >
                          {it.purchaseDate && (
                            <div>
                              购入时间：
                              {(() => {
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
                              })()}
                            </div>
                          )}
                          {it.purchaseDate && calculatePurchaseDuration(it.purchaseDate) && (
                            <div>
                              购入时长：{calculatePurchaseDuration(it.purchaseDate)}年
                            </div>
                          )}
                          {it.price !== null && it.price !== undefined && (
                            <div>价格：¥{Number(it.price).toFixed(2)}</div>
                          )}
                          {it.frequency && (
                            <div>穿着频度：{it.frequency}</div>
                          )}
                          {it.color && (
                            <div>颜色：{it.color}</div>
                          )}
                          {it.endReason && (
                            <div>
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : category === "daughterClothes" ? (
          <div>
            <h2 style={{ marginTop: 0 }}>我女儿的衣物</h2>

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

              {(filterMainCategory || filterSubCategory) && (
                <button
                  onClick={() => {
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
            {(filterMainCategory || filterSubCategory) && (
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

              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setSeasonDropdownOpen(!seasonDropdownOpen)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                    backgroundColor: "#fff",
                    cursor: "pointer",
                    minWidth: 120,
                    textAlign: "left",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "inherit",
                    fontWeight: "normal",
                    fontFamily: "inherit",
                    lineHeight: "normal",
                    height: "auto",
                  }}
                >
                  <span style={{ fontSize: "inherit", fontWeight: "normal" }}>{formatSeasonForDisplay(cSeason)}</span>
                  <span style={{ marginLeft: 8, fontSize: "inherit", fontWeight: "normal" }}>{seasonDropdownOpen ? "▲" : "▼"}</span>
                </button>
                {seasonDropdownOpen && (
                  <>
                    <div
                      style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 100,
                      }}
                      onClick={() => setSeasonDropdownOpen(false)}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        marginTop: 4,
                        padding: 8,
                        borderRadius: 8,
                        border: "1px solid #ccc",
                        backgroundColor: "#fff",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        zIndex: 101,
                        minWidth: 150,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {seasons.map((s) => (
                        <label
                          key={s}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: "pointer",
                            fontSize: 14,
                            padding: "6px 8px",
                            borderRadius: 4,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f5f5f5";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={cSeason.includes(s)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCSeason([...cSeason, s]);
                              } else {
                                const newSeasons = cSeason.filter((season) => season !== s);
                                // Ensure at least one season is selected
                                setCSeason(newSeasons.length > 0 ? newSeasons : ["四季"]);
                              }
                            }}
                            style={{ cursor: "pointer" }}
                          />
                          <span>{s}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>

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
                  border: "1px solid #ccc",
                  background: "#fff",
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
                  {sortedDaughterClothesItems.map((it) => (
                    <div
                      key={it.id}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 12,
                        padding: 12,
                        opacity: it.endReason ? 0.6 : 1,
                        backgroundColor: it.endReason ? "#f5f5f5" : "transparent",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            marginBottom: 8,
                            alignItems: "flex-start",
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
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ color: "#666", fontSize: 14 }}>
                              <div>
                                {it.mainCategory && it.subCategory
                                  ? `${it.mainCategory} · ${it.subCategory}`
                                  : it.type || "未分类"}
                              </div>
                              <div style={{ marginTop: 4, color: "#888" }}>
                                {formatSeasonForDisplay(it.season)}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              <button
                                onClick={() => startEditDaughterClothesItem(it)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #ccc",
                                  background: "#fff",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  color: "#666",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => copyDaughterClothesItem(it)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #ccc",
                                  background: "#fff",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  color: "#666",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}
                              >
                                复制
                              </button>
                              <button
                                onClick={() => setEndReasonItemId(it.id)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #ccc",
                                  background: "#fff",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  color: "#666",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}
                              >
                                {it.endReason || "缘尽"}
                              </button>
                              <button
                                onClick={() => removeDaughterClothesItem(it.id)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #ccc",
                                  background: "#fff",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  color: "#666",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 16,
                            color: "#666",
                            fontSize: 14,
                            flexWrap: "wrap",
                          }}
                        >
                          {it.purchaseDate && (
                            <div>
                              购入时间：
                              {(() => {
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
                              })()}
                            </div>
                          )}
                          {it.purchaseDate && calculatePurchaseDuration(it.purchaseDate) && (
                            <div>
                              购入时长：{calculatePurchaseDuration(it.purchaseDate)}年
                            </div>
                          )}
                          {it.price !== null && it.price !== undefined && (
                            <div>价格：¥{Number(it.price).toFixed(2)}</div>
                          )}
                          {it.frequency && (
                            <div>穿着频度：{it.frequency}</div>
                          )}
                          {it.color && (
                            <div>颜色：{it.color}</div>
                          )}
                          {it.endReason && (
                            <div>
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
                      </div>
                    </div>
                  ))}
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
    </div>
  );
}

// Section 3: Export
// Exports the App component as the default export of this module.

export default App;