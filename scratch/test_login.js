const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://vehkccapjpsebtmoezfm.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlaGtjY2FwanBzZWJ0bW9lemZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODg2NDIsImV4cCI6MjA5NjA2NDY0Mn0.NGvwt8XtARdYtsEAtVxp0bxhFpH03UOWEAqlN8eWkC4";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function run() {
  console.log("Attempting sign in for renato@v3a.ag...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'renato@v3a.ag',
    password: 'V3A@123',
  });

  if (authErr) {
    console.error("Auth error:", authErr);
    process.exit(1);
  }

  console.log("Auth success! User ID:", authData.user.id);

  const queries = [
    { name: 'profiles', query: supabase.from('profiles').select('*') },
    { name: 'nucleos', query: supabase.from('nucleos').select('*') },
    { name: 'freelancers', query: supabase.from('freelancers').select('*, main_function:freela_functions(name), freelancer_industries(industry:industries(name))') },
    { name: 'rate_policies', query: supabase.from('rate_policies').select('*, function:freela_functions(name)') },
    { name: 'job_freelancer_requests', query: supabase.from('job_freelancer_requests').select('*, jobs(*), freela_functions(*)') },
    { name: 'shortlist_candidates', query: supabase.from('shortlist_candidates').select('*') },
    { name: 'negotiations', query: supabase.from('negotiations').select('*') },
    { name: 'allocations', query: supabase.from('allocations').select('*') },
    { name: 'evaluations', query: supabase.from('evaluations').select('*') },
    { name: 'payment_codes', query: supabase.from('payment_codes').select('*') },
    { name: 'suggestions', query: supabase.from('suggestions').select('*') },
  ];

  for (const q of queries) {
    console.log(`Running query: ${q.name}...`);
    const { data, error } = await q.query;
    if (error) {
      console.error(`Error on query ${q.name}:`, error);
    } else {
      console.log(`Success on query ${q.name}! Rows returned:`, data.length);
    }
  }
}

run().catch(console.error);
