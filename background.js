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

async function getAllWatchedVideos() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result.map(item => item.videoId));
  });
}

// --- 2. 插件安装与右键菜单 ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "markAsWatched",
    title: "标记/取消标记为已看",
    contexts: ["link"],
    targetUrlPatterns: ["*://*.youtube.com/watch?v=*", "*://youtube.com/watch?v=*"]
  });
});

// --- 3. 消息中心 ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_VIDEO") {
    toggleVideoStatus(message.id).then(status => sendResponse({ status: "success", detail: status }));
    return true; 
  }

  if (message.type === "GET_ALL_WATCHED") {
    getAllWatchedVideos().then(ids => sendResponse({ data: ids }));
    return true;
  }

  if (message.type === "LOGIN") {
    (async () => {
      try {
        const token = await loginWithGitHub();
        await chrome.storage.local.set({ github_token: token });
        await initCloudStorage(token);
        sendResponse({ status: "success", token: token });
      } catch (err) {
        sendResponse({ status: "error", message: err.message });
      }
    })();
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

// --- 4. GitHub API 逻辑 ---
async function loginWithGitHub() {
  // 注意：这里 scope 改成了 gist
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URL}&scope=gist`;

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (redirectUrl) => {
      if (chrome.runtime.lastError || !redirectUrl) return reject(chrome.runtime.lastError);
      const code = new URL(redirectUrl).searchParams.get('code');
      if (code) {
        const token = await exchangeCodeForToken(code);
        resolve(token);
      }
    });
  });
}

async function exchangeCodeForToken(code) {
  const GITHUB_CLIENT_SECRET = 'b6dfe65c8fd1aa30b52b8e430c4c13f7f951e67c';
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code: code })
  });
  const data = await response.json();
  return data.access_token;
}

async function initCloudStorage(token) {
  try {
    const saved = await chrome.storage.local.get(['gist_id']);
    if (saved.gist_id) {
      console.log("检测到已存在的云端存储 ID:", saved.gist_id);
      return;
    }

    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`, // 使用反引号
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        description: "YT-Marker 视频标记数据",
        public: false,
        files: {
          "yt_marker_data.json": {
            "content": JSON.stringify({ last_sync: Date.now(), videos: [] })
          }
        }
      })
    });

    const data = await response.json();
    if (data.id) {
      await chrome.storage.local.set({ gist_id: data.id });
      console.log("云端数据库创建成功！URL：", data.html_url);
    }
  } catch (err) {
    console.error("初始化云端存储失败:", err);
  }
}