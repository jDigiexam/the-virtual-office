// --- 1. CONNECT TO SUPERBASE ---
const SUPABASE_URL = 'https://cfuzvmmlvajbhilmegvc.supabase.co'; // URL from supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmdXp2bW1sdmFqYmhpbG1lZ3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDYzOTcsImV4cCI6MjA3NDc4MjM5N30.3J2oz6sOPo4eei7KspSk5mB-rIWTu1aL3HaBG57CbnQ'; // Anon Key
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Supabase connection initialized:', supabaseClient);

// --- 2. GLOBAL VARIABLES ---

const myId = crypto.randomUUID();
console.log('My session ID:', myId);

const otherPlayers = {};

// A helper function to generate a random hex color
function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Player avatar properties for the local player
let player = {
  x: Math.random() * 750,
  y: Math.random() * 550,
  size: 30,
  speed: 3,
  color: getRandomColor() // Assign a random color to our player
};

// --- 3. p5.js SETUP FUNCTION ---

function setup() {
  createCanvas(800, 600);
  console.log('p5.js setup complete. Canvas created.');

  // --- SUBSCRIBE TO REALTIME UPDATES ---
  supabaseClient
    .channel('Presences')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'Presences' },
      (payload) => {
        const updatedPresence = payload.new;

        if (updatedPresence.user_id === myId) {
          return;
        }

        // NEW: Store the other player's color along with their position
        otherPlayers[updatedPresence.user_id] = {
          x: updatedPresence.x_pos,
          y: updatedPresence.y_pos,
          color: updatedPresence.color
        };
      }
    )
    .subscribe();
}

// --- 4. p5.js DRAW FUNCTION ---

function draw() {
  background(220);

  // --- HANDLE LOCAL PLAYER MOVEMENT ---
  let hasMoved = false;
  if (keyIsDown(LEFT_ARROW)) { player.x -= player.speed; hasMoved = true; }
  if (keyIsDown(RIGHT_ARROW)) { player.x += player.speed; hasMoved = true; }
  if (keyIsDown(UP_ARROW)) { player.y -= player.speed; hasMoved = true; }
  if (keyIsDown(DOWN_ARROW)) { player.y += player.speed; hasMoved = true; }

  // --- SEND MY POSITION TO SUPERBASE ---
  if (hasMoved) {
    supabaseClient
      .from('Presences')
      .upsert({
        user_id: myId,
        x_pos: Math.round(player.x),
        y_pos: Math.round(player.y),
        color: player.color, // NEW: Send our color to the database
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
    // NEW: Use the specific color for each player, or default to red if it's missing
    fill(other.color || 'red');
    noStroke();
    circle(other.x, other.y, player.size);
  }

  // --- DRAW THE LOCAL PLAYER ---
  fill(player.color); // NEW: Use our player's generated color
  noStroke();
  circle(player.x, player.y, player.size);
}
