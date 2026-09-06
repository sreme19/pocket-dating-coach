import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key);
(async () => {
  const emails = ['ramu22tera@gmail.com','harishankarsunani759@gmail.com','mknaik1059@gmail.com','rksinghagri@gmail.com','sameersatpute7@gmail.com','siddiquiabdulaziz83@gmail.com','gaamwalagujjar@gmail.com','rahim2105rj@gmail.com','rohittiwari101.rt@gmail.com'];
  let page = 1;
  const idByEmail = new Map<string,string>();
  while (true) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { console.log('ERR', error.message); break; }
    for (const u of data.users) {
      if (u.email && emails.includes(u.email)) idByEmail.set(u.email, u.id);
    }
    if (data.users.length < 1000) break;
    page++;
  }
  console.log('Found ids:', idByEmail.size, Object.fromEntries(idByEmail));

  for (const [email, id] of idByEmail) {
    const { data: acq } = await db.from('user_acquisition' as any).select('*').eq('user_id', id).maybeSingle();
    console.log(`${email} -> acquisition: ${acq ? JSON.stringify(acq) : 'NONE'}`);
  }
})();
