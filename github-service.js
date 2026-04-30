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

export async function initCloudStorage(token) {
  const saved = await chrome.storage.local.get(['gist_id']);
  if (saved.gist_id) return;

  const response = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' },
    body: JSON.stringify({
      description: "YT-Marker 数据",
      public: false,
      files: { "yt_marker_data.json": { content: JSON.stringify({ last_sync: Date.now(), videos: [] }) } }
    })
  });
  const data = await response.json();
  if (data.id) await chrome.storage.local.set({ gist_id: data.id });
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