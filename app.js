// --- 1. CONNECT TO SUPERBASE ---
const SUPABASE_URL = 'https://cfuzvmmlvajbhilmegvc.supabase.co'; // URL from supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmdXp2bW1sdmFqYmhpbG1lZ3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDYzOTcsImV4cCI6MjA3NDc8MjM5N30.3J2oz6sOPo4eei7KspSk5mB-rIWTu1aL3HaBG57CbnQ'; // Anon Key

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. GLOBAL VARIABLES ---
const myId = crypto.randomUUID();
const otherPlayers = {};
let player = {}; // Player object will be created after joining
let avatarImages = {}; // To store the loaded image assets
let gameReady = false; // A flag to control when the game starts

// --- 3. p5.js PRELOAD FUNCTION ---
// p5.js calls this function before setup() to ensure assets are loaded
function preload() {
  avatarImages.avatar1 = loadImage('avatar1.png');
  avatarImages.avatar2 = loadImage('avatar2.png');
  avatarImages.avatar3 = loadImage('avatar3.png');
}

// --- 4. p5.js SETUP AND DRAW ---

// This function runs once when the sketch starts
function setup() {
  createCanvas(800, 600);
  // We'll wait to draw anything until the user has joined
  noLoop(); // Stop the draw loop initially
  textAlign(CENTER); // Set text alignment for names
  textSize(14);
}

// This function runs in a loop after loop() is called
function draw() {
  if (!gameReady) return; // Don't do anything if the game hasn't started

  background(220); // Light grey background

  // --- HANDLE LOCAL PLAYER MOVEMENT AND SEND TO SUPERBASE ---
  handleMovement();

  // --- DRAW ALL OTHER PLAYERS ---
  for (const id in otherPlayers) {
    const other = otherPlayers[id];
    if (other.avatar && avatarImages[other.avatar]) {
      // Draw the other player's image
      image(avatarImages[other.avatar], other.x, other.y, 64, 64);
      // Draw their name below the image
      fill(0); // Black text
      text(other.name, other.x + 32, other.y + 80);
    }
  }

  // --- DRAW THE LOCAL PLAYER ---
  if (player.avatar && avatarImages[player.avatar]) {
    image(avatarImages[player.avatar], player.x, player.y, 64, 64);
    fill(0);
    text(player.name, player.x + 32, player.y + 80);
  }
}


// --- 5. GAME LOGIC AND EVENT LISTENERS ---

// A function to initialize the game once the user joins
function joinGame(name, avatar) {
  player = {
    x: Math.random() * 700,
    y: Math.random() * 500,
    speed: 3,
    name: name,
    avatar: avatar
  };

  // Hide the join screen and start the game
  document.getElementById('join-screen').style.display = 'none';
  gameReady = true;
  loop(); // Start the p5.js draw loop

  // Start listening for other players
  subscribeToUpdates();
}

// A function to handle movement and send updates
function handleMovement() {
  let hasMoved = false;
  if (keyIsDown(LEFT_ARROW)) { player.x -= player.speed; hasMoved = true; }
  if (keyIsDown(RIGHT_ARROW)) { player.x += player.speed; hasMoved = true; }
  if (keyIsDown(UP_ARROW)) { player.y -= player.speed; hasMoved = true; }
  if (keyIsDown(DOWN_ARROW)) { player.y += player.speed; hasMoved = true; }
  
  // NEW: Constrain the player's position to stay within the canvas boundaries
  player.x = constrain(player.x, 0, width - 64); // width is a p5.js variable for canvas width
  player.y = constrain(player.y, 0, height - 64); // height is a p5.js variable for canvas height

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

// A function to subscribe to Supabase realtime updates
function subscribeToUpdates() {
  supabaseClient
    .channel('Presences')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'Presences' },
      (payload) => {
        const updatedPresence = payload.new;
        if (updatedPresence.user_id === myId) return;

        otherPlayers[updatedPresence.user_id] = {
          x: updatedPresence.x_pos,
          y: updatedPresence.y_pos,
          name: updatedPresence.name,
          avatar: updatedPresence.avatar
        };
      }
    )
    .subscribe();
}

// --- Add event listeners for the join screen ---
window.addEventListener('DOMContentLoaded', () => {
    const joinButton = document.getElementById('join-button');
    const nameInput = document.getElementById('name-input');
    const avatars = document.querySelectorAll('#avatar-selection img');
    let selectedAvatar = 'avatar1'; // Default selection

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
});
