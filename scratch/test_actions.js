const { createClient } = require('@supabase/supabase-js');
const { listPublicFormLinksAction, listPublicSubmissionsAction } = require('./app/actions/adminPublicForm');

// Mock next/headers or env if needed, but since we are running via node, let's set process.env variables
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://vehkccapjpsebtmoezfm.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlaGtjY2FwanBzZWJ0bW9lemZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODg2NDIsImV4cCI6MjA5NjA2NDY0Mn0.NGvwt8XtARdYtsEAtVxp0bxhFpH03UOWEAqlN8eWkC4";
process.env.SUPABASE_SERVICE_ROLE_KEY = "INSERT_YOUR_SERVICE_ROLE_KEY_HERE"; // Wait, we need the actual service role key to test!

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  console.log("Signing in...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'renato@v3a.ag',
    password: 'V3A@123',
  });

  if (authErr) {
    console.error("Auth error:", authErr);
    process.exit(1);
  }

  const token = authData.session.access_token;
  console.log("Token retrieved, calling actions...");

  // Since SUPABASE_SERVICE_ROLE_KEY is needed by getSupabaseAdmin, let's load it from .env
  const dotenv = require('dotenv');
  const path = require('path');
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  
  // Update SUPABASE_SERVICE_ROLE_KEY from env
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  console.log("Service role key exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  const linksRes = await listPublicFormLinksAction(token);
  console.log("listPublicFormLinksAction result:", linksRes);

  const subsRes = await listPublicSubmissionsAction(token);
  console.log("listPublicSubmissionsAction result:", subsRes);
}

run().catch(console.error);
