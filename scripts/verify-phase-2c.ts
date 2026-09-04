import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

async function runPhase2CVerification() {
  console.log('==================================================');
  console.log('STARTING PHASE 2C VERIFICATION TEST SUITE');
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

  // 1. File Deletion: ExperienceSwitcher.tsx is deleted
  const switcherPath = path.join(process.cwd(), 'src/components/common/ExperienceSwitcher.tsx');
  assert(!fs.existsSync(switcherPath), 'ExperienceSwitcher.tsx file is completely deleted from disk');

  // 2. Code Inspection: CommerceContext.tsx
  const contextCode = fs.readFileSync(path.join(process.cwd(), 'src/context/CommerceContext.tsx'), 'utf-8');
  assert(!contextCode.includes("experience: 'merchant' | 'customer'"), 'CommerceContextType interface has NO experience property');
  assert(!contextCode.includes("setExperience: (exp: 'merchant' | 'customer')"), 'CommerceContextType interface has NO setExperience property');
  assert(!contextCode.includes("useState<'merchant' | 'customer'>"), 'CommerceContext has NO experience useState');
  assert(contextCode.includes('const isMerchantRoute ='), 'CommerceContext uses isMerchantRoute for store/merchant resolution');
  assert(contextCode.includes("window.location.pathname.startsWith('/merchant')"), 'isMerchantRoute checks window.location.pathname.startsWith(\'/merchant\')');
  assert(
    contextCode.includes('isMerchantRoute && isAuthenticated && merchantStore'),
    'Active store resolution uses isMerchantRoute && isAuthenticated && merchantStore'
  );
  assert(contextCode.includes('merchantTab: MerchantTab;'), 'CommerceContext PRESERVES merchantTab in interface');
  assert(contextCode.includes('customerTab: CustomerTab;'), 'CommerceContext PRESERVES customerTab in interface');

  // 3. Code Inspection: App.tsx
  const appCode = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
  assert(!appCode.includes('setExperience('), 'App.tsx has NO calls to setExperience');
  assert(!appCode.includes('experience,'), 'App.tsx does NOT destructure experience');
  assert(!appCode.includes('setExperience,'), 'App.tsx does NOT destructure setExperience');
  assert(!appCode.includes('Synchronize in-memory experience state'), 'App.tsx has NO legacy experience sync effect');
  assert(appCode.includes('merchantTab,'), 'App.tsx PRESERVES merchantTab');
  assert(appCode.includes('customerTab,'), 'App.tsx PRESERVES customerTab');

  // 4. Global Codebase Audit: setExperience
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
      console.error(`Found setExperience in ${file}`);
      setExperienceFound = true;
    }
  }
  assert(!setExperienceFound, 'Zero occurrences of setExperience across all files in src/');

  // 5. API & Route verification
  try {
    const storeRes = await fetch(`${BASE_URL}/api/stores/opticommerce-flagship-electronics`);
    const storeData: any = await storeRes.json();
    assert(storeRes.status === 200 && storeData.data?.slug === 'opticommerce-flagship-electronics', 'Flagship store API returns 200');

    const loginRes = await fetch(`${BASE_URL}/store/opticommerce-flagship-electronics/login`);
    const loginHtml = await loginRes.text();
    assert(loginRes.status === 200 && loginHtml.includes('id="root"'), 'CustomerLogin route /store/:slug/login serves application shell');

    const authRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'merchant@opticommerce.io', password: 'Merchant@2026' }),
    });
    const authData: any = await authRes.json();
    assert(authRes.status === 200 && Boolean(authData.data?.token), 'Merchant authentication succeeds and issues JWT');
  } catch (err: any) {
    assert(false, 'Live API / route checks failed', err.message);
  }

  console.log(`\n==================================================`);
  console.log(`PHASE 2C RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log(`==================================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase2CVerification().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
