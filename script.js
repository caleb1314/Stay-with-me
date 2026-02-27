// --- 音乐播放器 JS ---
const METING_API = 'https://api.i-meto.com/meting/api';
const audioPlayer = document.getElementById('audioPlayer');
let currentPlaylist = [];
let currentIndex = -1;
let isMusicPlaying = false;
let playMode = 'list'; 
let currentLyrics = [];

function openMusicPlayer() { document.getElementById('music-player-overlay').classList.add('open'); }
function closeMusicPlayer() { document.getElementById('music-player-overlay').classList.remove('open'); }
function openMusicSearch() { const keyword = prompt("搜索歌曲或歌手:"); if (keyword && keyword.trim() !== "") searchMusic(keyword.trim()); }
function closeMusicSearch() { document.getElementById('music-search-overlay').classList.remove('open'); }

async function searchMusic(keyword) {
    const overlay = document.getElementById('music-search-overlay');
    const resultsContainer = document.getElementById('music-search-results');
    overlay.classList.add('open');
    resultsContainer.innerHTML = '<div style="color:#fff; text-align:center;">搜索中...</div>';
    try {
        const url = `${METING_API}?server=netease&type=search&id=${encodeURIComponent(keyword)}&r=${Math.random()}`;
        const response = await fetch(url);
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            currentPlaylist = data;
            renderSearchResults(data);
        } else {
            resultsContainer.innerHTML = '<div style="color:#fff; text-align:center;">未找到结果</div>';
        }
    } catch (error) {
        resultsContainer.innerHTML = '<div style="color:#fff; text-align:center;">搜索失败</div>';
    }
}

function renderSearchResults(data) {
    const container = document.getElementById('music-search-results');
    container.innerHTML = '';
    data.forEach((song, index) => {
        const item = document.createElement('div');
        item.className = 'search-item';
        item.onclick = () => { playSongByIndex(index); closeMusicSearch(); };
        item.innerHTML = `<div class="search-cover" style="background-image: url('${song.pic.replace(/^http:/i, 'https:')}')"></div><div class="search-info"><div class="search-title">${song.title}</div><div class="search-artist">${song.author}</div></div>`;
        container.appendChild(item);
    });
}

async function playSongByIndex(index) {
    if (index < 0 || index >= currentPlaylist.length) return;
    currentIndex = index;
    const song = currentPlaylist[index];
    let secureUrl = song.url.replace(/^http:/i, 'https://');
    if (secureUrl.includes('sycdn.kuwo.cn')) secureUrl = secureUrl.replace(/^https?:\/\/([^.]+)\.sycdn\.kuwo\.cn\//, 'https://$1-sycdn.kuwo.cn/');
    audioPlayer.src = secureUrl;
    audioPlayer.play().then(() => setMusicPlayState(true)).catch(e => setMusicPlayState(false));
    updatePlayerUI(song);
    loadLyrics(song.lrc);
    saveMusicState();
}

function updatePlayerUI(song) {
    const securePic = song.pic.replace(/^http:/i, 'https:');
    document.getElementById('playerAlbumArt').style.backgroundImage = `url(${securePic})`;
    document.getElementById('player-bg').style.backgroundImage = `url(${securePic})`;
    document.getElementById('player-track-title').textContent = song.title;
    document.getElementById('player-track-artist').textContent = song.author;
}

function setMusicPlayState(isPlaying) {
    isMusicPlaying = isPlaying;
    document.getElementById('playerPlayIcon').style.display = isPlaying ? 'none' : 'block';
    document.getElementById('playerPauseIcon').style.display = isPlaying ? 'block' : 'none';
    document.getElementById('playerAlbumArt').classList.toggle('paused', !isPlaying);
}

function togglePlay() {
    if (currentIndex === -1) {
        if (currentPlaylist.length > 0) playSongByIndex(0);
        else openMusicSearch();
        return;
    }
    if (audioPlayer.paused) { audioPlayer.play(); setMusicPlayState(true); } 
    else { audioPlayer.pause(); setMusicPlayState(false); }
}

function playNext() { let nextIndex = currentIndex + 1; if (nextIndex >= currentPlaylist.length) nextIndex = 0; playSongByIndex(nextIndex); }
function playPrev() { let prevIndex = currentIndex - 1; if (prevIndex < 0) prevIndex = currentPlaylist.length - 1; playSongByIndex(prevIndex); }

function formatTime(s) {
    if (isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

audioPlayer.addEventListener('timeupdate', () => {
    const { currentTime, duration } = audioPlayer;
    if (isNaN(duration)) return;
    const percent = (currentTime / duration) * 100;
    document.getElementById('player-progress-fill').style.width = `${percent}%`;
    document.getElementById('player-current-time').textContent = formatTime(currentTime);
    document.getElementById('player-total-time').textContent = `-${formatTime(duration - currentTime)}`;
    updateLyrics(currentTime);
    saveMusicProgress(currentTime);
});

audioPlayer.addEventListener('ended', () => {
    if (playMode === 'single') playSongByIndex(currentIndex);
    else if (playMode === 'random') {
        let nextIndex = currentIndex;
        if (currentPlaylist.length > 1) while (nextIndex === currentIndex) nextIndex = Math.floor(Math.random() * currentPlaylist.length);
        playSongByIndex(nextIndex);
    } else playNext();
});

document.getElementById('player-progress-container').addEventListener('click', function(e) {
    const rect = this.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    if (audioPlayer.duration) audioPlayer.currentTime = percent * audioPlayer.duration;
});

document.getElementById('player-volume-container').addEventListener('click', function(e) {
    const rect = this.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioPlayer.volume = percent;
    document.getElementById('player-volume-fill').style.width = `${percent * 100}%`;
});

async function loadLyrics(lrcUrl) {
    const container = document.getElementById('player-lyrics-display');
    container.innerHTML = '<div class="lyric-line" style="margin-top: 45%">Loading...</div>';
    currentLyrics = [];
    if (!lrcUrl) { container.innerHTML = '<div class="lyric-line" style="margin-top: 45%">无歌词</div>'; return; }
    try {
        let text = '';
        try { text = await (await fetch(lrcUrl)).text(); } catch (e) { text = await (await fetch(`https://corsproxy.io/?${encodeURIComponent(lrcUrl)}`)).text(); }
        parseLyrics(text);
    } catch (e) { container.innerHTML = '<div class="lyric-line" style="margin-top: 45%">歌词加载失败</div>'; }
}

function parseLyrics(text) {
    const container = document.getElementById('player-lyrics-display');
    container.innerHTML = '';
    currentLyrics = [];
    const lines = text.split('\n');
    lines.forEach(line => {
        const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
        if (match) {
            const time = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 1000;
            const text = match[4].trim();
            if (text) {
                currentLyrics.push({ time, text });
                const div = document.createElement('div');
                div.className = 'lyric-line';
                div.textContent = text;
                div.onclick = () => { audioPlayer.currentTime = time; audioPlayer.play(); };
                container.appendChild(div);
            }
        }
    });
    if (currentLyrics.length > 0) {
        const spacerTop = document.createElement('div'); spacerTop.style.height = '45%';
        const spacerBottom = document.createElement('div'); spacerBottom.style.height = '45%';
        container.prepend(spacerTop); container.appendChild(spacerBottom);
    } else { container.innerHTML = '<div class="lyric-line" style="margin-top: 45%">纯音乐 / 无歌词</div>'; }
}

function updateLyrics(currentTime) {
    if (currentLyrics.length === 0) return;
    let activeIndex = -1;
    for (let i = 0; i < currentLyrics.length; i++) {
        if (currentLyrics[i].time <= currentTime + 0.5) activeIndex = i; else break;
    }
    if (activeIndex !== -1) {
        const lines = document.querySelectorAll('#player-lyrics-display .lyric-line');
        lines.forEach((line, i) => {
            if (i === activeIndex) {
                if (!line.classList.contains('active')) { line.classList.add('active'); line.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            } else { line.classList.remove('active'); }
        });
    }
}

function toggleLyrics() {
    document.getElementById('btn-lyrics').classList.toggle('active');
    document.getElementById('player-album-section').classList.toggle('lyrics-mode');
    document.getElementById('player-lyrics-display').classList.toggle('visible');
}

function openMoreMenu() { const modal = document.getElementById('music-more-modal'); modal.style.display = 'flex'; setTimeout(() => modal.classList.add('active'), 10); }
function closeMoreMenu() { const modal = document.getElementById('music-more-modal'); modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 300); }
function startListenTogether() { alert("正在邀请好友一起听..."); closeMoreMenu(); }
function openChat() { alert("打开聊天窗口..."); closeMoreMenu(); }

function togglePlayMode() {
    const modes = ['list', 'single', 'random'];
    playMode = modes[(modes.indexOf(playMode) + 1) % modes.length];
    const btn = document.getElementById('play-mode-btn');
    if (playMode === 'list') btn.textContent = '列表循环';
    else if (playMode === 'single') btn.textContent = '单曲循环';
    else btn.textContent = '随机播放';
    saveMusicState();
}

function saveMusicState() { localStorage.setItem('music_state', JSON.stringify({ playlist: currentPlaylist, index: currentIndex, mode: playMode })); }
function saveMusicProgress(time) { localStorage.setItem('music_currentTime', time); }

function restoreMusicState() {
    const savedState = localStorage.getItem('music_state');
    const savedTime = localStorage.getItem('music_currentTime');
    if (savedState) {
        try {
            const state = JSON.parse(savedState);
            if (state.playlist && state.playlist.length > 0) {
                currentPlaylist = state.playlist; currentIndex = state.index; playMode = state.mode || 'list';
                if (currentIndex >= 0 && currentIndex < currentPlaylist.length) {
                    const song = currentPlaylist[currentIndex];
                    let secureUrl = song.url.replace(/^http:/i, 'https://');
                    if (secureUrl.includes('sycdn.kuwo.cn')) secureUrl = secureUrl.replace(/^https?:\/\/([^.]+)\.sycdn\.kuwo\.cn\//, 'https://$1-sycdn.kuwo.cn/');
                    audioPlayer.src = secureUrl;
                    updatePlayerUI(song); loadLyrics(song.lrc);
                    if (savedTime) audioPlayer.currentTime = parseFloat(savedTime);
                }
            }
        } catch (e) { console.error("Failed to restore music state", e); }
    }
}

// --- 状态栏更新 ---
function updateStatus() {
    const now = new Date();
    document.getElementById('currentTime').innerText = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (navigator.getBattery) navigator.getBattery().then(battery => document.getElementById('batteryText').textContent = Math.floor(battery.level * 100));
}
setInterval(updateStatus, 1000); updateStatus();

// --- 设置界面控制 ---
function openSettings() { const screen = document.getElementById('settingsScreen'); screen.style.display = 'flex'; setTimeout(() => screen.classList.add('active'), 10); }
function closeSettings() { const screen = document.getElementById('settingsScreen'); screen.classList.remove('active'); setTimeout(() => screen.style.display = 'none', 400); }

// --- IndexedDB 核心逻辑 (异步封装) ---
const dbName = "HajimiStorage";
const storeName = "images";
let db;

const request = indexedDB.open(dbName, 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: "id" });
};
request.onsuccess = (e) => {
    db = e.target.result;
    loadAllImages();
};

function saveImageToDB(id, data) {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    store.put({ id, data });
}

function saveImageToDBAsync(id, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const req = store.put({ id, data });
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e);
    });
}

function deleteImageFromDBAsync(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e);
    });
}

function loadAllImages() {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => {
        req.result.forEach(item => {
            if (item.id.startsWith('icon-')) {
                const appId = item.id.replace('icon-', '');
                const appEl = document.querySelector(`[data-app-id="${appId}"]`);
                if (appEl) {
                    const iconEl = appEl.classList.contains('dock-text-icon') ? appEl : appEl.querySelector('.app-icon');
                    if (iconEl) {
                        iconEl.style.backgroundImage = `url(${item.data})`;
                        if (appEl.classList.contains('dock-text-icon')) appEl.classList.add('has-custom-icon');
                    }
                }
            } else if (item.id === 'time-decorator') {
                const el = document.getElementById('timeDecorator');
                if (el) el.style.backgroundImage = `url(${item.data})`;
                // 确保设置界面的文字提示正确，不显示图片
                const labelEl = document.getElementById('time-decorator-label');
                if (labelEl) labelEl.innerText = "时间栏装饰 (已自定义)";
            } else if (item.id.startsWith('wallpaper-')) {
                // 壁纸数据由壁纸逻辑单独处理
            } else {
                const el = document.querySelector(`[data-img-id="${item.id}"]`);
                if (el) el.style.backgroundImage = `url(${item.data})`;
            }
        });
        loadCurrentWallpaper(); // 确保壁纸被加载
    };
}

// --- 弹窗与上传逻辑 ---
let currentTargetId = null;
const modal = document.getElementById('uploadModal');
const fileInput = document.getElementById('fileInput');
const urlWrap = document.getElementById('urlInputWrap');

document.addEventListener('click', (e) => {
    const target = e.target.closest('.img-upload-target');
    if (target) { currentTargetId = target.getAttribute('data-img-id'); openModal(); }
});

function openModal() { modal.style.display = 'flex'; setTimeout(() => modal.classList.add('active'), 10); }
function closeModal() { modal.classList.remove('active'); setTimeout(() => { modal.style.display = 'none'; urlWrap.classList.remove('active'); document.getElementById('imageUrlInput').value = ''; }, 300); }
function triggerFileSelect() { fileInput.click(); }

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => applyImage(event.target.result);
        reader.readAsDataURL(file);
    }
});

function toggleUrlInput() { urlWrap.classList.toggle('active'); }
function saveUrlImage() { const url = document.getElementById('imageUrlInput').value; if (url) applyImage(url); }

function applyImage(data) {
    // 在美化页面修改图标，仅更新预览和标记，不直接存 DB
    if (currentTargetId && currentTargetId.startsWith('beautify-app-icon-')) {
        const el = document.querySelector(`[data-img-id="${currentTargetId}"]`);
        if (el) {
            el.style.backgroundImage = `url(${data})`;
            el.dataset.modified = "true";
            el.dataset.newImageData = data;
        }
        closeModal();
        return;
    }
    // 时间栏装饰特殊处理：不显示图片背景，只改文字提示，并实时预览到顶部
    if (currentTargetId === 'time-decorator') {
        const el = document.getElementById('time-decorator-label');
        if(el) {
            el.innerText = "时间栏装饰 (已选择新图片)";
            el.dataset.modified = "true";
            el.dataset.newImageData = data;
            document.getElementById('timeDecorator').style.backgroundImage = `url(${data})`;
        }
        closeModal();
        return;
    }
    // 普通组件直接应用并存 DB
    const el = document.querySelector(`[data-img-id="${currentTargetId}"]`);
    if (el) {
        el.style.backgroundImage = `url(${data})`;
        saveImageToDB(currentTargetId, data);
        const appEl = el.closest('.dock-text-icon');
        if (appEl) appEl.classList.add('has-custom-icon');
        closeModal();
    }
}

// --- 字体与 CSS 预设逻辑 ---
function previewFont() { 
    const url = document.getElementById('custom-font-url').value;
    applyFontToPage(url); 
    const previewBox = document.getElementById('font-preview-box');
    if (url) previewBox.style.fontFamily = 'HajimiCustomFont';
    else previewBox.style.fontFamily = '';
}
function applyFontToPage(url) {
    let styleEl = document.getElementById('custom-font-style');
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'custom-font-style'; document.head.appendChild(styleEl); }
    if (url) styleEl.innerHTML = `@font-face { font-family: 'HajimiCustomFont'; src: url('${url}'); } * { font-family: 'HajimiCustomFont', -apple-system, BlinkMacSystemFont, sans-serif !important; }`;
    else styleEl.innerHTML = '';
}
function saveFontPreset() {
    const url = document.getElementById('custom-font-url').value;
    if (!url) return alert('请输入字体链接');
    const name = prompt('请输入字体预设名称：');
    if (!name) return;
    let presets = JSON.parse(localStorage.getItem('hajimi_font_presets') || '[]');
    presets.push({ name, url });
    localStorage.setItem('hajimi_font_presets', JSON.stringify(presets));
    loadFontPresets(); alert('保存成功');
}
function loadFontPresets() {
    const select = document.getElementById('font-preset-select');
    select.innerHTML = '<option value="">选择预设...</option>';
    let presets = JSON.parse(localStorage.getItem('hajimi_font_presets') || '[]');
    presets.forEach((p, index) => select.innerHTML += `<option value="${index}">${p.name}</option>`);
}
function applyFontPreset() {
    const select = document.getElementById('font-preset-select');
    if (select.value === "") return;
    const preset = JSON.parse(localStorage.getItem('hajimi_font_presets') || '[]')[select.value];
    if (preset) { document.getElementById('custom-font-url').value = preset.url; previewFont(); }
}

function previewCSS() { applyCSSToPage(document.getElementById('custom-css-input').value); }
function applyCSSToPage(css) {
    let styleEl = document.getElementById('custom-css-style');
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'custom-css-style'; document.head.appendChild(styleEl); }
    styleEl.innerHTML = css || '';
}
function saveCSSPreset() {
    const css = document.getElementById('custom-css-input').value;
    if (!css) return alert('请输入 CSS 代码');
    const name = prompt('请输入 CSS 预设名称：');
    if (!name) return;
    let presets = JSON.parse(localStorage.getItem('hajimi_css_presets') || '[]');
    presets.push({ name, css });
    localStorage.setItem('hajimi_css_presets', JSON.stringify(presets));
    loadCSSPresets(); alert('保存成功');
}
function loadCSSPresets() {
    const select = document.getElementById('css-preset-select');
    select.innerHTML = '<option value="">选择预设...</option>';
    let presets = JSON.parse(localStorage.getItem('hajimi_css_presets') || '[]');
    presets.forEach((p, index) => select.innerHTML += `<option value="${index}">${p.name}</option>`);
}
function applyCSSPreset() {
    const select = document.getElementById('css-preset-select');
    if (select.value === "") return;
    const preset = JSON.parse(localStorage.getItem('hajimi_css_presets') || '[]')[select.value];
    if (preset) { document.getElementById('custom-css-input').value = preset.css; previewCSS(); }
}

// --- 滑动条实时预览逻辑 ---
function updateFontSizePreview() {
    const val = document.getElementById('font-size-slider').value;
    document.documentElement.style.setProperty('--font-scale', val);
}
function updateTimeDecPreview() {
    const val = document.getElementById('time-dec-slider').value;
    document.documentElement.style.setProperty('--time-dec-size', val + 'px');
}
function resetSlider(type) {
    if (type === 'font-size') {
        document.getElementById('font-size-slider').value = 1;
        updateFontSizePreview();
    } else if (type === 'time-dec') {
        document.getElementById('time-dec-slider').value = 18;
        updateTimeDecPreview();
    }
}

// --- 壁纸功能逻辑 ---
const wallpaperScreen = document.getElementById('wallpaperScreen');
let wallpapers = JSON.parse(localStorage.getItem('hajimi_wallpapers') || '[]');
let currentWallpaperId = localStorage.getItem('hajimi_current_wallpaper') || null;

function openWallpaperScreen() {
    renderWallpaperList();
    updateWallpaperPreview();
    wallpaperScreen.style.display = 'flex';
    setTimeout(() => wallpaperScreen.classList.add('active'), 10);
}
function closeWallpaperScreen() {
    wallpaperScreen.classList.remove('active');
    setTimeout(() => wallpaperScreen.style.display = 'none', 400);
}

function updateWallpaperPreview() {
    const previewEl = document.getElementById('current-wallpaper-preview');
    if (currentWallpaperId) {
        getWallpaperFromDB(currentWallpaperId, (data) => {
            if(data) previewEl.style.backgroundImage = `url(${data})`;
            else previewEl.style.backgroundImage = '';
        });
    } else {
        previewEl.style.backgroundImage = '';
    }
}

function renderWallpaperList() {
    const container = document.getElementById('wallpaper-list-container');
    container.innerHTML = '';
    wallpapers.forEach(id => {
        const item = document.createElement('div');
        item.className = `wallpaper-item ${id === currentWallpaperId ? 'active' : ''}`;
        item.onclick = () => applyWallpaper(id);
        
        const delBtn = document.createElement('div');
        delBtn.className = 'wallpaper-delete';
        delBtn.innerHTML = '×';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteWallpaper(id); };
        
        item.appendChild(delBtn);
        container.appendChild(item);

        getWallpaperFromDB(id, (data) => {
            if(data) item.style.backgroundImage = `url(${data})`;
        });
    });
}

function getWallpaperFromDB(id, callback) {
    if(!db) return callback(null);
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => {
        if (req.result) callback(req.result.data);
        else callback(null);
    };
}

function applyWallpaper(id) {
    currentWallpaperId = id;
    localStorage.setItem('hajimi_current_wallpaper', id);
    renderWallpaperList();
    updateWallpaperPreview();
    loadCurrentWallpaper();
}

function loadCurrentWallpaper() {
    const currentId = localStorage.getItem('hajimi_current_wallpaper');
    if (currentId) {
        getWallpaperFromDB(currentId, (data) => {
            if (data) {
                document.body.style.backgroundImage = `url(${data})`;
                document.body.style.backgroundSize = 'cover'; // 完美全屏覆盖
            } else {
                resetToDefaultWallpaper();
            }
        });
    } else {
        resetToDefaultWallpaper();
    }
}

function resetToDefaultWallpaper() {
    document.body.style.backgroundImage = `url("data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.9' fill-rule='evenodd'%3E%3Cpath d='M12.5 4l2 6h6.5l-5 4 2 6-5-4-5 4 2-6-5-4h6.5zM37.5 29l2 6h6.5l-5 4 2 6-5-4-5 4 2-6-5-4h6.5z'/%3E%3C/g%3E%3C/svg%3E")`;
    document.body.style.backgroundSize = '50px 50px'; // 恢复极简网格尺寸
}

async function deleteWallpaper(id) {
    if(!confirm('确定删除此壁纸吗？')) return;
    wallpapers = wallpapers.filter(w => w !== id);
    localStorage.setItem('hajimi_wallpapers', JSON.stringify(wallpapers));
    await deleteImageFromDBAsync(id);
    if (currentWallpaperId === id) {
        currentWallpaperId = null;
        localStorage.removeItem('hajimi_current_wallpaper');
        loadCurrentWallpaper();
    }
    renderWallpaperList();
    updateWallpaperPreview();
}

function triggerWallpaperUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const data = event.target.result;
                const newId = 'wallpaper-' + Date.now();
                await saveImageToDBAsync(newId, data);
                wallpapers.push(newId);
                localStorage.setItem('hajimi_wallpapers', JSON.stringify(wallpapers));
                applyWallpaper(newId);
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
}

// --- 主界面美化核心逻辑 ---
const beautifyScreen = document.getElementById('beautifyScreen');
const beautifyAppList = document.getElementById('beautify-app-list');
const importFileInput = document.getElementById('importFileInput');
const BEAUTIFY_STORAGE_KEY = 'hajimi_beautify_data';

function openBeautifyScreen() {
    populateBeautifyList();
    loadFontPresets();
    loadCSSPresets();
    beautifyScreen.style.display = 'flex';
    setTimeout(() => beautifyScreen.classList.add('active'), 10);
}

function closeBeautifyScreen() {
    beautifyScreen.classList.remove('active');
    setTimeout(() => beautifyScreen.style.display = 'none', 400);
}

function populateBeautifyList() {
    beautifyAppList.innerHTML = '';
    const allApps = document.querySelectorAll('[data-app-id]');
    allApps.forEach(appEl => {
        const appId = appEl.dataset.appId;
        if (appId.startsWith('beautify-') || appId === 'time-decorator') return;

        const appNameEl = appEl.querySelector('.app-name');
        const appIconEl = appEl.classList.contains('dock-text-icon') ? appEl : appEl.querySelector('.app-icon');
        const currentName = appNameEl ? appNameEl.textContent : appEl.textContent;
        
        // 完美修复：直接读取主界面图标当前的内联背景，确保刷新后依然能获取到自定义图标
        let inlineBg = appIconEl.style.backgroundImage;
        let bgStyle = (inlineBg && inlineBg !== 'none') 
            ? `background-image: ${inlineBg};` 
            : `background-color: ${window.getComputedStyle(appIconEl).backgroundColor};`;

        // 记录默认名称
        if (!appEl.dataset.defaultName) appEl.dataset.defaultName = currentName;
        const defaultName = appEl.dataset.defaultName;

        const itemHTML = `
            <div class="beautify-app-item" data-app-id="${appId}" id="beautify-item-${appId}">
                <div class="beautify-app-icon img-upload-target" data-img-id="beautify-app-icon-${appId}" style="${bgStyle}"></div>
                <input type="text" class="beautify-app-name-input" value="${currentName}">
                <div class="reset-btn" onclick="resetAppIcon('${appId}', '${defaultName}')">
                    <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </div>
            </div>
        `;
        beautifyAppList.insertAdjacentHTML('beforeend', itemHTML);
    });
}

// 重置功能
function resetAppIcon(appId, defaultName) {
    const item = document.getElementById(`beautify-item-${appId}`);
    if (!item) return;
    const iconEl = item.querySelector('.beautify-app-icon');
    const inputEl = item.querySelector('.beautify-app-name-input');
    
    inputEl.value = defaultName;
    iconEl.style.backgroundImage = 'none'; 
    iconEl.dataset.modified = "true";
    iconEl.dataset.reset = "true";
}

function resetBeautifyItem(type) {
    if (type === 'time-decorator') {
        const el = document.getElementById('time-decorator-label');
        el.innerText = "时间栏装饰 (点击更改)";
        el.dataset.modified = "true";
        el.dataset.reset = "true";
        document.getElementById('timeDecorator').style.backgroundImage = 'none';
    } else if (type === 'font') {
        document.getElementById('custom-font-url').value = '';
        previewFont();
    } else if (type === 'css') {
        document.getElementById('custom-css-input').value = '';
        previewCSS();
    }
}

async function saveBeautification() {
    const data = {
        topBarVisible: document.getElementById('beautify-toggle-topbar').classList.contains('on'),
        customFontUrl: document.getElementById('custom-font-url').value,
        customCSS: document.getElementById('custom-css-input').value,
        fontScale: document.getElementById('font-size-slider').value,
        timeDecSize: document.getElementById('time-dec-slider').value,
        apps: {}
    };

    // 处理时间栏装饰
    const timeDecEl = document.getElementById('time-decorator-label');
    if (timeDecEl.dataset.reset === "true") {
        await deleteImageFromDBAsync('time-decorator');
        delete timeDecEl.dataset.reset;
    } else if (timeDecEl.dataset.modified === "true" && timeDecEl.dataset.newImageData) {
        await saveImageToDBAsync('time-decorator', timeDecEl.dataset.newImageData);
        delete timeDecEl.dataset.modified;
    }

    // 处理 App 图标
    const appItems = document.querySelectorAll('#beautify-app-list .beautify-app-item');
    for (const item of appItems) {
        const appId = item.dataset.appId;
        const newName = item.querySelector('.beautify-app-name-input').value;
        const iconEl = item.querySelector('.beautify-app-icon');
        
        data.apps[appId] = { name: newName };
        
        if (iconEl.dataset.modified === "true") {
            if (iconEl.dataset.reset === "true") {
                await deleteImageFromDBAsync('icon-' + appId);
                const mainAppEl = document.querySelector(`[data-app-id="${appId}"]`);
                if (mainAppEl) {
                    const mainIconEl = mainAppEl.classList.contains('dock-text-icon') ? mainAppEl : mainAppEl.querySelector('.app-icon');
                    mainIconEl.style.backgroundImage = '';
                    mainAppEl.classList.remove('has-custom-icon');
                }
            } else if (iconEl.dataset.newImageData) {
                await saveImageToDBAsync('icon-' + appId, iconEl.dataset.newImageData);
            }
            delete iconEl.dataset.modified;
            delete iconEl.dataset.reset;
            delete iconEl.dataset.newImageData;
        }
    }

    localStorage.setItem(BEAUTIFY_STORAGE_KEY, JSON.stringify(data));
    applyBeautification(data);
    
    loadAllImages(); // 重新加载 DB 图标
    
    // 提示保存成功，但不关闭窗口
    alert('美化设置已保存！');
}

function applyBeautification(data) {
    if (!data) return;
    document.querySelector('.status-bar').style.opacity = data.topBarVisible ? '1' : '0';
    
    if (data.customFontUrl !== undefined) { document.getElementById('custom-font-url').value = data.customFontUrl; applyFontToPage(data.customFontUrl); }
    if (data.customCSS !== undefined) { document.getElementById('custom-css-input').value = data.customCSS; applyCSSToPage(data.customCSS); }
    
    if (data.fontScale) {
        document.documentElement.style.setProperty('--font-scale', data.fontScale);
        const slider = document.getElementById('font-size-slider');
        if(slider) slider.value = data.fontScale;
    }
    if (data.timeDecSize) {
        document.documentElement.style.setProperty('--time-dec-size', data.timeDecSize + 'px');
        const slider = document.getElementById('time-dec-slider');
        if(slider) slider.value = data.timeDecSize;
    }

    if(data.apps) {
        for (const appId in data.apps) {
            const appEl = document.querySelector(`[data-app-id="${appId}"]`);
            if (appEl) {
                const nameEl = appEl.querySelector('.app-name') || appEl;
                if (nameEl) nameEl.textContent = data.apps[appId].name;
            }
        }
    }
}

function loadBeautification() {
    const data = JSON.parse(localStorage.getItem(BEAUTIFY_STORAGE_KEY));
    if (data) {
        applyBeautification(data);
        document.getElementById('beautify-toggle-topbar').classList.toggle('on', data.topBarVisible);
    }
}

function clearBeautification() {
    if (confirm('确定要清空所有美化设置及壁纸吗？此操作不可逆。')) {
        localStorage.removeItem(BEAUTIFY_STORAGE_KEY);
        localStorage.removeItem('hajimi_wallpapers');
        localStorage.removeItem('hajimi_current_wallpaper');
        
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const req = store.getAllKeys();
        req.onsuccess = () => {
            req.result.forEach(key => { 
                if (key.startsWith('icon-') || key === 'time-decorator' || key.startsWith('wallpaper-')) {
                    store.delete(key); 
                }
            });
            window.location.reload();
        };
    }
}

function exportBeautification() {
    const data = localStorage.getItem(BEAUTIFY_STORAGE_KEY);
    if (!data) return alert('没有可导出的美化数据。');
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `hajimi_beautify_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function importBeautification() { importFileInput.click(); }

importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                localStorage.setItem(BEAUTIFY_STORAGE_KEY, JSON.stringify(data));
                applyBeautification(data); alert('导入成功！'); closeBeautifyScreen();
            } catch (err) { alert('导入失败，文件格式错误。'); }
        };
        reader.readAsText(file);
    }
    e.target.value = ''; 
});

// --- 自动保存与加载 ---
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('mainPages');
    const lastScrollLeft = localStorage.getItem('hajimi_last_scroll');
    if (lastScrollLeft !== null) container.scrollTo({ left: parseInt(lastScrollLeft), behavior: 'instant' });
    
    restoreMusicState();
    loadBeautification(); 

    let scrollTimer;
    container.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => localStorage.setItem('hajimi_last_scroll', container.scrollLeft), 100);
    });

    document.addEventListener('blur', (e) => {
        if (e.target.hasAttribute('contenteditable')) {
            const saveKey = e.target.getAttribute('data-save');
            if (saveKey) localStorage.setItem(saveKey, e.target.innerText);
        }
    }, true);

    document.addEventListener('keydown', (e) => {
        if (e.target.hasAttribute('contenteditable') && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
    });

    document.querySelectorAll('[data-save]').forEach(el => {
        const savedValue = localStorage.getItem(el.getAttribute('data-save'));
        if (savedValue) el.innerText = savedValue;
    });
});
