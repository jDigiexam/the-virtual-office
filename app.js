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

// NEW: A layout with a central hall and four rooms with clear doors.
const walls = [
  // Central Hallway Walls
  // Left wall of hallway (with 2 doors)
  { x: 300, y: 0,   w: 10, h: 120 },
  { x: 300, y: 220, w: 10, h: 180 },
  { x: 300, y: 500, w: 10, h: 100 },
  
  // Right wall of hallway (with 2 doors)
  { x: 490, y: 0,   w: 10, h: 120 },
  { x: 490, y: 220, w: 10, h: 180 },
  { x: 490, y: 500, w: 10, h: 100 },

  // Horizontal room dividers
  { x: 0,   y: 300, w: 310, h: 10 }, // Left side divider
  { x: 500, y: 300, w: 300, h: 10 }, // Right side divider
];

// --- 3. p5.js PRELOAD, SETUP, AND DRAW ---
function preload() { /* ... unchanged ... */ }
function setup() { /* ... unchanged ... */ }
function draw() {
    if (!gameReady) return;
    background('#d1e8f9'); // A nice light blue
    fill(100);
    noStroke();
    walls.forEach(wall => { rect(wall.x, wall.y, wall.w, wall.h); });
    handleMovement();
    drawPlayers();
}

// --- 4. GAME LOGIC AND EVENT LISTENERS ---
function joinGame(name, avatar) { /* ... unchanged ... */ }

function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.w &&
        rect1.x + rect1.w > rect2.x &&
        rect1.y < rect2.y + rect2.h &&
        rect1.y + rect1.h > rect2.y
    );
}

// REWRITTEN: The handleMovement function now uses a smaller hitbox for more precise collisions.
function handleMovement() {
    // --- NEW: Define hitbox dimensions and offsets ---
    // You can tweak these values to perfectly fit your sprites!
    const SPRITE_W = 64;
    const SPRITE_H = 64;
    const HITBOX_W = 32; // Make the hitbox narrower than the sprite
    const HITBOX_H = 48; // Make the hitbox shorter, focused on the lower body
    const X_OFFSET = (SPRITE_W - HITBOX_W) / 2; // Center the hitbox horizontally ( (64-32)/2 = 16 )
    const Y_OFFSET = SPRITE_H - HITBOX_H;      // Place the hitbox at the bottom of the sprite ( 64-48 = 16 )

    let dx = 0;
    let dy = 0;

    if (keyIsDown(LEFT_ARROW)) dx -= 1;
    if (keyIsDown(RIGHT_ARROW)) dx += 1;
    if (keyIsDown(UP_ARROW)) dy -= 1;
    if (keyIsDown(DOWN_ARROW)) dy += 1;

    if (dx === 0 && dy === 0) {
        return; // Not moving
    }

    // --- Collision Detection Logic using the hitbox ---
    const playerHitbox = {
        x: player.x + X_OFFSET,
        y: player.y + Y_OFFSET,
        w: HITBOX_W,
        h: HITBOX_H
    };

    // Check X-axis movement
    let nextXHitbox = { ...playerHitbox, x: playerHitbox.x + dx * player.speed };
    let canMoveX = true;
    for (const wall of walls) {
        if (checkCollision(nextXHitbox, wall)) {
            canMoveX = false;
            break;
        }
    }
    if (canMoveX) {
        player.x += dx * player.speed;
    }

    // Check Y-axis movement
    // Update hitbox position before checking Y, in case X changed
    playerHitbox.x = player.x + X_OFFSET; 
    let nextYHitbox = { ...playerHitbox, y: playerHitbox.y + dy * player.speed };
    let canMoveY = true;
    for (const wall of walls) {
        if (checkCollision(nextYHitbox, wall)) {
            canMoveY = false;
            break;
        }
    }
    if (canMoveY) {
        player.y += dy * player.speed;
    }
    
    // Determine direction string
    let newDirection = player.direction;
    if (dy === -1) newDirection = 'up';
    if (dy === 1) newDirection = 'down';
    if (dx === -1) newDirection = 'left';
    if (dx === 1) newDirection = 'right';
    if (dy === -1 && dx === -1) newDirection = 'up_left';
    if (dy === -1 && dx === 1) newDirection = 'up_right';
    if (dy === 1 && dx === -1) newDirection = 'down_left';
    if (dy === 1 && dx === 1) newDirection = 'down_right';
    player.direction = newDirection;
    
    // Constrain to canvas edges
    player.x = constrain(player.x, 0, width - SPRITE_W);
    player.y = constrain(player.y, 0, height - SPRITE_H);

    // Send update to Supabase
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

function drawPlayers() { /* ... unchanged ... */ }
function subscribeToUpdates() { /* ... unchanged ... */ }
async function fetchInitialMessages() { /* ... unchanged ... */ }
function displayMessage(message) { /* ... unchanged ... */ }
async function sendMessage(messageText) { /* ... unchanged ... */ }
window.addEventListener('DOMContentLoaded', () => { /* ... unchanged ... */ });

// --- (You can copy the unchanged functions from your previous file to fill this in) ---
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
    const canvas = createCanvas(800, 600);
    canvas.parent('main-container');
    noLoop();
    textAlign(CENTER);
    textSize(14);
}
function joinGame(name, avatar) {
    player = { x: Math.random() * 700, y: Math.random() * 500, speed: 3, name: name, avatar: avatar, direction: 'down' };
    document.getElementById('join-screen').style.display = 'none';
    document.getElementById('main-container').style.display = 'flex';
    gameReady = true;
    loop();
    subscribeToUpdates();
    fetchInitialMessages();
}
function drawPlayers() {
    for (const id in otherPlayers) {
        const other = otherPlayers[id];
        const sprite = avatarImages[other.avatar] ? (avatarImages[other.avatar][other.direction] || avatarImages[other.avatar]['down']) : null;
        if (sprite) {
            image(sprite, other.x, other.y, 64, 64);
            fill(0);
            text(other.name, other.x + 32, other.y + 80);
        }
    }
    const mySprite = avatarImages[player.avatar] ? (avatarImages[player.avatar][player.direction] || avatarImages[player.avatar]['down']) : null;
    if (mySprite) {
        image(mySprite, player.x, player.y, 64, 64);
        fill(0);
        text(player.name, player.x + 32, player.y + 80);
    }
}
function subscribeToUpdates() {
    supabaseClient
        .channel('Presences')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'Presences' },
            (payload) => {
                const updatedPresence = payload.new;
                if (updatedPresence.user_id === myId) return;
                otherPlayers[updatedPresence.user_id] = {
                    x: updatedPresence.x_pos,
                    y: updatedPresence.y_pos,
                    name: updatedPresence.name,
                    avatar: updatedPresence.avatar,
                    direction: updatedPresence.direction
                };
            }
        )
        .subscribe();
    supabaseClient
        .channel('messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload) => { displayMessage(payload.new); }
        )
        .subscribe();
}
async function fetchInitialMessages() {
    const { data, error } = await supabaseClient.from('messages').select('*').order('created_at', { ascending: true }).limit(50);
    if (error) console.error('Error fetching messages:', error);
    else data.forEach(displayMessage);
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
  avatars.forEach(img => {
    img.addEventListener('click', () => {
      avatars.forEach(a => a.classList.remove('selected'));
      img.classList.add('selected');
      selectedAvatar = img.dataset.avatar;
    });
  });
  joinButton.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (name) joinGame(name, selectedAvatar);
    else alert('Please enter your name.');
  });
  const chatInput = document.getElementById('chat-input');
  chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      sendMessage(chatInput.value);
      chatInput.value = '';
    }
  });
});
