import { toggleVideoStatus, getAllWatchedVideos } from './db.js';
import { loginWithGitHub, initCloudStorage, updateCloudData } from './github-service.js';

// --- 1. 右键菜单初始化 ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "markAsWatched",
    title: "标记/取消标记为已看",
    contexts: ["link"],
    targetUrlPatterns: ["*://*.youtube.com/watch?v=*", "*://youtube.com/watch?v=*"]
  });
});

// --- 2. 消息处理中心 ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LOGIN") {
    handleLogin(sendResponse);
    return true;
  }
  if (message.type === "SAVE_VIDEO") {
    // 这里的逻辑可以优化：保存后自动同步到云端
    handleSaveVideo(message.id, sendResponse);
    return true;
  }
  if (message.type === "GET_ALL_WATCHED") {
    getAllWatchedVideos().then(ids => sendResponse({ data: ids }));
    return true;
  }
});

// --- 3. 核心业务逻辑封装 ---

// 处理登录并全量同步
async function handleLogin(sendResponse) {
  try {
    const token = await loginWithGitHub();
    await chrome.storage.local.set({ github_token: token });
    
    // 初始化云端仓库
    await initCloudStorage(token);
    
    // 登录成功后立刻执行一次全量同步，把 IndexedDB 的旧数据推上去
    const allVideos = await getAllWatchedVideos();
    await updateCloudData(allVideos); 
    
    sendResponse({ status: "success" });
  } catch (err) {
    console.error("登录同步失败:", err);
    sendResponse({ status: "error", message: err.message });
  }
}

// 处理单个视频保存并同步 
async function handleSaveVideo(videoId, sendResponse) {
  try {
    const status = await toggleVideoStatus(videoId);
    const allVideos = await getAllWatchedVideos();
    await updateCloudData(allVideos); // 触发云端更新
    sendResponse({ status: "success", detail: status });
  } catch (err) {
    sendResponse({ status: "error", error: err.message });
  }
}

// --- 4. 右键菜单点击处理 ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "markAsWatched") {
    const match = info.linkUrl.match(/[?&]v=([^&#]+)/);
    const videoId = match ? match[1] : null;
    if (videoId) {
      await handleSaveVideo(videoId, () => {}); // 复用保存逻辑
      chrome.tabs.sendMessage(tab.id, { action: "refreshUI" });
    }
  }
});