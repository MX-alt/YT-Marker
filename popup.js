document.getElementById('login-btn').addEventListener('click', () => {
  const status = document.getElementById('status');
  status.innerText = "正在跳转...";

  // 向 background.js 发送登录指令
  chrome.runtime.sendMessage({ type: "LOGIN" }, (response) => {
    if (response && response.status === "success") {
      status.innerText = "登录成功！";
      // 登录成功后隐藏按钮或做其他处理
      document.getElementById('login-btn').style.display = 'none';
    } else {
      status.innerText = "登录失败，请重试";
      console.error(response?.message);
    }
  });
});

// 页面打开时检查一下是否已经有 token
chrome.storage.local.get(['github_token'], (result) => {
  if (result.github_token) {
    document.getElementById('login-btn').style.display = 'none';
    document.getElementById('status').innerText = "已登录 GitHub";
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  chrome.storage.local.remove(['github_token', 'gist_id'], () => {
    alert('已登出，缓存已清理');
    window.close(); // 关闭弹窗
  });
});