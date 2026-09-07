const http = require('http');

async function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('--- TEST 1: Sign up new user ---');
  const signup = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    displayName: 'Alice Sharma',
    loginIdentifier: 'alice@codex.dev',
    password: 'securePassword123'
  });
  console.log('Signup Result:', signup.status, signup.body);

  console.log('\n--- TEST 2: Login newly registered user ---');
  const login = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    loginIdentifier: 'alice@codex.dev',
    password: 'securePassword123'
  });
  console.log('Login Result:', login.status, login.body);

  console.log('\n--- TEST 3: Login pre-seeded demo user (demo@codex.dev) ---');
  const demoLogin = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    loginIdentifier: 'demo@codex.dev',
    password: 'password123'
  });
  console.log('Demo Login Result:', demoLogin.status, demoLogin.body);

  console.log('\n--- TEST 4: Login admin user (admin@codex.dev) ---');
  const adminLogin = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    loginIdentifier: 'admin@codex.dev',
    password: 'adminpassword123'
  });
  console.log('Admin Login Result:', adminLogin.status, adminLogin.body);
}

run().catch(console.error);
