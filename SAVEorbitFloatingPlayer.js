// orbitFloatingPlayer.js
//import { registerResource } from "/js/core/resourceManager.js";

let glowInterval = null;
let orbitInterval = null;

if (window.__floatingPlayerLoaded) {
  console.warn("Floating player already loaded — skipping.");
} else {
  window.__floatingPlayerLoaded = true;

  // 👇 PUT THE REST OF FILE BELOW THIS LINE
 
async function setupFloatingPlayer() {
  const { audioSession } = await import('./audio-session.js');
  const { activityBounds } = await import('./edge-docking.js');
  const audio = audioSession.audio;
  const existing = document.getElementById("floatingPlayer");
  existing?.__audioUnsubscribe?.();
  existing?.__viewportCleanup?.();
  existing?.__edgeParking?.destroy();
  if (existing) existing.remove();

  // --- Player container ---
  const initialArea = activityBounds();
  const player = document.createElement("div");
  player.id = "floatingPlayer";
  Object.assign(player.style, {
    position: "fixed",
    bottom: "auto",
    top: Math.max(initialArea.top, initialArea.bottom - 190 - 46) + "px",
    left: (initialArea.left + Math.max(0, (initialArea.width - 190)/2)) + "px",
    right: "auto",
    width: "190px",
    height: "190px",
    borderRadius: "50%",
    backdropFilter: "blur(8px)",
    background: "radial-gradient(120% 120% at 30% 30%, rgba(31,41,55,0.95), rgba(17,24,39,0.9))",
    boxShadow: "0 12px 28px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.06)",
    display: "grid",
    gridTemplateRows: "1fr auto",
    alignItems: "center",
    justifyItems: "center",
    color: "#fff",
    padding: "10px",
    cursor: "grab",
    zIndex: 3,
    userSelect: "none",
    overflow: "visible"
  });

    const floatingPlayer = document.getElementById("floatingPlayer");

// Ensure floatingPlayer exists
if (floatingPlayer) {


  // --- GLOW EFFECT ---
  let glowGrowing = true;
  setInterval(() => {
    floatingPlayer.style.boxShadow = glowGrowing
      ? "0 0 30px rgba(0,255,255,1), 0 0 50px rgba(0,255,255,0.5) inset"
      : "0 0 20px rgba(0,255,255,0.8, 0 0 40px rgba(0,255,255,0.4) inset";
    glowGrowing = !glowGrowing;
  }, 800); // pulses every 0.8s

  // --- ORBIT EFFECT ---
  const centerX = 300; // adjust to orbit center X
  const centerY = 200; // adjust to orbit center Y
  const radius = 100; // orbit radius
  let orbitAngle = 0;

  setInterval(() => {
    orbitAngle += 0.02; // orbit speed
    const x = centerX + radius * Math.cos(orbitAngle);
    const y = centerY + radius * Math.sin(orbitAngle);
    floatingPlayer.style.left = `${x}px`;
    floatingPlayer.style.top = `${y}px`;
  }, 16); // ~60fps
}


  // --- Glow ring ---
  const ring = document.createElement("div");
  ring.className = "orbit-glow";
  Object.assign(ring.style, {
    position: "absolute",
    inset: "8px",
    borderRadius: "50%",
    background: "conic-gradient(from 0deg, rgba(59,130,246,0.25), rgba(34,197,94,0.25), rgba(59,130,246,0.25))",
    filter: "blur(8px)",
    opacity: "0.6",
    pointerEvents: "none"
  });
  player.appendChild(ring);

  // --- SVG progress ---
  const svgNS = "http://www.w3.org/2000/svg";
  const size = 170, r = 76, C = 2*Math.PI*r;
  const svg = document.createElementNS(svgNS, "svg");
  svg.classList.add("orbit-progress");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  Object.assign(svg.style,{
    position:"absolute",
    top:"50%",
    left:"50%",
    transform:"translate(-50%, -50%)",
    overflow:"visible",
    pointerEvents:"none"
  });
  const circleBg = document.createElementNS(svgNS,"circle");
  circleBg.setAttribute("cx", size/2);
  circleBg.setAttribute("cy", size/2);
  circleBg.setAttribute("r", r);
  circleBg.setAttribute("stroke", "rgba(255,255,255,0.15)");
  circleBg.setAttribute("stroke-width", "6");
  circleBg.setAttribute("fill", "none");
  const circleProgress = document.createElementNS(svgNS,"circle");
  circleProgress.setAttribute("cx", size/2);
  circleProgress.setAttribute("cy", size/2);
  circleProgress.setAttribute("r", r);
  circleProgress.setAttribute("stroke", "url(#fpGrad)");
  circleProgress.setAttribute("stroke-width", "6");
  circleProgress.setAttribute("fill", "none");
  circleProgress.setAttribute("stroke-linecap", "round");
  circleProgress.setAttribute("stroke-dasharray", C.toString());
  circleProgress.setAttribute("stroke-dashoffset", C.toString());
  circleProgress.setAttribute("transform", `rotate(-90 ${size/2} ${size/2})`);
  const defs = document.createElementNS(svgNS,"defs");
  const grad = document.createElementNS(svgNS,"linearGradient");
  grad.setAttribute("id","fpGrad");
  grad.setAttribute("x1","0%");
  grad.setAttribute("y1","0%");
  grad.setAttribute("x2","100%");
  grad.setAttribute("y2","0%");
  const stop1 = document.createElementNS(svgNS,"stop");
  stop1.setAttribute("offset","0%");
  stop1.setAttribute("stop-color","#60a5fa");
  const stop2 = document.createElementNS(svgNS,"stop");
  stop2.setAttribute("offset","100%");
  stop2.setAttribute("stop-color","#34d399");
  grad.appendChild(stop1); grad.appendChild(stop2);
  defs.appendChild(grad);
  svg.appendChild(defs);
  svg.appendChild(circleBg);
  svg.appendChild(circleProgress);
  player.appendChild(svg);

  // --- Center content ---
  const center = document.createElement("div");
  center.className = "orbit-center";
  Object.assign(center.style, {
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    width: "100%",
    height: "100%",
    position: "relative"
  });

  // --- Title ---
  const titleEl = document.createElement("div");
  Object.assign(titleEl.style,{
    position:"absolute",
    top:"8px",
    left:"50%",
    transform:"translateX(-50%)",
    fontWeight:"600",
    lineHeight:"1.1",
    padding:"0 12px",
    maxWidth:"90%",
    color:"#e5e7eb",
    fontSize:"clamp(14px,2.4vw,16px)",
    textShadow:"0 1px 1px rgba(0,0,0,0.5)",
    pointerEvents:"none",
    textAlign:"center",
    zIndex:1000
  });
  center.appendChild(titleEl);

  // --- Marquee for now playing ---
  const marquee = document.createElement("div");
  Object.assign(marquee.style,{
    position:"absolute",
    bottom:"8px",
    left:"50%",
    width:"90%",
    transform:"translateX(-50%)",
    pointerEvents:"none",
    zIndex:10001
  });
  const fpNowPlaying = document.createElement("p");
  fpNowPlaying.id="fpNowPlaying";
  fpNowPlaying.className="mt-1 text-sm text-blue-600 dark:text-blue-400";
  marquee.appendChild(fpNowPlaying);
  center.appendChild(marquee);

  // Audio stays in the original persistent host; Orbit only controls that session.

  // --- Button helper ---
  const btn = (label,title,cb)=>{
    const b = document.createElement("button");
    b.textContent=label;
    b.title=title;
    Object.assign(b.style,{
      padding:"6px 10px",
      borderRadius:"9999px",
      border:"1px solid rgba(255,255,255,0.15)",
      background:"rgba(255,255,255,0.08)",
      color:"#fff",
      backdropFilter:"blur(4px)",
      boxShadow:"0 1px 4px rgba(0,0,0,0.25)",
      fontSize:"12px",
      cursor:"pointer",
      pointerEvents:"auto",
      userSelect:"none",
      touchAction:"manipulation",
      zIndex:5
    });
    b.addEventListener("pointerdown",e=>e.stopPropagation());
    b.addEventListener("click",cb);
    b.addEventListener("touchend",e=>{ e.preventDefault(); cb(e); });
    return b;
  };

  // --- State ---
  // --- Buttons ---
  const playPauseBtn = btn("▶","Play / Pause",()=>{
    void audioSession.toggle();
  });

  const nextBtn  = btn("⏭","Next",()=>{
    audioSession.next();
  });

  const langBtn  = btn("🌐","Language",()=>{
    audioSession.cycleLanguage();
  });

  const sleepBtn = btn("🌙","Auto-next (sleep) on/off",()=>{
    audioSession.setAutoNext(!audioSession.getState().autoNext);
  });
  sleepBtn.dataset.active="1";

  // --- NEW: Psalms Playlist Button ---
  const psalmsBtn = btn("🎵","Switch to Psalms Playlist",()=>{
    if(typeof psalmsPlaylist!=="undefined" && psalmsPlaylist.length>0){
      const tracks = normalize(psalmsPlaylist);
      const language = Object.keys(tracks[0]?.sources || {}).find(key => tracks[0].sources[key]);
      audioSession.setPlaylist(tracks, {language, autoplay:true});
    } else {
      audioSession.notice("No Psalms recording playlist is available.");
    }
  });

  // --- NEW: Playback Speed Button ---
  const speedBtn = btn("⏩","Toggle Playback Speed",()=>{
    audioSession.cycleRate();
  });

    const videoBtn = btn("🎬", "Open Video (popup)", () => { toggleOrbitVideo(); })
const shareBtn = btn("🔗","Share Track",()=>{
  const url = window.location.href;
  const title = document.title || "Now Playing";

  if (navigator.share) {
    navigator.share({
      title,
      text: "Check out this track:",
      url
    }).catch(err => console.warn("Share cancelled", err));
  } else {
    navigator.clipboard.writeText(url);
    alert("Link copied to clipboard!");
  }
});
    const favBtn = btn("⭐","Favorite",()=>{
  const track = audio?.src;
  if (!track) return alert("Nothing playing");

  let favs = JSON.parse(localStorage.getItem("favorites") || "[]");

  if (!favs.includes(track)) {
    favs.push(track);
    localStorage.setItem("favorites", JSON.stringify(favs));
    favBtn.textContent = "★";
    console.log("Favorited:", track);
  } else {
    alert("Already in favorites");
  }
}); 


  // --- Dock Button ---
const dockBtn = document.createElement("button");
dockBtn.textContent = "›";
dockBtn.title = "Park player at screen edge";
dockBtn.setAttribute("aria-label", "Park Orbit player");
Object.assign(dockBtn.style, {
      padding:"6px 10px",
      borderRadius:"9999px",
      border:"1px solid rgba(255,255,255,0.15)",
      background:"rgba(255,255,255,0.08)",
      color:"#fff",
      backdropFilter:"blur(4px)",
      boxShadow:"0 1px 4px rgba(0,0,0,0.25)",
      fontSize:"22px",
      lineHeight:"1",
      cursor:"pointer",
      pointerEvents:"auto",
      userSelect:"none",
      touchAction:"manipulation",
      zIndex:5
});
player.appendChild(dockBtn);

function updateDockArrow() {
  const viewport = window.visualViewport;
  const rect = player.getBoundingClientRect();
  const left = rect.left + rect.width/2 < (viewport?.offsetLeft || 0) + (viewport?.width || innerWidth)/2;
  dockBtn.textContent = left ? "‹" : "›";
}
dockBtn.addEventListener("pointerenter", updateDockArrow);
dockBtn.addEventListener("focus", updateDockArrow);
dockBtn.addEventListener("touchstart", updateDockArrow, {passive:true});

function placeOrbit() {
  if (player.hidden || !player.isConnected) return;
  const area = activityBounds(), rect = player.getBoundingClientRect();
  const marginX = Math.min(48, Math.max(0, (area.width - rect.width)/2));
  const marginY = Math.min(48, Math.max(0, (area.height - rect.height)/2));
  const x = Math.max(area.left + marginX, Math.min(rect.left, area.right - rect.width - marginX));
  const y = Math.max(area.top + marginY, Math.min(rect.top, area.bottom - rect.height - marginY));
  if (Math.abs(x-rect.left)>8 || Math.abs(y-rect.top)>8) {
    Object.assign(player.style,{left:x+"px",top:y+"px",right:"auto",bottom:"auto"});
  }
  updateDockArrow();
}
window.addEventListener('workspace:resize', placeOrbit);
player.__viewportCleanup = () => window.removeEventListener('workspace:resize',placeOrbit);

const parkingReady = import("./edge-docking.js").then(({ createEdgeParking }) => {
  if (!player.isConnected) return null;
  player.__edgeParking = createEdgeParking(player, {
    label: "Orbit player",
    onRestore() {
      placeOrbit();
      updateDockArrow();
      player.dispatchEvent(new Event("orbit:restored"));
    },
  });
  return player.__edgeParking;
}).catch(() => {
  dockBtn.disabled = true;
  dockBtn.title = "Player parking is unavailable. Reload to try again.";
  return null;
});
dockBtn.addEventListener("click", () => { parkingReady.then(parking => parking?.park()); });


  // --- Controls container for orbit buttons ---
  const controls = document.createElement("div");
  Object.assign(controls.style,{
    position:"absolute",
    top:"0",
    left:"0",
    width:"100%",
    height:"100%",
    pointerEvents:"none",
    zIndex:4
  });

  const orbitButtons = [dockBtn,nextBtn,langBtn,sleepBtn,psalmsBtn,speedBtn,videoBtn,shareBtn,favBtn];
  orbitButtons.forEach(b=>{
    b.style.pointerEvents="auto";
    controls.appendChild(b);
  });
  center.appendChild(controls);

  // --- Circular placement ---
  const radius=70;
  orbitButtons.forEach((b,i)=>{
    const angle=(i/orbitButtons.length)*2*Math.PI;
    Object.assign(b.style,{
      position:"absolute",
      left:`${50 + radius*Math.cos(angle)}%`,
      top:`${50 + radius*Math.sin(angle)}%`,
      transform:"translate(-50%,-50%)"
    });
  });

  // --- Center Play/Pause on top ---
  Object.assign(playPauseBtn.style,{
    position:"absolute",
    left:"50%",
    top:"50%",
    transform:"translate(-50%,-50%)",
    zIndex:10001
  });
  center.appendChild(playPauseBtn);

  // --- Append to DOM ---
  player.appendChild(center);
  document.body.appendChild(player);
  updateDockArrow();

  // Preserve the saved player's explicit playlist hooks without owning playback.
  function normalize(list) {
    return (Array.isArray(list) ? list : []).map(item => ({
      title:item.label || item.title || "Recording",
      sources:{english:item.eng || item.src || "", hebrew:item.heb || "", greek:item.grk || ""},
    }));
  }

  titleEl.classList.add("orbit-track-title");
  fpNowPlaying.className = "orbit-audio-status";
  fpNowPlaying.setAttribute("role", "status");
  fpNowPlaying.setAttribute("aria-live", "polite");
  svg.setAttribute("role", "progressbar");
  svg.setAttribute("aria-label", "Recording progress");
  svg.setAttribute("aria-valuemin", "0");
  svg.setAttribute("aria-valuemax", "100");
  player.__audioUnsubscribe = audioSession.subscribe(state => {
    if (titleEl.textContent !== state.title) titleEl.textContent = state.title;
    titleEl.title = state.title;
    if (fpNowPlaying.textContent !== state.message) fpNowPlaying.textContent = state.message;
    playPauseBtn.textContent = state.playing ? "⏸" : "▶";
    playPauseBtn.setAttribute("aria-label", state.playing ? "Pause recording" : "Play recording");
    playPauseBtn.disabled = !state.source;
    nextBtn.disabled = !state.canNext;
    langBtn.disabled = state.availableLanguages.length < 2;
    langBtn.setAttribute("aria-label", "Recording language: " + state.language);
    speedBtn.disabled = !state.source;
    speedBtn.textContent = state.rate === 1 ? "⏩" : state.rate + "x";
    sleepBtn.style.opacity = state.autoNext ? "1" : "0.55";
    sleepBtn.dataset.active = state.autoNext ? "1" : "0";
    sleepBtn.setAttribute("aria-pressed", String(state.autoNext));
    const progress = state.duration ? Math.min(1, Math.max(0, state.currentTime/state.duration)) : 0;
    circleProgress.setAttribute("stroke-dashoffset", String(C*(1-progress)));
    svg.setAttribute("aria-valuenow", String(Math.round(progress*100)));
    player.dataset.audioStatus = state.status;
  });
  player.dataset.audioReady = "true";
  window.dispatchEvent(new Event("audio:controller-ready"));

  // --- Drag + snap ---
  let isDragging=false,startX,startY,origX,origY;
  function onPointerDown(e){ if(e.target.closest("button")) return; isDragging=true; const rect=player.getBoundingClientRect(); origX=rect.left; origY=rect.top; startX=e.type.startsWith("touch")?e.touches[0].clientX:e.clientX; startY=e.type.startsWith("touch")?e.touches[0].clientY:e.clientY; player.style.cursor="grabbing"; e.preventDefault(); }
  function onPointerMove(e){ if(!isDragging) return; const clientX=e.type.startsWith("touch")?e.touches[0].clientX:e.clientX; const clientY=e.type.startsWith("touch")?e.touches[0].clientY:e.clientY; player.style.left = origX+(clientX-startX)+"px"; player.style.top = origY+(clientY-startY)+"px"; player.style.right="auto"; player.style.bottom="auto"; }
  function onPointerUp(){ if(!isDragging) return; isDragging=false; player.style.cursor="grab"; snapToEdge(); updateDockArrow(); }
  function snapToEdge(){ const rect=player.getBoundingClientRect(); const vw=window.innerWidth,vh=window.innerHeight,margin=12; const distances=[rect.left,vw-rect.right,rect.top,vh-rect.bottom]; const min=Math.min(...distances); if(min===distances[1]){ player.style.left="auto"; player.style.right=margin+"px"; } else if(min===distances[0]){ player.style.left=margin+"px"; player.style.right="auto"; } else if(min===distances[2]){ player.style.top=margin+"px"; player.style.bottom="auto"; } else{ player.style.top="auto"; player.style.bottom=margin+"px"; } }

  player.addEventListener("mousedown",onPointerDown);
  player.addEventListener("touchstart",onPointerDown,{passive:false});
  window.addEventListener("mousemove",onPointerMove,{passive:true});
  window.addEventListener("touchmove",onPointerMove,{passive:false});
  window.addEventListener("mouseup",onPointerUp);
  window.addEventListener("touchend",onPointerUp);

  // --- External hooks ---
  window.addEventListener("player:updatePlaylist", e=>{ audioSession.setPlaylist(normalize(e.detail.playlist), {language:"english", autoplay:true}); });
  window.addEventListener("player:setLang", e=>{ const language={eng:"english",heb:"hebrew",grk:"greek"}[e.detail.lang?.toLowerCase()]; if(language) audioSession.setLanguage(language); });

  // --- Auto-load weekData ---
  if(window.weekData?.sections?.audio_playlist){ audioSession.setPlaylist(normalize(window.weekData.sections.audio_playlist), {language:"english"}); }
}

document.addEventListener("DOMContentLoaded", setupFloatingPlayer);

// 🌌 Floating Player Glow + Subtle Orbit Effect (waits until player exists)
function enhanceFloatingPlayer() {
  const fp = document.getElementById("floatingPlayer");
  if (!fp) {
    console.warn("⏳ Waiting for floating player...");
    setTimeout(enhanceFloatingPlayer, 500); // retry every half second
    return;
  }

  console.log("🌟 Floating player found — glow effect applied!");

  fp.style.boxShadow =
    "0 0 25px rgba(0, 200, 255, 0.6), 0 0 60px rgba(0, 180, 255, 0.3)";
  fp.style.transition = "transform 2s ease-in-out, box-shadow 1.5s ease-in-out";
  fp.style.animation = "fpOrbit 6s ease-in-out infinite";

  // inject keyframes only once
  if (!document.getElementById("fpGlowKeyframes")) {
    const style = document.createElement("style");
    style.id = "fpGlowKeyframes";
    style.textContent = `
      @keyframes fpOrbit {
        0% {
          transform: translate(0px, 0px) rotate(0deg);
          box-shadow: 0 0 20px rgba(0, 200, 255, 0.6), 0 0 40px rgba(0, 180, 255, 0.3);
        }
        50% {
          transform: translate(6px, -6px) rotate(3deg);
          box-shadow: 0 0 35px rgba(0, 255, 255, 0.9), 0 0 70px rgba(0, 200, 255, 0.4);
        }
        100% {
          transform: translate(0px, 0px) rotate(0deg);
          box-shadow: 0 0 20px rgba(0, 200, 255, 0.6), 0 0 40px rgba(0, 180, 255, 0.3);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// run it after everything else loads
window.addEventListener("load", enhanceFloatingPlayer);

// Monitor and add glow to any new orbit buttons
const applyOrbitGlow = () => {
  const orbitButtons = document.querySelectorAll(".orbit-button:not(.glow-applied)");

  orbitButtons.forEach(btn => {
    const wrapper = document.createElement("div");
    wrapper.className = "orbit-button-glow";

    btn.parentNode.insertBefore(wrapper, btn);
    wrapper.appendChild(btn);

    btn.classList.add("glow-applied"); // mark as processed
  });
};

// Run immediately
applyOrbitGlow();

// Repeat every 500ms to catch new buttons dynamically
//setInterval(applyOrbitGlow, 500);

}

function destroyFloatingPlayer() {
  // Removing a controller must never remove or stop the shared audio element.
  const player = document.getElementById("floatingPlayer");
  player?.__audioUnsubscribe?.();
  player?.__viewportCleanup?.();
  player?.__edgeParking?.destroy();
  player?.remove();
  window.dispatchEvent(new Event("audio:controller-ready"));

  if (glowInterval) clearInterval(glowInterval);
  if (orbitInterval) clearInterval(orbitInterval);
}

//registerResource("player", {
  //init: setupFloatingPlayer,
  //destroy: destroyFloatingPlayer
//})

