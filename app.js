// --- 1. CONNECT TO SUPERBASE ---
const SUPABASE_URL = 'https://cfuzvmmlvajbhilmegvc.supabase.co'; // URL from supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmdXp2bW1sdmFqYmhpbG1lZ3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDYzOTcsImV4cCI6MjA3NDc4MjM5N30.3J2oz6sOPo4eei7KspSk5mB-rIWTu1aL3HaBG57CbnQ'; // Anon Key
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// --- 2. GLOBAL VARIABLES ---
const myId = crypto.randomUUID();
const otherPlayers = {};
let player = {};
let avatarImages = { avatar1: {}, avatar2: {}, avatar3: {} };
let gameReady = false;
let touchControls = { up: false, down: false, left: false, right: false };
let wasMoving = false;
const worldWidth = 1600, worldHeight = 1200;
const walls = [
  { x: 0, y: 0, w: worldWidth, h: 10 }, { x: 0, y: worldHeight - 10, w: worldWidth, h: 10 },
  { x: 0, y: 0, w: 10, h: worldHeight }, { x: worldWidth - 10, y: 0, w: 10, h: worldHeight },
  { x: 100, y: 500, w: 150, h: 10 }, { x: 350, y: 500, w: 300, h: 10 }, { x: 750, y: 500, w: 400, h: 10 }, { x: 1250, y: 500, w: 250, h: 10 },
  { x: 100, y: 700, w: 150, h: 10 }, { x: 350, y: 700, w: 800, h: 10 }, { x: 1250, y: 700, w: 250, h: 10 },
  { x: 100, y: 100, w: 1400, h: 10 }, { x: 500, y: 100, w: 10, h: 400 },
  { x: 1100, y: 100, w: 10, h: 400 }, { x: 100, y: 100, w: 10, h: 400 },
  { x: 1500, y: 100, w: 10, h: 410 },
  { x: 100, y: 1100, w: 1400, h: 10 }, { x: 800, y: 700, w: 10, h: 400 },
  { x: 100, y: 710, w: 10, h: 390 }, { x: 1500, y: 710, w: 10, h: 390 },
];
const spawnPoints = [ { x: 200, y: 600 }, { x: 800, y: 600 }, { x: 1400, y: 600 }, { x: 300, y: 300 }, { x: 950, y: 900 } ];
let localStream, peerConnections = {}, config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const VIDEO_DISTANCE_THRESHOLD = 250;
let minimapCanvas, minimapCtx, minimapScale = 0.1, minimapWidth = worldWidth * minimapScale, minimapHeight = worldHeight * minimapScale;
// Private Message State
let privateChatTarget = null;
let notificationIcon;

// --- 3. p5.js ---
function preload() {
    const directions = ['down', 'up', 'left', 'right', 'down_left', 'down_right', 'up_left', 'up_right'];
    for (let i = 1; i <= 3; i++) {
        directions.forEach(dir => avatarImages[`avatar${i}`][dir] = loadImage(`avatar${i}_${dir}.png`));
    }
    notificationIcon = loadImage('chat_notification.png');
}
function getCanvasDimensions() {
    const main = document.getElementById('main-container'), chat = document.getElementById('chat-container');
    if (window.innerWidth <= 768) {
        return { canvasWidth: window.innerWidth, canvasHeight: window.innerHeight * 0.7 };
    } else {
        const chatWidth = chat.classList.contains('minimized') ? 0 : chat.offsetWidth;
        return { canvasWidth: main.offsetWidth - chatWidth, canvasHeight: main.offsetHeight };
    }
}
function setup() {
    const { canvasWidth, canvasHeight } = getCanvasDimensions();
    const canvas = createCanvas(canvasWidth, canvasHeight);
    canvas.parent('main-container');
    noLoop(); textAlign(CENTER); textSize(14);
}
function windowResized() {
    const { canvasWidth, canvasHeight } = getCanvasDimensions();
    resizeCanvas(canvasWidth, canvasHeight);
}
function draw() {
    if (!gameReady) return;
    background('#d1e8f9');
    let camX = constrain(player.x - width / 2, 0, worldWidth - width);
    let camY = constrain(player.y - height / 2, 0, worldHeight - height);
    translate(-camX, -camY);
    fill(100); noStroke();
    walls.forEach(w => rect(w.x, w.y, w.w, w.h));
    handleMovement();
    drawPlayers();
    handleProximityChecks();
    drawMinimap();
}
function mousePressed() {
    if (!gameReady || privateChatTarget) return;
    let camX = constrain(player.x - width / 2, 0, worldWidth - width);
    let camY = constrain(player.y - height / 2, 0, worldHeight - height);
    const worldMouseX = mouseX + camX;
    const worldMouseY = mouseY + camY;
    for (const id in otherPlayers) {
        const other = otherPlayers[id];
        if (worldMouseX > other.x && worldMouseX < other.x + 64 && worldMouseY > other.y && worldMouseY < other.y + 64) {
            openPrivateChat(id, other.name);
            break;
        }
    }
}

// --- 4. GAME LOGIC ---
async function joinGame(name, avatar) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('localVideo').srcObject = localStream;
    } catch (e) { console.error("Media device error.", e); }
    const spawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    player = { x: spawn.x, y: spawn.y, speed: 3, name, avatar, direction: 'down' };
    const main = document.getElementById('main-container');
    document.getElementById('join-screen').style.display = 'none';
    if (window.innerWidth > 768) { main.style.width = '95vw'; main.style.height = '90vh'; }
    main.style.display = 'flex';
    windowResized(); gameReady = true; loop();
    minimapCanvas = document.getElementById('minimap-canvas');
    if (minimapCanvas) { minimapCanvas.width = minimapWidth; minimapCanvas.height = minimapHeight; minimapCtx = minimapCanvas.getContext('2d'); }
    subscribeToUpdates();
    fetchInitialMessages();
    // Start a recurring check to remove inactive players
    setInterval(cleanupInactivePlayers, 5000); // Run every 5 seconds
}
function checkCollision(r1, r2) { return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y; }
function handleMovement() {
    const SPRITE_W = 64, HITBOX_W = 32, X_OFFSET = (SPRITE_W - HITBOX_W) / 2, Y_OFFSET = 16;
    let dx = 0, dy = 0;
    if (keyIsDown(LEFT_ARROW) || touchControls.left) dx = -1; if (keyIsDown(RIGHT_ARROW) || touchControls.right) dx = 1;
    if (keyIsDown(UP_ARROW) || touchControls.up) dy = -1; if (keyIsDown(DOWN_ARROW) || touchControls.down) dy = 1;
    const isMoving = dx !== 0 || dy !== 0;
    if (isMoving) {
        const hitbox = { x: player.x + X_OFFSET, y: player.y + Y_OFFSET, w: HITBOX_W, h: 48 };
        if (!walls.some(w => checkCollision({ ...hitbox, x: hitbox.x + dx * player.speed }, w))) player.x += dx * player.speed;
        hitbox.x = player.x + X_OFFSET;
        if (!walls.some(w => checkCollision({ ...hitbox, y: hitbox.y + dy * player.speed }, w))) player.y += dy * player.speed;
        let dir = player.direction;
        if (dy === -1) dir = 'up'; if (dy === 1) dir = 'down'; if (dx === -1) dir = 'left'; if (dx === 1) dir = 'right';
        if (dy === -1 && dx === -1) dir = 'up_left'; if (dy === -1 && dx === 1) dir = 'up_right';
        if (dy === 1 && dx === -1) dir = 'down_left'; if (dy === 1 && dx === 1) dir = 'down_right';
        player.direction = dir;
    }
    player.x = constrain(player.x, 0, worldWidth - 64); player.y = constrain(player.y, 0, worldHeight - 64);
    if (isMoving || wasMoving) {
        supabaseClient.from('Presences').upsert({ user_id: myId, x_pos: Math.round(player.x), y_pos: Math.round(player.y), name: player.name, avatar: player.avatar, direction: player.direction, last_seen: new Date().toISOString() }).then(({error}) => { if(error) console.error(error) });
    }
    wasMoving = isMoving;
}
function drawPlayers() {
    for (const id in otherPlayers) {
        const other = otherPlayers[id];
        const sprite = avatarImages[other.avatar]?.[other.direction] || avatarImages[other.avatar]?.['down'];
        if (sprite) { image(sprite, other.x, other.y, 64, 64); fill(0); text(other.name, other.x + 32, other.y + 80); }
        if (other.hasNewMessage) { image(notificationIcon, other.x + 40, other.y - 10, 24, 24); }
    }
    const mySprite = avatarImages[player.avatar]?.[player.direction] || avatarImages[player.avatar]?.['down'];
    if (mySprite) { image(mySprite, player.x, player.y, 64, 64); fill(0); text(player.name, player.x + 32, player.y + 80); }
}

// --- 5. MINIMAP, WEBRTC, & REALTIME ---
// NEW: Function to clean up inactive players
function cleanupInactivePlayers() {
    const now = new Date();
    for (const id in otherPlayers) {
        const other = otherPlayers[id];
        if (other.last_seen) {
            const lastSeenDate = new Date(other.last_seen);
            const secondsSinceSeen = (now - lastSeenDate) / 1000;
            if (secondsSinceSeen > 30) {
                console.log(`Removing inactive player: ${other.name}`);
                closeConnection(id); // End any active video call
                delete otherPlayers[id];
            }
        }
    }
}
function drawMinimap() {
    if (!minimapCtx) return;
    minimapCtx.fillStyle = 'rgba(200, 200, 200, 0.7)'; minimapCtx.fillRect(0, 0, minimapWidth, minimapHeight);
    minimapCtx.fillStyle = '#333'; walls.forEach(w => minimapCtx.fillRect(w.x * minimapScale, w.y * minimapScale, w.w * minimapScale, w.h * minimapScale));
    minimapCtx.fillStyle = 'red'; for (const id in otherPlayers) { const o = otherPlayers[id]; minimapCtx.beginPath(); minimapCtx.arc(o.x * minimapScale, o.y * minimapScale, 3, 0, 2 * Math.PI); minimapCtx.fill(); }
    minimapCtx.fillStyle = 'lime'; minimapCtx.beginPath(); minimapCtx.arc(player.x * minimapScale, player.y * minimapScale, 3, 0, 2 * Math.PI); minimapCtx.fill();
}
function subscribeToUpdates() {
    supabaseClient.channel('Presences').on('broadcast', { event: 'webrtc-signal' }, ({ payload }) => { if (payload.targetId === myId) handleSignal(payload); }).on('postgres_changes', { event: '*', table: 'Presences' }, p => {
        if (p.new.user_id === myId) return;
        // Keep track of the last_seen timestamp
        otherPlayers[p.new.user_id] = { ...otherPlayers[p.new.user_id], x: p.new.x_pos, y: p.new.y_pos, name: p.new.name, avatar: p.new.avatar, direction: p.new.direction, last_seen: p.new.last_seen };
    }).subscribe();
    supabaseClient.channel('public-messages').on('postgres_changes', { event: 'INSERT', table: 'messages', filter: 'receiver_id=is.null' }, p => displayMessage(p.new, 'chat-history')).subscribe();
    supabaseClient.channel('private-messages').on('postgres_changes', { event: 'INSERT', table: 'messages', filter: `receiver_id=eq.${myId}` }, p => {
        if (privateChatTarget && p.new.sender_id === privateChatTarget) { displayMessage(p.new, 'pm-history'); } 
        else if (otherPlayers[p.new.sender_id]) { otherPlayers[p.new.sender_id].hasNewMessage = true; }
    }).subscribe();
}
function handleProximityChecks() { Object.keys(otherPlayers).forEach(id => { const o = otherPlayers[id], d = dist(player.x, player.y, o.x, o.y); if (d < VIDEO_DISTANCE_THRESHOLD) { if (!peerConnections[id]) initiateCall(id); } else if (peerConnections[id]) closeConnection(id); }); }
function initiateCall(tId) { console.log(`Calling ${tId}`); peerConnections[tId] = createPeerConnection(tId); if (localStream) localStream.getTracks().forEach(t => peerConnections[tId].addTrack(t, localStream)); }
function createPeerConnection(tId) { const pc = new RTCPeerConnection(config); pc.onicecandidate = e => e.candidate && sendSignal({ targetId: tId, candidate: e.candidate }); pc.ontrack = e => { document.getElementById('remoteVideo').style.display = 'block'; document.getElementById('remoteVideo').srcObject = e.streams[0]; }; pc.onnegotiationneeded = async () => { try { await pc.setLocalDescription(await pc.createOffer()); sendSignal({ targetId: tId, sdp: pc.localDescription }); } catch (e) { console.error(e); } }; pc.onconnectionstatechange = () => { if (['disconnected', 'closed', 'failed'].includes(pc.connectionState)) closeConnection(tId); }; return pc; }
async function handleSignal({ fromId, sdp, candidate }) { let pc = peerConnections[fromId]; if (sdp) { if (!pc) { pc = createPeerConnection(fromId); peerConnections[fromId] = pc; if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream)); } await pc.setRemoteDescription(new RTCSessionDescription(sdp)); if (sdp.type === 'offer') { try { await pc.setLocalDescription(await pc.createAnswer()); sendSignal({ targetId: fromId, sdp: pc.localDescription }); } catch (e) { console.error(e); } } } else if (candidate && pc) await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
function sendSignal(data) { supabaseClient.channel('Presences').send({ type: 'broadcast', event: 'webrtc-signal', payload: { ...data, fromId: myId } }); }
function closeConnection(tId) { if (peerConnections[tId]) { peerConnections[tId].close(); delete peerConnections[tId]; const v = document.getElementById('remoteVideo'); v.style.display = 'none'; v.srcObject = null; } }

// --- 6. CHAT ---
async function fetchInitialMessages() { const { data } = await supabaseClient.from('messages').select('*').is('receiver_id', null).order('created_at').limit(50); if (data) data.forEach(msg => displayMessage(msg, 'chat-history')); }
function displayMessage(msg, historyId) {
    const history = document.getElementById(historyId);
    const p = document.createElement('p');
    p.innerHTML = `<strong>${msg.name || msg.sender_id}:</strong> ${msg.message}`;
    history.appendChild(p); history.scrollTop = history.scrollHeight;
}
async function sendMessage(text) {
    if (!text.trim()) return;
    supabaseClient.from('messages').insert({ sender_id: myId, name: player.name, message: text }).then(({error}) => { if(error) console.error(error) });
}
async function openPrivateChat(targetId, targetName) {
    privateChatTarget = targetId;
    if (otherPlayers[targetId]) otherPlayers[targetId].hasNewMessage = false;
    const modal = document.getElementById('pm-modal'), history = document.getElementById('pm-history');
    document.getElementById('pm-title').innerText = `Chat with ${targetName}`;
    history.innerHTML = '';
    const { data } = await supabaseClient.from('messages').select('*').or(`(sender_id.eq.${myId},receiver_id.eq.${targetId}),(sender_id.eq.${targetId},receiver_id.eq.${myId})`).order('created_at');
    if (data) data.forEach(msg => displayMessage(msg, 'pm-history'));
    modal.style.display = 'flex';
}
function closePrivateChat() {
    document.getElementById('pm-modal').style.display = 'none';
    privateChatTarget = null;
}
async function sendPrivateMessage(text) {
    if (!text.trim() || !privateChatTarget) return;
    const msg = { sender_id: myId, receiver_id: privateChatTarget, name: player.name, message: text };
    displayMessage(msg, 'pm-history');
    supabaseClient.from('messages').insert(msg).then(({error}) => { if(error) console.error(error) });
}

// --- 7. EVENT LISTENERS ---
window.addEventListener('DOMContentLoaded', () => {
    const joinBtn = document.getElementById('join-button'), nameInput = document.getElementById('name-input'), avatars = document.querySelectorAll('#avatar-selection img');
    let selAvatar = 'avatar1';
    avatars.forEach(img => img.addEventListener('click', () => { avatars.forEach(a => a.classList.remove('selected')); img.classList.add('selected'); selAvatar = img.dataset.avatar; }));
    joinBtn.addEventListener('click', () => { const name = nameInput.value.trim(); if (name) joinGame(name, selAvatar); });
    document.getElementById('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') { sendMessage(e.target.value); e.target.value = ''; } });
    const chatContainer = document.getElementById('chat-container'), chatToggleBtn = document.getElementById('chat-toggle-btn');
    chatToggleBtn.innerHTML = '💬'; 
    chatToggleBtn.addEventListener('click', () => {
        chatContainer.classList.toggle('minimized');
        chatToggleBtn.innerHTML = chatContainer.classList.contains('minimized') ? '💬' : '▼';
        setTimeout(windowResized, 300); // Recalculate canvas size after transition
    });
    document.getElementById('pm-close-btn').addEventListener('click', closePrivateChat);
    document.getElementById('pm-input').addEventListener('keydown', e => { if (e.key === 'Enter') { sendPrivateMessage(e.target.value); e.target.value = ''; } });

    const handleTouchEvent = (btn, dir) => { ['touchstart', 'mousedown'].forEach(e => btn.addEventListener(e, ev => { ev.preventDefault(); touchControls[dir] = true; })); ['touchend', 'mouseup', 'mouseleave'].forEach(e => btn.addEventListener(e, ev => { ev.preventDefault(); touchControls[dir] = false; })); };
    handleTouchEvent(document.getElementById('dpad-up'), 'up'); handleTouchEvent(document.getElementById('dpad-down'), 'down'); handleTouchEvent(document.getElementById('dpad-left'), 'left'); handleTouchEvent(document.getElementById('dpad-right'), 'right');
    const vidToggle = document.getElementById('video-toggle'), micToggle = document.getElementById('mic-toggle');
    vidToggle.addEventListener('click', () => { if (localStream) { const track = localStream.getVideoTracks()[0]; if (track) { track.enabled = !track.enabled; vidToggle.innerText = track.enabled ? 'Cam On' : 'Cam Off'; vidToggle.style.backgroundColor = track.enabled ? '#4CAF50' : '#f44336'; } } });
    micToggle.addEventListener('click', () => { if (localStream) { const track = localStream.getAudioTracks()[0]; if (track) { track.enabled = !track.enabled; micToggle.innerText = track.enabled ? 'Mic On' : 'Mic Off'; micToggle.style.backgroundColor = track.enabled ? '#4CAF50' : '#f44336'; } } });
});
