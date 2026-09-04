import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

async function runPhase2DVerification() {
  console.log('==================================================');
  console.log('STARTING PHASE 2D VERIFICATION TEST SUITE');
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

  // 1. MerchantLanding component exists
  const landingPath = path.join(process.cwd(), 'src/components/merchant/MerchantLanding.tsx');
  assert(fs.existsSync(landingPath), 'MerchantLanding.tsx component exists on disk');

  // 2. Code inspection of MerchantLanding
  const landingCode = fs.readFileSync(landingPath, 'utf-8');
  assert(landingCode.includes('Continue as Merchant'), 'MerchantLanding contains "Continue as Merchant" CTA');
  assert(landingCode.includes("onNavigate('/merchant/login')"), 'CTA navigates to /merchant/login');
  assert(landingCode.includes('AI-Native Commerce'), 'MerchantLanding contains hero headline/badge');
  assert(landingCode.includes('How OptiCommerce Increases Revenue'), 'MerchantLanding contains revenue growth section');
  assert(landingCode.includes('Intent → Revenue Flow'), 'MerchantLanding contains intent flow section');
  assert(landingCode.includes('Platform Capabilities'), 'MerchantLanding contains capabilities section');

  // 3. Routing in App.tsx
  const appCode = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
  assert(appCode.includes("const isMerchantLanding = currentPath === '/merchant' || currentPath === '/merchant/';"), 'App.tsx matches /merchant and /merchant/ as landing');
  assert(appCode.includes('<MerchantLanding onNavigate={navigate} />'), 'App.tsx renders MerchantLanding for landing route');

  // 4. Zero legacy experience state
  assert(!appCode.includes('setExperience('), 'App.tsx has NO calls to setExperience');
  assert(!appCode.includes('<ExperienceSwitcher'), 'ExperienceSwitcher is not in App.tsx');

  // 5. API checks
  try {
    const res = await fetch(`${BASE_URL}/api/stores/opticommerce-flagship-electronics`);
    assert(res.status === 200, 'Customer storefront store API remains 200');

    const authRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'merchant@opticommerce.io', password: 'Merchant@2026' }),
    });
    assert(authRes.status === 200, 'Merchant authentication remains 200');
  } catch (err: any) {
    assert(false, 'Live API checks failed', err.message);
  }

  console.log(`\n==================================================`);
  console.log(`PHASE 2D RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log(`==================================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase2DVerification().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
