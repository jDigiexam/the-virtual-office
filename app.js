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

const worldWidth = 1600;
const worldHeight = 1200;

const walls = [
  // Outer Boundary
  { x: 0, y: 0, w: worldWidth, h: 10 }, { x: 0, y: worldHeight - 10, w: worldWidth, h: 10 },
  { x: 0, y: 0, w: 10, h: worldHeight }, { x: worldWidth - 10, y: 0, w: 10, h: worldHeight },
  // Central Corridor
  { x: 100, y: 500, w: 150, h: 10 }, { x: 350, y: 500, w: 300, h: 10 },
  { x: 750, y: 500, w: 400, h: 10 }, { x: 1250, y: 500, w: 250, h: 10 },
  { x: 100, y: 700, w: 150, h: 10 }, { x: 350, y: 700, w: 800, h: 10 },
  { x: 1250, y: 700, w: 250, h: 10 },
  // Top Rooms
  { x: 100, y: 100, w: 1400, h: 10 }, { x: 500, y: 100, w: 10, h: 400 },
  { x: 1100, y: 100, w: 10, h: 400 }, { x: 100, y: 100, w: 10, h: 400 },
  { x: 1500, y: 100, w: 10, h: 410 },
  // Bottom Rooms
  { x: 100, y: 1100, w: 1400, h: 10 }, { x: 800, y: 700, w: 10, h: 400 },
  { x: 100, y: 710, w: 10, h: 390 }, { x: 1500, y: 710, w: 10, h: 390 },
];

const spawnPoints = [
  { x: 200, y: 600 }, { x: 800, y: 600 }, { x: 1400, y: 600 },
  { x: 300, y: 300 }, { x: 950, y: 900 },
];

// WebRTC VARIABLES
let localStream;
const peerConnections = {};
const VIDEO_DISTANCE_THRESHOLD = 200;
const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// --- 3. p5.js PRELOAD, SETUP, AND DRAW ---
function preload() {
    const directions = ['down', 'up', 'left', 'right', 'down_left', 'down_right', 'up_left', 'up_right'];
    for (let i = 1; i <= 3; i++) {
        directions.forEach(dir => {
            const path = `avatar${i}_${dir}.png`;
            avatarImages[`avatar${i}`][dir] = loadImage(path);
        });
    }
}

function setup() {
    let canvasWidth = 800;
    let canvasHeight = 600;
    if (window.innerWidth <= 768) {
        canvasWidth = window.innerWidth;
        canvasHeight = window.innerHeight * 0.6;
    }
    const canvas = createCanvas(canvasWidth, canvasHeight);
    canvas.parent('main-container');
    noLoop();
    textAlign(CENTER);
    textSize(14);
}

function draw() {
    if (!gameReady) return;
    background('#d1e8f9');

    // Camera Logic
    let cameraX = player.x - width / 2;
    let cameraY = player.y - height / 2;
    cameraX = constrain(cameraX, 0, worldWidth - width);
    cameraY = constrain(cameraY, 0, worldHeight - height);
    translate(-cameraX, -cameraY);

    // Draw World
    fill(100);
    noStroke();
    walls.forEach(wall => rect(wall.x, wall.y, wall.w, wall.h));
    
    handleMovement();
    drawPlayers();
    handleProximityChecks();
}

// --- 4. GAME LOGIC ---
async function joinGame(name, avatar) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('localVideo').srcObject = localStream;
    } catch (error) {
        console.error("Error accessing media devices.", error);
        alert("Camera/Mic permission is required for video chat.");
    }
    
    const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    player = {
        x: spawnPoint.x, y: spawnPoint.y, speed: 3, name: name,
        avatar: avatar, direction: 'down'
    };

    document.getElementById('join-screen').style.display = 'none';
    document.getElementById('main-container').style.display = 'flex';
    gameReady = true;
    loop();
    subscribeToUpdates();
    fetchInitialMessages();
}

function checkCollision(rect1, rect2) {
    return (rect1.x < rect2.x + rect2.w && rect1.x + rect1.w > rect2.x && rect1.y < rect2.y + rect2.h && rect1.y + rect1.h > rect2.y);
}

function handleMovement() {
    const SPRITE_W = 64; const SPRITE_H = 64; const HITBOX_W = 32; const HITBOX_H = 48;
    const X_OFFSET = (SPRITE_W - HITBOX_W) / 2; const Y_OFFSET = SPRITE_H - HITBOX_H;
    let dx = 0; let dy = 0;

    if (keyIsDown(LEFT_ARROW) || touchControls.left) dx -= 1;
    if (keyIsDown(RIGHT_ARROW) || touchControls.right) dx += 1;
    if (keyIsDown(UP_ARROW) || touchControls.up) dy -= 1;
    if (keyIsDown(DOWN_ARROW) || touchControls.down) dy += 1;

    const isMoving = dx !== 0 || dy !== 0;

    if (isMoving) {
        const playerHitbox = { x: player.x + X_OFFSET, y: player.y + Y_OFFSET, w: HITBOX_W, h: HITBOX_H };
        let nextXHitbox = { ...playerHitbox, x: playerHitbox.x + dx * player.speed };
        if (!walls.some(wall => checkCollision(nextXHitbox, wall))) {
            player.x += dx * player.speed;
        }
        playerHitbox.x = player.x + X_OFFSET;
        let nextYHitbox = { ...playerHitbox, y: playerHitbox.y + dy * player.speed };
        if (!walls.some(wall => checkCollision(nextYHitbox, wall))) {
            player.y += dy * player.speed;
        }
        let newDirection = player.direction;
        if (dy === -1) newDirection = 'up'; if (dy === 1) newDirection = 'down'; if (dx === -1) newDirection = 'left'; if (dx === 1) newDirection = 'right';
        if (dy === -1 && dx === -1) newDirection = 'up_left'; if (dy === -1 && dx === 1) newDirection = 'up_right';
        if (dy === 1 && dx === -1) newDirection = 'down_left'; if (dy === 1 && dx === 1) newDirection = 'down_right';
        player.direction = newDirection;
    }

    player.x = constrain(player.x, 0, worldWidth - SPRITE_W);
    player.y = constrain(player.y, 0, worldHeight - SPRITE_H);

    if (isMoving || wasMoving) {
        supabaseClient.from('Presences').upsert({
            user_id: myId, x_pos: Math.round(player.x), y_pos: Math.round(player.y),
            name: player.name, avatar: player.avatar, direction: player.direction,
            last_seen: new Date().toISOString()
        }).then(response => { if (response.error) console.error(response.error); });
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

// --- 5. REALTIME AND WEBRTC ---
function subscribeToUpdates() {
    const presenceChannel = supabaseClient.channel('Presences', { config: { broadcast: { self: false } } });

    presenceChannel.on('broadcast', { event: 'webrtc-signal' }, ({ payload }) => {
        if (payload.targetId === myId) handleSignal(payload);
    });

    presenceChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'Presences' }, payload => {
        const p = payload.new;
        if (p.user_id !== myId) otherPlayers[p.user_id] = { x: p.x_pos, y: p.y_pos, name: p.name, avatar: p.avatar, direction: p.direction };
    }).subscribe();

    supabaseClient.channel('messages').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        displayMessage(payload.new);
    }).subscribe();
}

function handleProximityChecks() {
    for (const id in otherPlayers) {
        const other = otherPlayers[id];
        if (!other.x || !other.y) continue;
        const distance = dist(player.x, player.y, other.x, other.y);
        if (distance < VIDEO_DISTANCE_THRESHOLD && !peerConnections[id]) {
            initiateCall(id);
        } else if (distance >= VIDEO_DISTANCE_THRESHOLD && peerConnections[id]) {
            closeConnection(id);
        }
    }
}

function initiateCall(targetId) {
    console.log(`Initiating call with ${targetId}`);
    peerConnections[targetId] = createPeerConnection(targetId);
    if (localStream) {
        localStream.getTracks().forEach(track => peerConnections[targetId].addTrack(track, localStream));
    }
}

function createPeerConnection(targetId) {
    const pc = new RTCPeerConnection(config);
    pc.onicecandidate = e => e.candidate && sendSignal({ targetId, candidate: e.candidate });
    pc.ontrack = e => {
        document.getElementById('remoteVideo').style.display = 'block';
        document.getElementById('remoteVideo').srcObject = e.streams[0];
    };
    pc.onnegotiationneeded = async () => {
        try {
            await pc.setLocalDescription(await pc.createOffer());
            sendSignal({ targetId, sdp: pc.localDescription });
        } catch (err) { console.error(err); }
    };
    pc.onconnectionstatechange = () => {
        if (['disconnected', 'closed', 'failed'].includes(pc.connectionState)) closeConnection(targetId);
    };
    return pc;
}

async function handleSignal(signal) {
    const fromId = signal.fromId;
    let pc = peerConnections[fromId];
    if (signal.sdp) {
        if (!pc) {
            peerConnections[fromId] = createPeerConnection(fromId);
            pc = peerConnections[fromId];
            if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        }
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === 'offer') {
            try {
                await pc.setLocalDescription(await pc.createAnswer());
                sendSignal({ targetId: fromId, sdp: pc.localDescription });
            } catch (err) { console.error(err); }
        }
    } else if (signal.candidate && pc) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
}

function sendSignal(data) {
    supabaseClient.channel('Presences').send({
        type: 'broadcast', event: 'webrtc-signal',
        payload: { ...data, fromId: myId },
    });
}

function closeConnection(targetId) {
    console.log(`Closing connection with ${targetId}`);
    if (peerConnections[targetId]) {
        peerConnections[targetId].close();
        delete peerConnections[targetId];
        const remoteVideo = document.getElementById('remoteVideo');
        remoteVideo.style.display = 'none';
        remoteVideo.srcObject = null;
    }
}

// --- 6. CHAT AND UI ---
async function fetchInitialMessages() {
    const { data, error } = await supabaseClient.from('messages').select('*').order('created_at', { ascending: true }).limit(50);
    if (error) console.error('Error fetching messages:', error); else data.forEach(displayMessage);
}

function displayMessage(message) {
    const chatHistory = document.getElementById('chat-history');
    const msgElement = document.createElement('p');
    msgElement.innerHTML = `<strong>${message.name}:</strong> ${message.message}`;
    chatHistory.appendChild(msgElement);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function sendMessage(messageText) {
    if (!messageText.trim()) return;
    const { error } = await supabaseClient.from('messages').insert({ name: player.name, message: messageText });
    if (error) console.error('Error sending message:', error);
}

window.addEventListener('DOMContentLoaded', () => {
    const joinButton = document.getElementById('join-button');
    const nameInput = document.getElementById('name-input');
    const avatars = document.querySelectorAll('#avatar-selection img');
    let selectedAvatar = 'avatar1';
    avatars.forEach(img => { img.addEventListener('click', () => { avatars.forEach(a => a.classList.remove('selected')); img.classList.add('selected'); selectedAvatar = img.dataset.avatar; }); });
    joinButton.addEventListener('click', () => { const name = nameInput.value.trim(); if (name) joinGame(name, selectedAvatar); else alert('Please enter your name.'); });
    const chatInput = document.getElementById('chat-input');
    chatInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { sendMessage(chatInput.value); chatInput.value = ''; } });
    
    const dpadUp = document.getElementById('dpad-up');
    const dpadDown = document.getElementById('dpad-down');
    const dpadLeft = document.getElementById('dpad-left');
    const dpadRight = document.getElementById('dpad-right');
    const handleTouchEvent = (button, direction) => {
        button.addEventListener('touchstart', (e) => { e.preventDefault(); touchControls[direction] = true; }, { passive: false });
        button.addEventListener('touchend', (e) => { e.preventDefault(); touchControls[direction] = false; });
        button.addEventListener('mousedown', (e) => { e.preventDefault(); touchControls[direction] = true; });
        button.addEventListener('mouseup', (e) => { e.preventDefault(); touchControls[direction] = false; });
        button.addEventListener('mouseleave', (e) => { touchControls[direction] = false; });
    };
    handleTouchEvent(dpadUp, 'up'); handleTouchEvent(dpadDown, 'down');
    handleTouchEvent(dpadLeft, 'left'); handleTouchEvent(dpadRight, 'right');
});
