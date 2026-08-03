import nodemailer from 'nodemailer';

async function test() {
  const host = 'smtp.gmail.com';
  const port = 465;
  const secure = true;
  const user = 'freelahub@v3a.ag';
  const pass = 'V3a#a1b2c2026114';

  console.log(`Attempting to authenticate to ${host}:${port} as ${user}...`);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  try {
    await transporter.verify();
    console.log('Authentication successful!');
  } catch (err) {
    console.error('Authentication failed:', err);
  }
}

test();
