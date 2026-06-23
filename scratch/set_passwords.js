const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function run() {
  const users = ['testeheadn21@v3a.ag', 'testerh@v3a.ag'];
  for (const email of users) {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error("Error listing users:", error);
      return;
    }
    const user = data.users.find(u => u.email === email);
    if (user) {
      const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: 'Password123!' }
      );
      if (updateErr) {
        console.error(`Error updating password for ${email}:`, updateErr);
      } else {
        console.log(`Successfully updated password for ${email}`);
      }
    } else {
      console.log(`User not found: ${email}`);
    }
  }
}

run();
