const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function run() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'renato@v3a.ag',
    password: 'V3A@123',
  });

  if (authErr) {
    console.error("Login failed:", authErr);
    return;
  }

  const token = authData.session.access_token;
  console.log("Logged in! Token obtained.");

  console.log("Querying public_form_links with updated join...");
  const { data: links, error: linksErr } = await adminClient
    .from('public_form_links')
    .select('*, freelancer:freelancers(full_name), creator:profiles!public_form_links_created_by_fkey(full_name)')
    .order('created_at', { ascending: false });

  if (linksErr) {
    console.error("Query links error:", linksErr);
  } else {
    console.log("Query links success! Count:", links.length);
  }

  console.log("Querying freelancer_public_submissions with updated join...");
  const { data: subs, error: subsErr } = await adminClient
    .from('freelancer_public_submissions')
    .select('*, freelancer:freelancers!freelancer_public_submissions_freelancer_id_fkey(full_name), reviewer:profiles!freelancer_public_submissions_reviewed_by_fkey(full_name)')
    .order('created_at', { ascending: false });

  if (subsErr) {
    console.error("Query submissions error:", subsErr);
  } else {
    console.log("Query submissions success! Count:", subs.length);
  }
}

run().catch(console.error);
