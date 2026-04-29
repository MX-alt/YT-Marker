// --- 1. 数据库管理封装 ---
const DB_NAME = "YouTubeHistoryDB";
const STORE_NAME = "watchedVideos";
const GITHUB_CLIENT_ID = 'Ov23liyMdK7hQND8Nfo7'; 
const REDIRECT_URL = `https://${chrome.runtime.id}.chromiumapp.org/`;

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
  // 保存视频逻辑
  if (message.type === "SAVE_VIDEO") {
    toggleVideoStatus(message.id).then(status => {
      sendResponse({ status: "success", detail: status });
    }).catch(err => sendResponse({ status: "error", error: err }));
    return true; 
  }

  // 获取数据逻辑
  if (message.type === "GET_ALL_WATCHED") {
    getAllWatchedVideos().then(ids => {
      sendResponse({ data: ids });
    }).catch(() => sendResponse({ data: [] }));
    return true;
  }

  // --- 新增：处理登录请求 ---
  if (message.type === "LOGIN") {
    loginWithGitHub()
      .then(token => {
        console.log("GitHub Token 获取成功!");
        // 你可以将 token 存入 chrome.storage 方便后续使用
        chrome.storage.local.set({ github_token: token });
        sendResponse({ status: "success", token: token });
      })
      .catch(err => {
        console.error("登录失败:", err);
        sendResponse({ status: "error", message: err.message });
      });
    return true; // 保持异步连接
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

// 建议：把登录逻辑封装成一个函数，由用户点击触发，而不是插件一启动就执行
async function loginWithGitHub() {
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URL}&scope=read:user`;

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    }, async (redirectUrl) => {
      if (chrome.runtime.lastError || !redirectUrl) {
        return reject(chrome.runtime.lastError);
      }

      // 从回调 URL 中提取 code
      const url = new URL(redirectUrl);
      const code = url.searchParams.get('code');
      
      if (code) {
        // 接下来去换取 Token
        const token = await exchangeCodeForToken(code);
        resolve(token);
      }
    });
  });
}

// 交换 Token 的函数 (注意：Secret 建议放在后端，这里仅作本地演示)
async function exchangeCodeForToken(code) {
  const GITHUB_CLIENT_SECRET = 'b6dfe65c8fd1aa30b52b8e430c4c13f7f951e67c'; // 你之前记下的 Secret
  
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code: code
    })
  });

  const data = await response.json();
  return data.access_token;
}
