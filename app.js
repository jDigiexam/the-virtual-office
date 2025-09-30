// --- 1. CONNECT TO SUPERBASE ---
const SUPABASE_URL = 'https://cfuzvmmlvajbhilmegvc.supabase.co'; // URL from supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmdXp2bW1sdmFqYmhpbG1lZ3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDYzOTcsImV4cCI6MjA3NDc4MjM5N30.3J2oz6sOPo4eei7KspSk5mB-rIWTu1aL3HaBG57CbnQ'; // Anon Key

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. GLOBAL VARIABLES ---
const myId = crypto.randomUUID();
const otherPlayers = {};
let player = {};
let avatarImages = {};
let gameReady = false;

// --- 3. p5.js PRELOAD, SETUP, AND DRAW ---
function preload() {
  avatarImages.avatar1 = loadImage('avatar1.png');
  avatarImages.avatar2 = loadImage('avatar2.png');
  avatarImages.avatar3 = loadImage('avatar3.png');
}

function setup() {
  const canvas = createCanvas(800, 600);
  canvas.parent('main-container');
  noLoop();
  textAlign(CENTER);
  textSize(14);
}

function draw() {
  if (!gameReady) return;
  background(220);
  handleMovement();
  drawPlayers();
}

// --- 4. GAME LOGIC AND EVENT LISTENERS ---
function joinGame(name, avatar) {
  player = {
    x: Math.random() * 700,
    y: Math.random() * 500,
    speed: 3,
    name: name,
    avatar: avatar
  };

  document.getElementById('join-screen').style.display = 'none';
  document.getElementById('main-container').style.display = 'flex';
  gameReady = true;
  loop();

  subscribeToUpdates();
  fetchInitialMessages();
}

function handleMovement() {
  let hasMoved = false;
  if (keyIsDown(LEFT_ARROW)) { player.x -= player.speed; hasMoved = true; }
  if (keyIsDown(RIGHT_ARROW)) { player.x += player.speed; hasMoved = true; }
  if (keyIsDown(UP_ARROW)) { player.y -= player.speed; hasMoved = true; }
  if (keyIsDown(DOWN_ARROW)) { player.y += player.speed; hasMoved = true; }

  player.x = constrain(player.x, 0, width - 64);
  player.y = constrain(player.y, 0, height - 64);

  if (hasMoved) {
    supabaseClient
      .from('Presences')
      .upsert({
        user_id: myId,
        x_pos: Math.round(player.x),
        y_pos: Math.round(player.y),
        name: player.name,
        avatar: player.avatar,
        last_seen: new Date().toISOString()
      })
      .then(response => { if (response.error) console.error(response.error); });
  }
}

function drawPlayers() {
  // Draw other players
  for (const id in otherPlayers) {
    const other = otherPlayers[id];
    if (other.avatar && avatarImages[other.avatar]) {
      image(avatarImages[other.avatar], other.x, other.y, 64, 64);
      fill(0);
      text(other.name, other.x + 32, other.y + 80);
    }
  }

  // Draw local player
  if (player.avatar && avatarImages[player.avatar]) {
    image(avatarImages[player.avatar], player.x, player.y, 64, 64);
    fill(0);
    text(player.name, player.x + 32, player.y + 80);
  }
}

function subscribeToUpdates() {
  // Presence channel
  supabaseClient
    .channel('Presences')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'Presences' },
      (payload) => {
        const updatedPresence = payload.new;
        if (updatedPresence.user_id === myId) return;
        
        // THIS IS THE FIX: We map the database columns (x_pos) to the keys our drawing function uses (x).
        otherPlayers[updatedPresence.user_id] = {
            x: updatedPresence.x_pos,
            y: updatedPresence.y_pos,
            name: updatedPresence.name,
            avatar: updatedPresence.avatar
        };
      }
    )
    .subscribe();

  // Messages channel
  supabaseClient
    .channel('messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        displayMessage(payload.new);
      }
    )
    .subscribe();
}

// --- 5. CHAT FUNCTIONS ---
async function fetchInitialMessages() {
    const { data, error } = await supabaseClient
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);

    if (error) {
        console.error('Error fetching messages:', error);
    } else {
        data.forEach(displayMessage);
    }
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

    const { error } = await supabaseClient
        .from('messages')
        .insert({ name: player.name, message: messageText });

    if (error) {
        console.error('Error sending message:', error);
    }
}

// --- 6. EVENT LISTENERS ---
window.addEventListener('DOMContentLoaded', () => {
  // Join screen logic
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
    if (name) {
      joinGame(name, selectedAvatar);
    } else {
      alert('Please enter your name.');
    }
  });

  // Chat input logic
  const chatInput = document.getElementById('chat-input');
  chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      sendMessage(chatInput.value);
      chatInput.value = '';
    }
  });
});
