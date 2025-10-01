// --- 1. CONNECT TO SUPERBASE ---
const SUPABASE_URL = 'https://cfuzvmmlvajbhilmegvc.supabase.co'; // URL from supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmdXp2bW1sdmFqYmhpbG1lZ3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDYzOTcsImV4cCI6MjA3NDc4MjM5N30.3J2oz6sOPo4eei7KspSk5mB-rIWTu1aL3HaBG57CbnQ'; // Anon Key
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

Of course. Here is the complete app.js file with all the features we've built, including the new scrolling camera, the larger office map, and all the previous logic for sprites, walls, chat, and mobile controls.

Just replace your entire app.js file with this code.

JavaScript

// --- 1. CONNECT TO SUPERBASE ---
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // Replace with your URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your Anon Key
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. GLOBAL VARIABLES ---
const myId = crypto.randomUUID();
const otherPlayers = {};
let player = {};
let avatarImages = { avatar1: {}, avatar2: {}, avatar3: {} };
let gameReady = false;
let touchControls = { up: false, down: false, left: false, right: false };
let wasMoving = false;

// Define the total size of our world.
const worldWidth = 1600;
const worldHeight = 1200;

// A larger wall layout for the bigger world.
const walls = [
  // Outer boundary walls
  { x: 0, y: 0, w: worldWidth, h: 10 },
  { x: 0, y: worldHeight - 10, w: worldWidth, h: 10 },
  { x: 0, y: 0, w: 10, h: worldHeight },
  { x: worldWidth - 10, y: 0, w: 10, h: worldHeight },

  // Main central building
  { x: 300, y: 300, w: 1000, h: 10 }, // Top wall
  { x: 300, y: 900, w: 1000, h: 10 }, // Bottom wall
  { x: 300, y: 300, w: 10, h: 200 }, // Top-left vertical
  { x: 300, y: 600, w: 10, h: 300 }, // Bottom-left vertical (doorway at 500)
  { x: 1290, y: 300, w: 10, h: 600 }, // Right vertical

  // Internal office dividers
  { x: 600, y: 310, w: 10, h: 300 }, // First internal vertical
  { x: 950, y: 600, w: 10, h: 300 }, // Second internal vertical
  { x: 600, y: 600, w: 360, h: 10 }  // Central horizontal
];

// Updated spawn points for the new layout
const spawnPoints = [
  { x: 450, y: 550 }, // Lobby area
  { x: 750, y: 450 }, // Central corridor
  { x: 1100, y: 750 },// Bottom right area
  { x: 450, y: 750 }  // Bottom left room
];

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

    // Draw World Elements
    fill(100);
    noStroke();
    walls.forEach(wall => {
        rect(wall.x, wall.y, wall.w, wall.h);
    });

    handleMovement();
    drawPlayers();
}

// --- 4. GAME LOGIC AND EVENT LISTENERS ---
function joinGame(name, avatar) {
    const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    player = {
        x: spawnPoint.x,
        y: spawnPoint.y,
        speed: 3,
        name: name,
        avatar: avatar,
        direction: 'down'
    };
    document.getElementById('join-screen').style.display = 'none';
    document.getElementById('main-container').style.display = 'flex';
    gameReady = true;
    loop();
    subscribeToUpdates();
    fetchInitialMessages();
}

function checkCollision(rect1, rect2) {
    return ( rect1.x < rect2.x + rect2.w && rect1.x + rect1.w > rect2.x && rect1.y < rect2.y + rect2.h && rect1.y + rect1.h > rect2.y );
}

function handleMovement() {
    const SPRITE_W = 64; const SPRITE_H = 64; const HITBOX_W = 32; const HITBOX_H = 48; const X_OFFSET = (SPRITE_W - HITBOX_W) / 2; const Y_OFFSET = SPRITE_H - HITBOX_H;
    let dx = 0; let dy = 0;
    
    if (keyIsDown(LEFT_ARROW) || touchControls.left) dx -= 1;
    if (keyIsDown(RIGHT_ARROW) || touchControls.right) dx += 1;
    if (keyIsDown(UP_ARROW) || touchControls.up) dy -= 1;
    if (keyIsDown(DOWN_ARROW) || touchControls.down) dy += 1;
    
    const isMoving = dx !== 0 || dy !== 0;

    if (isMoving) {
        const playerHitbox = { x: player.x + X_OFFSET, y: player.y + Y_OFFSET, w: HITBOX_W, h: HITBOX_H };
        let nextXHitbox = { ...playerHitbox, x: playerHitbox.x + dx * player.speed };
        let canMoveX = true;
        for (const wall of walls) { if (checkCollision(nextXHitbox, wall)) { canMoveX = false; break; } }
        if (canMoveX) { player.x += dx * player.speed; }
        
        playerHitbox.x = player.x + X_OFFSET;
        let nextYHitbox = { ...playerHitbox, y: playerHitbox.y + dy * player.speed };
        let canMoveY = true;
        for (const wall of walls) { if (checkCollision(nextYHitbox, wall)) { canMoveY = false; break; } }
        if (canMoveY) { player.y += dy * player.speed; }
        
        let newDirection = player.direction;
        if (dy === -1) newDirection = 'up'; if (dy === 1) newDirection = 'down'; if (dx === -1) newDirection = 'left'; if (dx === 1) newDirection = 'right';
        if (dy === -1 && dx === -1) newDirection = 'up_left'; if (dy === -1 && dx === 1) newDirection = 'up_right'; if (dy === 1 && dx === -1) newDirection = 'down_left'; if (dy === 1 && dx === 1) newDirection = 'down_right';
        player.direction = newDirection;
    }

    player.x = constrain(player.x, 0, worldWidth - SPRITE_W);
    player.y = constrain(player.y, 0, worldHeight - SPRITE_H);

    if (isMoving || wasMoving) {
        supabaseClient
            .from('Presences')
            .upsert({
                user_id: myId,
                x_pos: Math.round(player.x),
                y_pos: Math.round(player.y),
                name: player.name,
                avatar: player.avatar,
                direction: player.direction,
                last_seen: new Date().toISOString()
            })
            .then(response => { if (response.error) console.error(response.error); });
    }
    wasMoving = isMoving;
}

function drawPlayers() {
    for (const id in otherPlayers) {
        const other = otherPlayers[id];
        const sprite = avatarImages[other.avatar] ? (avatarImages[other.avatar][other.direction] || avatarImages[other.avatar]['down']) : null;
        if (sprite) { image(sprite, other.x, other.y, 64, 64); fill(0); text(other.name, other.x + 32, other.y + 80); }
    }
    const mySprite = avatarImages[player.avatar] ? (avatarImages[player.avatar][player.direction] || avatarImages[player.avatar]['down']) : null;
    if (mySprite) { image(mySprite, player.x, player.y, 64, 64); fill(0); text(player.name, player.x + 32, player.y + 80); }
}

function subscribeToUpdates() {
    supabaseClient.channel('Presences').on('postgres_changes', { event: '*', schema: 'public', table: 'Presences' }, (payload) => {
        const updatedPresence = payload.new; if (updatedPresence.user_id === myId) return;
        otherPlayers[updatedPresence.user_id] = { x: updatedPresence.x_pos, y: updatedPresence.y_pos, name: updatedPresence.name, avatar: updatedPresence.avatar, direction: updatedPresence.direction };
    }).subscribe();
    supabaseClient.channel('messages').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => { displayMessage(payload.new); }).subscribe();
}

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

    handleTouchEvent(dpadUp, 'up');
    handleTouchEvent(dpadDown, 'down');
    handleTouchEvent(dpadLeft, 'left');
    handleTouchEvent(dpadRight, 'right');
});
