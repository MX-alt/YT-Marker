const GITHUB_CLIENT_ID = 'Ov23liyMdK7hQND8Nfo7';
const GITHUB_CLIENT_SECRET = 'b6dfe65c8fd1aa30b52b8e430c4c13f7f951e67c';

export async function loginWithGitHub() {
  const redirectUrl = `https://${chrome.runtime.id}.chromiumapp.org/`;
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUrl}&scope=gist`;

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (url) => {
      if (chrome.runtime.lastError || !url) return reject(chrome.runtime.lastError);
      const code = new URL(url).searchParams.get('code');
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code })
      });
      const data = await response.json();
      resolve(data.access_token);
    });
  });
}

// 修改 github-service.js 中的 initCloudStorage
import { getAllWatchedVideos } from './db.js'; // 引入读取本地数据的函数

export async function initCloudStorage(token) {
  const saved = await chrome.storage.local.get(['gist_id']);
  if (saved.gist_id) return;

  // --- SRE 修正：在创建云端文件前，先获取本地所有数据 ---
  const localVideos = await getAllWatchedVideos();
  console.log(`检测到本地存量数据 ${localVideos.length} 条，准备同步至云端...`);

  const response = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: { 
      'Authorization': `token ${token}`, 
      'Accept': 'application/vnd.github.v3+json' 
    },
    body: JSON.stringify({
      description: "YT-Marker 视频标记数据",
      public: false,
      files: {
        "yt_marker_data.json": {
          // 这里不再发空数组，而是发 localVideos
          "content": JSON.stringify({ 
            last_sync: Date.now(), 
            videos: localVideos 
          })
        }
      }
    })
  });

  const data = await response.json();
  if (data.id) {
    await chrome.storage.local.set({ gist_id: data.id });
    console.log("全量数据初始化完成！");
  }
}

export async function updateCloudData(videoList) {
  const { github_token, gist_id } = await chrome.storage.local.get(['github_token', 'gist_id']);
  
  if (!github_token || !gist_id) return;

  await fetch(`https://api.github.com/gists/${gist_id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${github_token}`,
      'Accept': 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({
      files: {
        "yt_marker_data.json": {
          "content": JSON.stringify({
            last_sync: Date.now(),
            videos: videoList
          })
        }
      }
    })
  });
  console.log("云端同步完成！");
}