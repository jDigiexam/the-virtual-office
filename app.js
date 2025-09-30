// --- 1. CONNECT TO SUPERBASE ---
const SUPABASE_URL = 'https://cfuzvmmlvajbhilmegvc.supabase.co'; // URL for Supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmdXp2bW1sdmFqYmhpbG1lZ3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDYzOTcsImV4cCI6MjA3NDc4MjM5N30.3J2oz6sOPo4eei7KspSk5mB-rIWTu1aL3HaBG57CbnQ'; // ANON_KEY for Supabase

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase connection initialized:', supabase);


// --- 2. p5.js SKETCH ---

// Player avatar properties
let player = {
  x: 200,
  y: 200,
  size: 30,
  speed: 3
};

// This function runs once when the sketch starts
function setup() {
  // Create a canvas for our office space
  createCanvas(800, 600);
  console.log('p5.js setup complete. Canvas created.');
}

// This function runs in a loop (about 60 times per second)
function draw() {
  // Give the office a light grey background
  background(220);

  // --- 3. HANDLE PLAYER MOVEMENT ---
  if (keyIsDown(LEFT_ARROW)) {
    player.x -= player.speed;
  }
  if (keyIsDown(RIGHT_ARROW)) {
    player.x += player.speed;
  }
  if (keyIsDown(UP_ARROW)) {
    player.y -= player.speed;
  }
  if (keyIsDown(DOWN_ARROW)) {
    player.y += player.speed;
  }

  // --- 4. DRAW THE PLAYER ---
  fill('blue'); // Give the avatar a color
  noStroke(); // Remove the outline
  // Draw a circle at the player's x and y position
  circle(player.x, player.y, player.size);
}
