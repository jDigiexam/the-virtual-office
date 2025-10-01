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

// NEW: An array to define our office layout
const walls = [
  { x: 200, y: 0,   w: 20, h: 250 },
  { x: 200, y: 350, w: 20, h: 250 },
  { x: 450, y: 150, w: 350, h: 20 }
];

// --- 3. p5.js PRELOAD, SETUP, AND DRAW ---
function preload() { /* ... unchanged ... */ }
function setup() { /* ... unchanged ... */ }

function draw() {
    if (!gameReady) return;
    background(220);

    // NEW: Draw the walls before anything else
    fill(100); // Dark grey for walls
    noStroke();
    walls.forEach(wall => {
        rect(wall.x, wall.y, wall.w, wall.h);
    });

    handleMovement();
    drawPlayers();
}


// --- 4. GAME LOGIC AND EVENT LISTENERS ---
function joinGame(name, avatar) { /* ... unchanged ... */ }

// NEW HELPER: A function to check for rectangle collision
function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.w &&
        rect1.x + rect1.w > rect2.x &&
        rect1.y < rect2.y + rect2.h &&
        rect1.y + rect1.h > rect2.y
    );
}

// NEW: Rewritten movement function to handle wall collisions
function handleMovement() {
    let dx = 0;
    let dy = 0;

    if (keyIsDown(LEFT_ARROW)) dx -= 1;
    if (keyIsDown(RIGHT_ARROW)) dx += 1;
    if (keyIsDown(UP_ARROW)) dy -= 1;
    if (keyIsDown(DOWN_ARROW)) dy += 1;

    if (dx === 0 && dy === 0) {
        // Not moving, no need to send updates
        return;
    }

    // --- Collision Detection Logic ---
    const playerRect = { x: player.x, y: player.y, w: 64, h: 64 };

    // Check X-axis movement
    let nextXRect = { ...playerRect, x: player.x + dx * player.speed };
    let canMoveX = true;
    for (const wall of walls) {
        if (checkCollision(nextXRect, wall)) {
            canMoveX = false;
            break;
        }
    }
    if (canMoveX) {
        player.x += dx * player.speed;
    }

    // Check Y-axis movement
    let nextYRect = { ...playerRect, y: player.y + dy * player.speed };
    let canMoveY = true;
    for (const wall of walls) {
        if (checkCollision(nextYRect, wall)) {
            canMoveY = false;

            break;
        }
    }
    if (canMoveY) {
        player.y += dy * player.speed;
    }
    
    // Determine direction string (this logic is now separate from position updates)
    // (This section is the same as the previous version)
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
    
    // Constrain to canvas edges (still useful as a backup)
    player.x = constrain(player.x, 0, width - 64);
    player.y = constrain(player.y, 0, height - 64);

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
