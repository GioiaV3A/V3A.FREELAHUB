import { getSupabaseAdmin } from '../lib/supabase';
async function run() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('nucleos').select('*').limit(1);
  console.log(JSON.stringify({ data, error }, null, 2));
}
run();
