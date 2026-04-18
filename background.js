// --- 1. 数据库管理封装 ---
const DB_NAME = "YouTubeHistoryDB";
const STORE_NAME = "watchedVideos";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "videoId" });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject("DB Open Error");
  });
}

// 核心业务逻辑：切换状态
async function toggleVideoStatus(videoId) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction([STORE_NAME], "readwrite");
    const store = tx.objectStore(STORE_NAME);
    
    const getReq = store.get(videoId);
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.delete(videoId);
        resolve("removed");
      } else {
        store.put({ videoId: videoId, timestamp: Date.now() });
        resolve("added");
      }
    };
  });
}

// 获取全量数据接口
async function getAllWatchedVideos() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result.map(item => item.videoId));
  });
}

// --- 2. 插件安装与右键菜单初始化 ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "markAsWatched",
    title: "标记/取消标记为已看",
    contexts: ["link"],
    targetUrlPatterns: ["*://*.youtube.com/watch?v=*", "*://youtube.com/watch?v=*"]
  });
});

// --- 3. 消息中心 (路由器) ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_VIDEO") {
    toggleVideoStatus(message.id).then(status => {
      sendResponse({ status: "success", detail: status });
    });
    return true; 
  }

  if (message.type === "GET_ALL_WATCHED") {
    getAllWatchedVideos().then(ids => {
      sendResponse({ data: ids });
    });
    return true;
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "markAsWatched") {
    const match = info.linkUrl.match(/[?&]v=([^&#]+)/);
    const videoId = match ? match[1] : null;

    if (videoId) {
      await toggleVideoStatus(videoId);
      chrome.tabs.sendMessage(tab.id, { action: "refreshUI" });
    }
  }
});