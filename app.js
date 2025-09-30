// --- 1. CONNECT TO SUPERBASE ---
const SUPABASE_URL = 'https://cfuzvmmlvajbhilmegvc.supabase.co'; // URL from supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmdXp2bW1sdmFqYmhpbG1lZ3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDYzOTcsImV4cCI6MjA3NDc4MjM5N30.3J2oz6sOPo4eei7KspSk5mB-rIWTu1aL3HaBG57CbnQ'; // Anon Key

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Supabase connection initialized:', supabaseClient);


// --- 2. GLOBAL VARIABLES ---

// A unique ID for this player's session.
const myId = Math.random().toString(36).substring(2, 9);
console.log('My session ID:', myId);

// An object to store the position and data of all other players
const otherPlayers = {};

// Player avatar properties for the local player
let player = {
  x: Math.random() * 750, // Start at a random x position
  y: Math.random() * 550, // Start at a random y position
  size: 30,
  speed: 3
};

// --- 3. p5.js SETUP FUNCTION ---

// Function runs once when the sketch starts
function setup() {
  createCanvas(800, 600);
  console.log('p5.js setup complete. Canvas created.');

  // --- SUBSCRIBE TO REALTIME UPDATES ---
  // Listen for changes in the 'Presences' table
  supabaseClient
    .channel('Presences')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'Presences' },
      (payload) => {
        // We received an update from the database!
        const updatedPresence = payload.new;

        // Ignore updates about our own avatar
        if (updatedPresence.user_id === myId) {
          return;
        }

        // Store the updated position of the other player
        otherPlayers[updatedPresence.user_id] = {
          x: updatedPresence.x_pos,
          y: updatedPresence.y_pos
        };
      }
    )
    .subscribe();
}


// --- 4. p5.js DRAW FUNCTION ---

// This function runs in a loop (about 60 times per second)
function draw() {
  // Give the office a light grey background
  background(220);

  // --- HANDLE LOCAL PLAYER MOVEMENT ---
  let hasMoved = false;
  if (keyIsDown(LEFT_ARROW)) {
    player.x -= player.speed;
    hasMoved = true;
  }
  if (keyIsDown(RIGHT_ARROW)) {
    player.x += player.speed;
    hasMoved = true;
  }
  if (keyIsDown(UP_ARROW)) {
    player.y -= player.speed;
    hasMoved = true;
  }
  if (keyIsDown(DOWN_ARROW)) {
    player.y += player.speed;
    hasMoved = true;
  }

  // --- SEND MY POSITION TO SUPERBASE ---
  // Only send an update if the player has actually moved
  if (hasMoved) {
    supabaseClient
      .from('Presences')
      .upsert({
        user_id: myId,
        x_pos: player.x,
        y_pos: player.y,
        last_seen: new Date().toISOString()
      })
      .then(response => {
        if (response.error) {
          console.error(response.error);
        }
      });
  }

  // --- DRAW ALL OTHER PLAYERS ---
  for (const id in otherPlayers) {
    const other = otherPlayers[id];
    fill('red'); // Draw other players in a different color
    noStroke();
    circle(other.x, other.y, player.size);
  }

  // --- DRAW THE LOCAL PLAYER ---
  fill('blue'); // Draw our own avatar in blue
  noStroke();
  circle(player.x, player.y, player.size);
}
