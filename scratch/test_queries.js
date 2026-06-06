const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = "https://vehkccapjpsebtmoezfm.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlaGtjY2FwanBzZWJ0bW9lemZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4ODY0MiwiZXhwIjoyMDk2MDY0NjQyfQ.2Zw5xqE499boJzYjO9bEJm3frehU3aoD2DP5Rf29KAQ";

const adminClient = createClient(supabaseUrl, serviceRoleKey);

async function test() {
  console.log("Testing public_form_links query...");
  const { data, error } = await adminClient
    .from('public_form_links')
    .select('*, freelancer:freelancers(full_name), creator:profiles!public_form_links_created_by_fkey(full_name)')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error("Query failed:", error);
  } else {
    console.log("Query succeeded! Total links:", data.length);
    if (data.length > 0) {
      console.log("Sample link:", JSON.stringify(data[0]));
    }
  }
  
  console.log("\nTesting freelancer_public_submissions query...");
  const { data: data2, error: error2 } = await adminClient
    .from('freelancer_public_submissions')
    .select('*, freelancer:freelancers!freelancer_public_submissions_freelancer_id_fkey(full_name), reviewer:profiles!freelancer_public_submissions_reviewed_by_fkey(full_name)')
    .order('created_at', { ascending: false });
    
  if (error2) {
    console.error("Query 2 failed:", error2);
  } else {
    console.log("Query 2 succeeded! Total submissions:", data2.length);
    if (data2.length > 0) {
      console.log("Sample submission:", JSON.stringify(data2[0]));
    }
  }
}

test();
