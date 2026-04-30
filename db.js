export const DB_CONFIG = { name: "YouTubeHistoryDB", store: "watchedVideos" };

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_CONFIG.name, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_CONFIG.store)) {
        db.createObjectStore(DB_CONFIG.store, { keyPath: "videoId" });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = () => reject("DB Open Error");
  });
}

export async function toggleVideoStatus(videoId) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction([DB_CONFIG.store], "readwrite");
    const store = tx.objectStore(DB_CONFIG.store);
    const getReq = store.get(videoId);
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.delete(videoId);
        resolve("removed");
      } else {
        store.put({ videoId, timestamp: Date.now() });
        resolve("added");
      }
    };
  });
}

export async function getAllWatchedVideos() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction([DB_CONFIG.store], "readonly");
    const store = tx.objectStore(DB_CONFIG.store);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result.map(item => item.videoId));
  });
}