import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

async function runPhase2EVerification() {
  console.log('==================================================');
  console.log('STARTING PHASE 2E VERIFICATION TEST SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`[PASS] Test ${total}: ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${total}: ${testName}`);
      if (detail) console.error(`       Detail: ${detail}`);
    }
  }

  // 1. Code Inspection: App.tsx
  const appCode = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
  assert(
    !appCode.includes('<MerchantHeader />\n            <div className="flex-1 flex items-center justify-center p-6 bg-[#F8FAFC]">\n              <MerchantAuth'),
    'App.tsx does NOT wrap MerchantAuth with MerchantHeader for unauthenticated routes'
  );
  assert(
    appCode.includes('<MerchantAuth initialMode={merchantAuthMode} onNavigate={navigate} />'),
    'App.tsx renders MerchantAuth directly with onNavigate and merchantAuthMode'
  );
  assert(
    appCode.includes('<MerchantLanding onNavigate={navigate} />'),
    'App.tsx preserves /merchant landing page rendering'
  );

  // 2. Code Inspection: MerchantAuth.tsx
  const authCode = fs.readFileSync(path.join(process.cwd(), 'src/components/merchant/MerchantAuth.tsx'), 'utf-8');
  assert(authCode.includes('showPassword'), 'MerchantAuth has password visibility toggle state');
  assert(authCode.includes('Eye') && authCode.includes('EyeOff'), 'MerchantAuth imports and renders Eye / EyeOff icons');
  assert(authCode.includes('Sign In to Merchant Suite'), 'MerchantAuth primary button is "Sign In to Merchant Suite"');
  assert(authCode.includes('Turn customer intent into revenue.'), 'MerchantAuth includes desktop value panel');
  assert(authCode.includes('Merchant Intelligence Platform'), 'MerchantAuth includes OptiCommerce branding header');
  assert(authCode.includes('login(email.trim(), password)'), 'MerchantAuth preserves existing login API invocation');
  assert(authCode.includes('register(name.trim(), email.trim(), password'), 'MerchantAuth preserves existing register API invocation');

  // 3. Global Codebase Isolation: Zero legacy experience state
  const srcFiles: string[] = [];
  function collectFiles(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectFiles(fullPath);
      } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
        srcFiles.push(fullPath);
      }
    }
  }
  collectFiles(path.join(process.cwd(), 'src'));

  let setExperienceFound = false;
  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('setExperience')) {
      setExperienceFound = true;
    }
  }
  assert(!setExperienceFound, 'Zero occurrences of setExperience across all files in src/');

  // 4. API verification
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'merchant@opticommerce.io', password: 'Merchant@2026' }),
    });
    const loginJson: any = await loginRes.json();
    assert(loginRes.status === 200 && Boolean(loginJson.data?.token), 'Valid credentials authenticate and return JWT token');

    const invalidRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'merchant@opticommerce.io', password: 'WrongPassword123' }),
    });
    assert(invalidRes.status === 401, 'Invalid credentials return 401 error response');

    const storeRes = await fetch(`${BASE_URL}/api/stores/opticommerce-flagship-electronics`);
    assert(storeRes.status === 200, 'Customer store lookup remains fully operational');
  } catch (err: any) {
    assert(false, 'Live API verification failed', err.message);
  }

  console.log(`\n==================================================`);
  console.log(`PHASE 2E RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log(`==================================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase2EVerification().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
