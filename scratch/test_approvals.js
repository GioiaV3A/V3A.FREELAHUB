const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://vehkccapjpsebtmoezfm.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlaGtjY2FwanBzZWJ0bW9lemZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODg2NDIsImV4cCI6MjA5NjA2NDY0Mn0.NGvwt8XtARdYtsEAtVxp0bxhFpH03UOWEAqlN8eWkC4";

function getClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function run() {
  console.log("=== STARTING APPROVAL FLOW VERIFICATION ===");

  const masterClient = getClient();

  // 1. Authenticate MASTER
  console.log("1. Authenticating as MASTER (renato@v3a.ag)...");
  const { data: masterAuth, error: masterAuthErr } = await masterClient.auth.signInWithPassword({
    email: 'renato@v3a.ag',
    password: 'V3A@123',
  });
  if (masterAuthErr) throw masterAuthErr;
  console.log("MASTER authenticated. ID:", masterAuth.user.id);

  // 2. Find a candidate
  console.log("2. Querying shortlist candidates...");
  const { data: candidates, error: candErr } = await masterClient
    .from('shortlist_candidates')
    .select('*')
    .limit(1);
  if (candErr) throw candErr;
  if (!candidates || candidates.length === 0) {
    console.log("No shortlist candidates found to test with.");
    return;
  }
  const cand = candidates[0];
  console.log(`Using candidate ID: ${cand.id}, Job ID: ${cand.job_id}, Request ID: ${cand.request_id}, Freelancer ID: ${cand.freelancer_id}`);

  // Set schedule_conflict to true first
  await masterClient
    .from('shortlist_candidates')
    .update({ schedule_conflict: true })
    .eq('id', cand.id);

  // Clean up existing approvals for this candidate to ensure clean test
  console.log("3. Cleaning up old approvals for this candidate...");
  await masterClient
    .from('allocation_approvals')
    .delete()
    .eq('shortlist_candidate_id', cand.id);

  // 4. Test INSERT by MASTER (should succeed due to RLS)
  console.log("4. Testing INSERT as MASTER...");
  const { data: app1, error: err1 } = await masterClient
    .from('allocation_approvals')
    .insert({
      job_id: cand.job_id,
      request_id: cand.request_id,
      shortlist_candidate_id: cand.id,
      freelancer_id: cand.freelancer_id,
      approval_type: 'schedule_conflict',
      status: 'pending',
      requested_by: masterAuth.user.id,
      reason: 'Justificativa de teste do MASTER'
    })
    .select('*')
    .single();

  if (err1) {
    console.error("FAIL: MASTER could not insert approval:", err1.message);
    return;
  } else {
    console.log("SUCCESS: MASTER inserted approval. ID:", app1.id);
  }

  // 5. Test Duplicate Insert (should fail due to unique index)
  console.log("5. Testing Duplicate Insert...");
  const { error: errDup } = await masterClient
    .from('allocation_approvals')
    .insert({
      job_id: cand.job_id,
      request_id: cand.request_id,
      shortlist_candidate_id: cand.id,
      freelancer_id: cand.freelancer_id,
      approval_type: 'schedule_conflict',
      status: 'pending',
      requested_by: masterAuth.user.id,
      reason: 'Justificativa duplicada'
    });

  if (errDup) {
    console.log("SUCCESS: Duplicate insert was blocked correctly! Error:", errDup.message);
  } else {
    console.error("FAIL: Duplicate insert succeeded (unique index missing or not working).");
  }

  // 6. Test UPDATE status by MASTER (should succeed due to RLS)
  console.log("6. Testing UPDATE status by MASTER...");
  const { data: appUpdated, error: errUpdate } = await masterClient
    .from('allocation_approvals')
    .update({
      status: 'approved',
      approver_id: masterAuth.user.id,
      approver_role: 'master',
      decision_notes: 'Aprovado em teste automatizado',
      decided_at: new Date().toISOString()
    })
    .eq('id', app1.id)
    .select('*')
    .single();

  if (errUpdate) {
    console.error("FAIL: MASTER could not update/approve:", errUpdate.message);
  } else {
    console.log("SUCCESS: MASTER updated approval status to:", appUpdated.status);
  }

  // Clean up
  console.log("7. Cleaning up test approval record...");
  await masterClient
    .from('allocation_approvals')
    .delete()
    .eq('id', app1.id);

  console.log("=== VERIFICATION COMPLETED SUCCESSFULLY ===");
}

run().catch(err => {
  console.error("Verification script failed:", err);
});
