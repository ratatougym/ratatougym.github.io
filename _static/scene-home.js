"use strict";

// Reserve the fixed navbar's actual height, including wrapped mobile links.
const homeHeader = document.querySelector('body > .site-header');
function updateHeaderSpace() {
  const height = homeHeader.getBoundingClientRect().height;
  document.documentElement.style.setProperty('--home-header-height', `${height}px`);
}
updateHeaderSpace();
new ResizeObserver(updateHeaderSpace).observe(homeHeader);

const assets = new URL("scene-clips/", document.currentScript.src);
const grid = document.querySelector("#gallery");
const status = document.querySelector("#status");
const loadingLabel = document.querySelector("#room-loading-label");
const loadingProgress = document.querySelector("#room-loading-progress");
const defaultRoomIndex = 2 * 6 + 0;
const videos = [];
const objectURLs = [];
let ready = false;
let presented = false;
let running = false;
let galleryVisible = true;
let clockStart = 0;
let phase = 0;
let animationFrame = 0;
let playbackGeneration = 0;
let lastSync = 0;
let rooms = [];
let hovered = -1;
let hoverTimer = 0;
let hoverGeneration = 0;
let hoverRequest = null;
let hdVideo = null;
const hdCache = new Map();
const hdDownloads = new Map();
const hdLifetime = new AbortController();
const retiringHD = new Map();

function roomAssetURL(room, key) {
  const url = new URL(room[key], assets);
  // The HD checksum also versions its derived thumbnail and poster.
  if (room.hd_sha256) url.searchParams.set("v", room.hd_sha256);
  return url;
}

function downloadHD(room, priority = "low") {
  if (hdCache.has(room.id)) return Promise.resolve(hdCache.get(room.id));
  if (hdDownloads.has(room.id)) return hdDownloads.get(room.id);
  const download = fetch(roomAssetURL(room, "hd_video"), { signal: hdLifetime.signal, priority })
    .then(response => {
      if (!response.ok) throw Error("HD video unavailable");
      return response.blob();
    })
    .then(blob => {
      hdLifetime.signal.throwIfAborted();
      const url = URL.createObjectURL(blob);
      hdCache.set(room.id, url);
      return url;
    })
    .finally(() => hdDownloads.delete(room.id));
  hdDownloads.set(room.id, download);
  return download;
}

async function preloadHD() {
  let next = 0;
  const worker = async () => {
    while (next < rooms.length && !hdLifetime.signal.aborted) {
      const room = rooms[next++];
      if (!room.hd_video) continue;
      try { await downloadHD(room); }
      catch (error) {
        if (error.name === "AbortError") return;
        console.warn(error.message);
      }
    }
  };
  await Promise.all([worker(), worker()]);
}

function makeVideo(width, height, title) {
  const video = document.createElement("video");
  video.width = width; video.height = height;
  video.muted = true; video.defaultMuted = true;
  video.autoplay = false; video.loop = true; video.playsInline = true;
  video.preload = "auto"; video.controls = false; video.tabIndex = -1;
  video.disablePictureInPicture = true; video.disableRemotePlayback = true;
  video.setAttribute("aria-label", title);
  video.addEventListener("contextmenu", event => event.preventDefault());
  return video;
}

function waitMedia(video, event, signal, action) {
  return new Promise((resolve, reject) => {
    const finish = error => {
      video.removeEventListener(event, done);
      video.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
      if (error) reject(error); else resolve();
    };
    const done = () => finish();
    const failed = () => finish(Error("HD video unavailable"));
    const aborted = () => finish(new DOMException("Cancelled", "AbortError"));
    if (signal.aborted) { aborted(); return; }
    video.addEventListener(event, done, { once: true });
    video.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
    action();
  });
}

function disposeHD(video) {
  clearTimeout(retiringHD.get(video));
  retiringHD.delete(video);
  if (!video.parentElement?.querySelector(".hd-video:not([data-retiring])")) {
    video.parentElement?.classList.remove("hd-ready");
  }
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.remove();
}

function closeHD(animate = false) {
  hoverGeneration++;
  clearTimeout(hoverTimer);
  hoverRequest?.abort();
  hoverRequest = null;
  if (hdVideo) {
    const video = hdVideo;
    video.dataset.retiring = "true";
    if (animate && video.parentElement?.classList.contains("hd-ready")) {
      retiringHD.set(video, setTimeout(() => disposeHD(video), 260));
    } else disposeHD(video);
    hdVideo = null;
  }
}

function waitFrame(video, signal) {
  return new Promise((resolve, reject) => {
    const aborted = () => {
      video.cancelVideoFrameCallback(callback);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const callback = video.requestVideoFrameCallback(() => {
      signal.removeEventListener("abort", aborted);
      resolve();
    });
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  });
}

async function openHD(index, generation) {
  const room = rooms[index];
  if (!ready || !running || !room?.hd_video || generation !== hoverGeneration || hovered !== index || hoverRequest) return;
  const controller = new AbortController();
  hoverRequest = controller;
  try {
    const url = await downloadHD(room, "high");
    if (generation !== hoverGeneration || controller.signal.aborted) return;
    // Keep downloaded clips, but only decode the active hover and its closing transition.
    const scene = grid.children[index];
    const previous = [...retiringHD.keys()].find(video => video.parentElement === scene);
    const video = previous || makeVideo(800, 500, room.title);
    if (previous) {
      clearTimeout(retiringHD.get(previous));
      retiringHD.delete(previous);
      delete previous.dataset.retiring;
    }
    video.className = "hd-video";
    hdVideo = video;
    scene.append(video);
    if (!previous) await waitMedia(video, "loadeddata", controller.signal, () => { video.src = url; video.load(); });
    if (Math.abs(video.duration - videos[0].duration) > 0.01) throw Error("HD loop duration differs");
    const target = clockTime();
    if (target > 0.001) await waitMedia(video, "seeked", controller.signal, () => { video.currentTime = target; });
    await video.play();
    await waitFrame(video, controller.signal);
    if (generation !== hoverGeneration) return;
    scene.classList.add("hd-ready", "expanded-scene");
    fitScenes();
    return true;
  } catch (error) {
    if (generation !== hoverGeneration) return;
    closeHD();
    grid.children[index].classList.add("expanded-scene");
    fitScenes();
    if (error.name !== "AbortError") console.warn(error.message);
    return false;
  }
}

function setHovered(index) {
  if (index === hovered) return;
  closeHD(true);
  if (hovered >= 0) grid.children[hovered]?.classList.remove("expanded-scene");
  hovered = index;
  if (index >= 0) {
    const cached = hdCache.has(rooms[index]?.id);
    if (!cached) grid.children[index].classList.add("expanded-scene");
    const generation = hoverGeneration;
    hoverTimer = setTimeout(() => openHD(index, generation), cached ? 0 : 140);
  }
  fitScenes();
}

function clockTime() {
  return running ? ((performance.now() - clockStart) / 1000) % videos[0].duration : phase;
}

function synchronize() {
  if (!running) return;
  animationFrame = requestAnimationFrame(synchronize);
  const now = performance.now();
  if (now - lastSync < 100) return;
  lastSync = now;
  const target = clockTime();
  const duration = videos[0].duration;
  const players = [...videos, ...[hdVideo, ...retiringHD.keys()].filter(video => video?.readyState >= 2)];
  for (const video of players) {
    const drift = (video.currentTime - target + duration * 1.5) % duration - duration / 2;
    // Rate trim preserves continuous decoding. Seek only to recover a major stall.
    if (!video.seeking && Math.abs(drift) > 0.5) {
      video.currentTime = target;
      video.playbackRate = 1;
    } else if (!video.seeking) {
      video.playbackRate = Math.abs(drift) < 0.01 ? 1 : Math.max(0.97, Math.min(1.03, 1 - drift * 0.5));
    }
  }
}

function pauseGroup() {
  if (!running) return;
  phase = clockTime();
  running = false;
  playbackGeneration++;
  cancelAnimationFrame(animationFrame);
  for (const video of videos) video.pause();
  for (const video of [...retiringHD.keys()]) disposeHD(video);
}

async function playGroup() {
  if (!ready || running || document.hidden || !galleryVisible) return;
  const generation = ++playbackGeneration;
  for (const video of videos) {
    video.currentTime = phase;
    video.playbackRate = 1;
  }
  clockStart = performance.now() - phase * 1000;
  running = true;
  synchronize();
  try {
    await Promise.all(videos.map(video => video.play()));
    if (!running || generation !== playbackGeneration) return;

    // Reveal the gallery only after the default room has a decoded HD frame.
    if (!presented) {
      hovered = defaultRoomIndex;
      const highDefinition = await openHD(hovered, hoverGeneration);
      if (!running || generation !== playbackGeneration) return;
      if (!highDefinition) throw Error("Default room HD playback unavailable");
      presented = true;
      grid.setAttribute("aria-busy", "false");
      status.hidden = true;
      preloadHD();
    } else if (hovered < 0) setHovered(defaultRoomIndex);
  } catch (error) {
    if (!running || generation !== playbackGeneration) return;
    pauseGroup();
    status.hidden = false;
    status.dataset.state = "error";
    loadingLabel.textContent = "Playback unavailable";
    console.error(error);
  }
}

async function loadVideo(video, room) {
  const response = await fetch(roomAssetURL(room, "video"));
  if (!response.ok) throw Error(`Missing video: ${room.id}`);
  // Fetching the whole Blob is a download barrier, unlike canplaythrough/preload.
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  objectURLs.push(url);
  await new Promise((resolve, reject) => {
    video.addEventListener("loadeddata", resolve, { once: true });
    video.addEventListener("error", () => reject(Error(`Invalid video: ${room.id}`)), { once: true });
    video.src = url;
    video.load();
  });
  if (Math.abs(video.duration - 20) > 0.1) throw Error(`Incorrect loop duration: ${room.id}`);
}

function fitScenes() {
  const count = rooms.length;
  if (!count) return;
  const { width, height } = grid.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(grid).gap);
  const size = Math.max(1, Math.floor(Math.min((width - 5 * gap) / 6, (height - 5 * gap) / 6 * 1.6)));
  const cellHeight = size / 1.6;
  grid.style.gridTemplateColumns = `repeat(6, ${size}px)`;
  grid.style.gridTemplateRows = `repeat(6, ${cellHeight}px)`;
  const base = index => ({ x: index % 6 * (size + gap), y: Math.floor(index / 6) * (cellHeight + gap), w: size, h: cellHeight });
  const selected = hovered >= 0 && grid.children[hovered].classList.contains("expanded-scene") ? hovered : -1;
  [...grid.children].forEach((scene, index) => {
    const box = base(index);
    let target = box;
    if (index === selected) {
      // Cover the surrounding ring, including gutters; edge rooms expand inward.
      target = { x: Math.max(0, Math.min(index % 6 - 1, 3)) * (size + gap),
        y: Math.max(0, Math.min(Math.floor(index / 6) - 1, 3)) * (cellHeight + gap),
        w: size * 3 + gap * 2, h: cellHeight * 3 + gap * 2 };
    }
    scene.style.width = `${target.w}px`;
    scene.style.height = `${target.h}px`;
    scene.style.transform = `translate(${target.x - box.x}px, ${target.y - box.y}px)`;
  });
}

async function loadScenes() {
  try {
    const response = await fetch(new URL("index.json", assets), { cache: "no-cache" });
    if (!response.ok) throw Error("Collection unavailable");
    ({ rooms } = await response.json());
    if (rooms.length !== 36) throw Error("Incomplete collection");

    // Download the default enlarged room before competing thumbnail downloads.
    if (!rooms[defaultRoomIndex].hd_video) throw Error("Default room HD unavailable");
    await downloadHD(rooms[defaultRoomIndex], "high");
    for (const room of rooms) {
      if (!room.video || !room.poster) throw Error(`Missing scene: ${room.id}`);
      const scene = document.createElement("figure");
      scene.className = "scene";
      scene.dataset.index = String(videos.length);
      scene.setAttribute("role", "listitem");
      const video = makeVideo(256, 160, room.title);
      video.className = "scene-video";
      video.poster = roomAssetURL(room, "poster").href;
      scene.append(video);
      grid.append(scene);
      videos.push(video);
    }
    fitScenes();
    // Count clips only after download and decoding have both completed.
    let loaded = 0;
    await Promise.all(videos.map(async (video, index) => {
      await loadVideo(video, rooms[index]);
      loadingProgress.value = ++loaded;
    }));
    ready = true;
    await playGroup();
  } catch (error) {
    status.dataset.state = "error";
    grid.setAttribute("aria-busy", "false");
    loadingLabel.textContent = "Collection unavailable";
    console.error(error);
  }
}

new ResizeObserver(fitScenes).observe(grid);
// Pause the gallery while readers explore the demos farther down the page.
new IntersectionObserver(entries => {
  galleryVisible = entries[0].isIntersecting;
  if (galleryVisible) playGroup();
  else { setHovered(-1); pauseGroup(); }
}).observe(grid);
grid.addEventListener("pointermove", event => {
  if (!presented || event.pointerType !== "mouse") return;
  const scene = event.target.closest(".scene");
  // Crossing a gutter keeps the current room and its HD decoder active.
  if (scene) setHovered(Number(scene.dataset.index));
});
grid.addEventListener("pointerleave", () => {
  if (presented) setHovered(ready && running ? defaultRoomIndex : -1);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { setHovered(-1); pauseGroup(); }
  else playGroup();
});
window.addEventListener("pagehide", event => {
  setHovered(-1);
  pauseGroup();
  if (!event.persisted) {
    hdLifetime.abort();
    objectURLs.forEach(url => URL.revokeObjectURL(url));
    hdCache.forEach(url => URL.revokeObjectURL(url));
  }
});
window.addEventListener("pageshow", () => playGroup());
loadScenes();
