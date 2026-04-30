import { toggleVideoStatus, getAllWatchedVideos } from './db.js';
import { loginWithGitHub, initCloudStorage } from './github-service.js';

// 右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "markAsWatched",
    title: "标记/取消标记为已看",
    contexts: ["link"],
    targetUrlPatterns: ["*://*.youtube.com/watch?v=*", "*://youtube.com/watch?v=*"]
  });
});

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LOGIN") {
    handleLogin(sendResponse);
    return true;
  }
  if (message.type === "SAVE_VIDEO") {
    toggleVideoStatus(message.id).then(status => sendResponse({ status: "success", detail: status }));
    return true;
  }
  if (message.type === "GET_ALL_WATCHED") {
    getAllWatchedVideos().then(ids => sendResponse({ data: ids }));
    return true;
  }
});

async function handleLogin(sendResponse) {
  try {
    const token = await loginWithGitHub();
    await chrome.storage.local.set({ github_token: token });
    await initCloudStorage(token);
    
    // --- 增加这一行：登录成功后立刻执行一次全量同步 ---
    const allVideos = await getAllWatchedVideos();
    await updateCloudData(allVideos); 
    
    sendResponse({ status: "success" });
  } catch (err) {
    sendResponse({ status: "error", message: err.message });
  }
}

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