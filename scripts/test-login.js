const https = require('https');

const data = JSON.stringify({
  email: 'TeamTechnical',
  password: 'TechnicalTeamFirst4388'
});

const options = {
  hostname: 'tech-made-easy-backend.onrender.com',
  port: 443,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const parsed = JSON.parse(body);
      if (parsed.token) {
        console.log('✅ Login SUCCESS');
        console.log('User:', parsed.user?.name, '|', parsed.user?.role);
        console.log('Token:', parsed.token.substring(0, 30) + '...');
      } else {
        console.log('Response:', JSON.stringify(parsed, null, 2));
      }
    } catch {
      console.log('Raw:', body.substring(0, 200));
    }
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();
