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
let notificationIcon;

// State management for the new chat UI
let chatState = {
    view: 'public', // 'public', 'dm-list', or 'pm-history'
    activeDM: null, // The user_id of the person we are chatting with
    unreadDMs: new Set() // A set of user_ids who have sent unread messages
};

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
    if (!main || !chat) return { canvasWidth: 800, canvasHeight: 600 };
    if (window.innerWidth <= 768) {
        return { canvasWidth: window.innerWidth, canvasHeight: window.innerHeight - chat.offsetHeight };
    } else {
        const chatWidth = chat.classList.contains('minimized') ? 45 : 300;
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
    if (!gameReady) return;
    let camX = constrain(player.x - width / 2, 0, worldWidth - width);
    let camY = constrain(player.y - height / 2, 0, worldHeight - height);
    const worldMouseX = mouseX + camX;
    const worldMouseY = mouseY + camY;
    for (const id in otherPlayers) {
        const other = otherPlayers[id];
        if (worldMouseX > other.x && worldMouseX < other.x + 64 && worldMouseY > other.y && worldMouseY < other.y + 64) {
            // Open DM view directly
            chatState.view = 'pm-history';
            chatState.activeDM = id;
            document.getElementById('chat-container').classList.remove('minimized');
            renderChatUI();
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
    player = { id: myId, x: spawn.x, y: spawn.y, speed: 3, name, avatar, direction: 'down' };
    const main = document.getElementById('main-container');
    document.getElementById('join-screen').style.display = 'none';
    if (window.innerWidth > 768) { main.style.width = '95vw'; main.style.height = '90vh'; }
    main.style.display = 'flex';
    windowResized(); gameReady = true; loop();
    minimapCanvas = document.getElementById('minimap-canvas');
    if (minimapCanvas) { minimapCanvas.width = minimapWidth; minimapCanvas.height = minimapHeight; minimapCtx = minimapCanvas.getContext('2d'); }
    subscribeToUpdates();
    fetchInitialMessages();
    renderChatUI();
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
    }
    const mySprite = avatarImages[player.avatar]?.[player.direction] || avatarImages[player.avatar]?.['down'];
    if (mySprite) { image(mySprite, player.x, player.y, 64, 64); fill(0); text(player.name, player.x + 32, player.y + 80); }
}

// --- 5. MINIMAP, WEBRTC, & REALTIME ---
function drawMinimap() {
    if (!minimapCtx) return;
    minimapCtx.fillStyle = 'rgba(200, 200, 200, 0.7)'; minimapCtx.fillRect(0, 0, minimapWidth, minimapHeight);
    minimapCtx.fillStyle = '#333'; walls.forEach(w => minimapCtx.fillRect(w.x * minimapScale, w.y * minimapScale, w.w * minimapScale, w.h * minimapScale));
    minimapCtx.fillStyle = 'red'; for (const id in otherPlayers) { const o = otherPlayers[id]; minimapCtx.beginPath(); minimapCtx.arc(o.x * minimapScale, o.y * minimapScale, 3, 0, 2 * Math.PI); minimapCtx.fill(); }
    minimapCtx.fillStyle = 'lime'; minimapCtx.beginPath(); minimapCtx.arc(player.x * minimapScale, player.y * minimapScale, 3, 0, 2 * Math.PI); minimapCtx.fill();
}

function subscribeToUpdates() {
    const presenceChannel = supabaseClient.channel('Presences');
    presenceChannel
        .on('broadcast', { event: 'webrtc-signal' }, ({ payload }) => { if (payload.targetId === myId) handleSignal(payload); })
        .on('postgres_changes', { event: '*', table: 'Presences' }, p => {
            if (p.new.user_id === myId) return;
            otherPlayers[p.new.user_id] = { ...otherPlayers[p.new.user_id], ...p.new, x: p.new.x_pos, y: p.new.y_pos };
        })
        .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            const userIds = Object.keys(state).map(key => state[key][0].user_id).filter(id => id !== myId);
            if (userIds.length > 0) {
                supabaseClient.from('Presences').select('*').in('user_id', userIds)
                    .then(({ data }) => {
                        if (data) {
                            const newPlayers = {};
                            data.forEach(p => { newPlayers[p.user_id] = { ...p, x: p.x_pos, y: p.y_pos }; });
                            Object.assign(otherPlayers, newPlayers);
                        }
                    });
            }
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
             newPresences.forEach(pres => {
                const { user_id, name, avatar } = pres;
                if (user_id === myId || !user_id) return;
                
                if (!otherPlayers[user_id]) {
                    supabaseClient.from('Presences').select('x_pos, y_pos, direction').eq('user_id', user_id).maybeSingle()
                        .then(({ data, error }) => {
                            if (error) { console.error('Error fetching new player data:', error); return; }
                            const initialData = data || {};
                            otherPlayers[user_id] = { user_id, name, avatar, x: initialData.x_pos || 0, y: initialData.y_pos || 0, direction: initialData.direction || 'down' };
                        });
                }
            });
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
            leftPresences.forEach(pres => {
                if (otherPlayers[pres.user_id]) {
                    closeConnection(pres.user_id);
                    delete otherPlayers[pres.user_id];
                }
            });
        })
        .subscribe(async (status) => { if (status === 'SUBSCRIBED') { await presenceChannel.track({ user_id: myId, name: player.name, avatar: player.avatar }); } });
    
    supabaseClient.channel('public-messages').on('postgres_changes', { event: 'INSERT', table: 'messages', filter: 'receiver_id=is.null' }, p => displayMessage(p.new, 'public-chat-history')).subscribe();
    supabaseClient.channel('private-messages').on('postgres_changes', { event: 'INSERT', table: 'messages', filter: `receiver_id=eq.${myId}` }, p => {
        if (chatState.view === 'pm-history' && p.new.sender_id === chatState.activeDM) {
            displayMessage(p.new, 'pm-history-content');
        } else {
            chatState.unreadDMs.add(p.new.sender_id);
            renderChatUI();
        }
    }).subscribe();
}
function handleProximityChecks() { Object.keys(otherPlayers).forEach(id => { const o = otherPlayers[id], d = dist(player.x, player.y, o.x, o.y); if (d < VIDEO_DISTANCE_THRESHOLD) { if (!peerConnections[id]) initiateCall(id); } else if (peerConnections[id]) closeConnection(id); }); }
function initiateCall(tId) { console.log(`Calling ${tId}`); peerConnections[tId] = createPeerConnection(tId); if (localStream) localStream.getTracks().forEach(t => peerConnections[tId].addTrack(t, localStream)); }
function createPeerConnection(tId) { const pc = new RTCPeerConnection(config); pc.onicecandidate = e => e.candidate && sendSignal({ targetId: tId, candidate: e.candidate }); pc.ontrack = e => { document.getElementById('remoteVideo').style.display = 'block'; document.getElementById('remoteVideo').srcObject = e.streams[0]; }; pc.onnegotiationneeded = async () => { try { await pc.setLocalDescription(await pc.createOffer()); sendSignal({ targetId: tId, sdp: pc.localDescription }); } catch (e) { console.error(e); } }; pc.onconnectionstatechange = () => { if (['disconnected', 'closed', 'failed'].includes(pc.connectionState)) closeConnection(tId); }; return pc; }
async function handleSignal({ fromId, sdp, candidate }) { let pc = peerConnections[fromId]; if (sdp) { if (!pc) { pc = createPeerConnection(fromId); peerConnections[fromId] = pc; if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream)); } await pc.setRemoteDescription(new RTCSessionDescription(sdp)); if (sdp.type === 'offer') { try { await pc.setLocalDescription(await pc.createAnswer()); sendSignal({ targetId: fromId, sdp: pc.localDescription }); } catch (e) { console.error(e); } } } else if (candidate && pc) await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
function sendSignal(data) { supabaseClient.channel('Presences').send({ type: 'broadcast', event: 'webrtc-signal', payload: { ...data, fromId: myId } }); }
function closeConnection(tId) { if (peerConnections[tId]) { peerConnections[tId].close(); delete peerConnections[tId]; const v = document.getElementById('remoteVideo'); v.style.display = 'none'; v.srcObject = null; } }

// --- 6. CHAT ---
async function renderChatUI() {
    const publicTab = document.getElementById('public-tab'), dmTab = document.getElementById('dm-tab');
    const publicHistory = document.getElementById('public-chat-history'), dmList = document.getElementById('dm-list'), pmHistory = document.getElementById('pm-history');
    const dmNotification = document.getElementById('dm-notification');

    publicTab.classList.toggle('active', chatState.view === 'public');
    dmTab.classList.toggle('active', chatState.view.startsWith('dm-') || chatState.view === 'pm-history');
    publicHistory.classList.toggle('hidden', chatState.view !== 'public');
    dmList.classList.toggle('hidden', chatState.view !== 'dm-list');
    pmHistory.classList.toggle('hidden', chatState.view !== 'pm-history');
    dmNotification.classList.toggle('hidden', chatState.unreadDMs.size === 0);

    if (chatState.view === 'dm-list') {
        dmList.innerHTML = '';
        Object.values(otherPlayers).sort((a,b) => a.name.localeCompare(b.name)).forEach(user => {
            const userEl = document.createElement('div');
            userEl.className = 'dm-user';
            userEl.innerText = user.name;
            userEl.onclick = () => { chatState.view = 'pm-history'; chatState.activeDM = user.user_id; renderChatUI(); };
            if (chatState.unreadDMs.has(user.user_id)) {
                const notifEl = document.createElement('span');
                notifEl.className = 'dm-user-notification';
                notifEl.innerText = '●';
                userEl.appendChild(notifEl);
            }
            dmList.appendChild(userEl);
        });
    } else if (chatState.view === 'pm-history') {
        const targetId = chatState.activeDM;
        const targetName = otherPlayers[targetId]?.name || 'User';
        chatState.unreadDMs.delete(targetId);
        document.getElementById('pm-title').innerText = `${targetName}`;
        const historyContent = document.getElementById('pm-history-content');
        historyContent.innerHTML = '';
        const { data } = await supabaseClient.from('messages').select('*').or(`and(sender_id.eq.${myId},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${myId})`).order('created_at');
        if (data) data.forEach(msg => displayMessage(msg, 'pm-history-content'));
    }
}

async function fetchInitialMessages() {
    const { data } = await supabaseClient.from('messages').select('*').is('receiver_id', null).order('created_at').limit(50);
    if (data) data.forEach(msg => displayMessage(msg, 'public-chat-history'));
}
function displayMessage(msg, historyId) {
    const history = document.getElementById(historyId);
    if (!history) return;
    const p = document.createElement('p');
    p.innerHTML = `<strong>${msg.name || 'User'}:</strong> ${msg.message}`;
    history.appendChild(p);
    history.scrollTop = history.scrollHeight;
}
async function sendMessage(text) {
    if (!text.trim()) return;
    let message;
    if (chatState.view === 'public') {
        message = { sender_id: myId, name: player.name, message: text };
    } else if (chatState.view === 'pm-history' && chatState.activeDM) {
        message = { sender_id: myId, receiver_id: chatState.activeDM, name: player.name, message: text };
        displayMessage(message, 'pm-history-content');
    } else { return; }
    supabaseClient.from('messages').insert(message).then(({error}) => { if(error) console.error(error) });
}

// --- 7. EVENT LISTENERS ---
window.addEventListener('DOMContentLoaded', () => {
    const safeAddListener = (id, event, handler) => {
        const element = document.getElementById(id);
        if (element) element.addEventListener(event, handler);
    };

    const joinBtn = document.getElementById('join-button'), nameInput = document.getElementById('name-input'), avatars = document.querySelectorAll('#avatar-selection img');
    if (joinBtn && nameInput && avatars.length) {
        let selAvatar = 'avatar1';
        avatars.forEach(img => img.addEventListener('click', () => { avatars.forEach(a => a.classList.remove('selected')); img.classList.add('selected'); selAvatar = img.dataset.avatar; }));
        joinBtn.addEventListener('click', () => { const name = nameInput.value.trim(); if (name) joinGame(name, selAvatar); });
    }

    safeAddListener('chat-input', 'keydown', e => { if (e.key === 'Enter') { sendMessage(e.target.value); e.target.value = ''; } });
    safeAddListener('public-tab', 'click', () => { chatState.view = 'public'; renderChatUI(); });
    safeAddListener('dm-tab', 'click', () => { chatState.view = 'dm-list'; renderChatUI(); });
    safeAddListener('pm-back-btn', 'click', () => { chatState.view = 'dm-list'; chatState.activeDM = null; renderChatUI(); });

    const chatContainer = document.getElementById('chat-container'), chatToggleBtn = document.getElementById('chat-toggle-btn');
    if (chatContainer && chatToggleBtn) {
        chatToggleBtn.innerHTML = '💬'; 
        chatToggleBtn.addEventListener('click', () => { chatContainer.classList.toggle('minimized'); chatToggleBtn.innerHTML = chatContainer.classList.contains('minimized') ? '💬' : '▼'; setTimeout(windowResized, 300); });
    }
    
    const handleTouchEvent = (id, direction) => {
        const btn = document.getElementById(id);
        if (btn) { ['touchstart', 'mousedown'].forEach(e => btn.addEventListener(e, ev => { ev.preventDefault(); touchControls[direction] = true; })); ['touchend', 'mouseup', 'mouseleave'].forEach(e => btn.addEventListener(e, ev => { ev.preventDefault(); touchControls[direction] = false; })); }
    };
    handleTouchEvent('dpad-up', 'up'); handleTouchEvent('dpad-down', 'down'); handleTouchEvent('dpad-left', 'left'); handleTouchEvent('dpad-right', 'right');
    
    const vidToggle = document.getElementById('video-toggle'), micToggle = document.getElementById('mic-toggle');
    if (vidToggle) vidToggle.addEventListener('click', () => { if (localStream) { const track = localStream.getVideoTracks()[0]; if (track) { track.enabled = !track.enabled; vidToggle.innerText = track.enabled ? 'Cam On' : 'Cam Off'; vidToggle.style.backgroundColor = track.enabled ? '#4CAF50' : '#f44336'; } } });
    if (micToggle) micToggle.addEventListener('click', () => { if (localStream) { const track = localStream.getAudioTracks()[0]; if (track) { track.enabled = !track.enabled; micToggle.innerText = track.enabled ? 'Mic On' : 'Mic Off'; micToggle.style.backgroundColor = track.enabled ? '#4CAF50' : '#f44336'; } } });
});
