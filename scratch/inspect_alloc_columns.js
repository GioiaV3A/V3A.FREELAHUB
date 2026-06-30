const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
let supabaseUrl = '';
let supabaseAnonKey = '';

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1].replace(/["']/g, '').trim();
    }
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
      supabaseAnonKey = line.split('=')[1].replace(/["']/g, '').trim();
    }
  }
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // Query a dummy row from allocations to see all keys
  const { data, error } = await supabase.from('allocations').select('*').limit(1);
  if (error) {
    console.error("ERROR:", error);
  } else {
    console.log("ALLOCATION COLUMNS:", data[0] ? Object.keys(data[0]) : "No rows found");
  }
}

run();
