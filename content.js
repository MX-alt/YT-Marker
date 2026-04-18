// --- 1. 数据交互层：与 Background (IndexedDB) 通信 ---

async function getWatchedList() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "GET_ALL_WATCHED" }, (response) => {
            resolve(response?.data || []);
        });
    });
}

async function toggleWatchedStatus(videoId) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "SAVE_VIDEO", id: videoId }, (response) => {
            resolve(response.detail === "added"); 
        });
    });
}

// --- 2. UI 渲染层：按钮注入与视觉效果 ---

function updateButtonStyle(btn, isWatched) {
    btn.innerText = isWatched ? '✅ 已看' : '🔘 标记为已看';
    btn.style = `
        background-color: ${isWatched ? '#4CAF50' : 'rgba(255,255,255,0.1)'};
        color: white;
        border: none;
        border-radius: 18px;
        padding: 0 16px;
        margin-left: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        height: 36px;
        line-height: 36px;
        transition: all 0.2s ease;
    `;
}

async function injectMarkButton() {
    // 兼容多种可能的 YouTube 按钮栏选择器
    const menu = document.querySelector('#top-level-buttons-computed') || 
                 document.querySelector('.ytd-menu-renderer #top-level-buttons-section');
    
    if (menu && !document.querySelector('#yt-marker-btn')) {
        const videoId = new URLSearchParams(window.location.search).get('v');
        if (!videoId) return;

        const btn = document.createElement('button');
        btn.id = 'yt-marker-btn';
        
        const watchedList = await getWatchedList();
        const isWatched = watchedList.includes(videoId);
        
        updateButtonStyle(btn, isWatched);

        btn.onclick = async () => {
            const nowIsWatched = await toggleWatchedStatus(videoId);
            updateButtonStyle(btn, nowIsWatched);
            // 按钮状态改变后，顺便刷新一下页面上的列表标记
            applyVisualMarks();
        };

        menu.appendChild(btn);
    }
}

async function applyVisualMarks() {
    const watchedList = await getWatchedList();
    const watchedSet = new Set(watchedList);

    // 针对列表页标题和缩略图进行处理
    const videoElements = document.querySelectorAll('ytd-thumbnail, #video-title');
    
    videoElements.forEach(el => {
        const anchor = el.tagName === 'A' ? el : el.querySelector('a');
        const href = anchor?.href || el.href;
        
        if (href) {
            const match = href.match(/[?&]v=([^&#]+)/);
            const videoId = match ? match[1] : null;
            
            if (videoId && watchedSet.has(videoId)) {
                el.style.opacity = "0.3";
                el.style.filter = "grayscale(100%)";
            } else {
                el.style.opacity = "1";
                el.style.filter = "none";
            }
        }
    });
}

// --- 3. 系统控制层：监听与执行 ---

// 响应来自 Background 的刷新信号（如右键菜单操作）
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "refreshUI") {
        applyVisualMarks();
        if (window.location.pathname === '/watch') injectMarkButton();
    }
});

// 使用防抖机制的 MutationObserver
let debounceTimer;
const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        applyVisualMarks();
        if (window.location.pathname === '/watch') injectMarkButton();
    }, 200); // 200ms 防抖，对旧设备更友好
});

// 启动监听
observer.observe(document.body, { childList: true, subtree: true });

// 首次进入页面执行
applyVisualMarks();
if (window.location.pathname === '/watch') injectMarkButton();