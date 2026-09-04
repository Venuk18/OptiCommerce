import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

async function runPhase2BVerification() {
  console.log('==================================================');
  console.log('STARTING PHASE 2B VERIFICATION TEST SUITE');
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

  // 1. API: Flagship store lookup
  try {
    const res = await fetch(`${BASE_URL}/api/stores/opticommerce-flagship-electronics`);
    const json: any = await res.json();
    assert(
      res.status === 200 && json.success && json.data?.slug === 'opticommerce-flagship-electronics',
      'GET /api/stores/opticommerce-flagship-electronics returns canonical flagship store',
      `Got status ${res.status}, slug: ${json.data?.slug}`
    );
  } catch (err: any) {
    assert(false, 'GET /api/stores/opticommerce-flagship-electronics failed', err.message);
  }

  // 2. API: Non-existent store lookup returns 404 (triggering stale-store recovery)
  try {
    const res = await fetch(`${BASE_URL}/api/stores/non-existent-store-slug-12345`);
    const json: any = await res.json();
    assert(
      res.status === 404 && !json.success,
      'GET /api/stores/non-existent-store-slug-12345 returns 404 for stale recovery',
      `Got status ${res.status}`
    );
  } catch (err: any) {
    assert(false, 'Non-existent store lookup request failed', err.message);
  }

  // 3. API: Merchant authentication resolves merchant store slug
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'merchant@opticommerce.io',
        password: 'Merchant@2026',
      }),
    });
    const loginData: any = await loginRes.json();
    assert(
      loginRes.status === 200 && Boolean(loginData.data?.token) && loginData.data?.merchant?.store?.slug === 'opticommerce-flagship-electronics',
      'Merchant login returns merchant with store slug',
      `Token present: ${Boolean(loginData.data?.token)}, store slug: ${loginData.data?.merchant?.store?.slug}`
    );
  } catch (err: any) {
    assert(false, 'Merchant login test failed', err.message);
  }

  // 4. Client SPA routes serve index.html properly
  try {
    const storeRes = await fetch(`${BASE_URL}/store/opticommerce-flagship-electronics`);
    const storeHtml = await storeRes.text();
    assert(
      storeRes.status === 200 && storeHtml.toLowerCase().includes('<!doctype html>') && storeHtml.includes('id="root"'),
      'GET /store/:slug serves SPA application shell',
      `Status: ${storeRes.status}, contains root: ${storeHtml.includes('id="root"')}`
    );

    const loginRes = await fetch(`${BASE_URL}/store/opticommerce-flagship-electronics/login`);
    const loginHtml = await loginRes.text();
    assert(
      loginRes.status === 200 && loginHtml.includes('id="root"'),
      'GET /store/:slug/login serves SPA application shell',
      `Status: ${loginRes.status}`
    );
  } catch (err: any) {
    assert(false, 'SPA route response verification failed', err.message);
  }

  // 5. Code inspection: MerchantSidebar.tsx
  const sidebarCode = fs.readFileSync(path.join(process.cwd(), 'src/components/merchant/MerchantSidebar.tsx'), 'utf-8');
  assert(
    sidebarCode.includes('/store/${store?.slug || \'opticommerce-flagship-electronics\'}') &&
    sidebarCode.includes('target="_blank"') &&
    sidebarCode.includes('rel="noopener noreferrer"'),
    'MerchantSidebar "Launch Storefront" links directly to /store/:slug in new tab'
  );
  assert(
    !sidebarCode.includes("setExperience('customer')"),
    'MerchantSidebar has NO calls to setExperience(\'customer\')'
  );

  // 6. Code inspection: StoreManagement.tsx
  const storeMgmtCode = fs.readFileSync(path.join(process.cwd(), 'src/components/merchant/StoreManagement.tsx'), 'utf-8');
  assert(
    storeMgmtCode.includes('/store/${store?.slug || slug || \'opticommerce-flagship-electronics\'}') &&
    storeMgmtCode.includes('target="_blank"') &&
    storeMgmtCode.includes('View Live Store'),
    'StoreManagement "View Live Store" links directly to /store/:slug in new tab'
  );
  assert(
    storeMgmtCode.includes('handleCopy') && storeMgmtCode.includes('/store/'),
    'StoreManagement has Copy Storefront URL action pointing to /store/:slug'
  );
  assert(
    !storeMgmtCode.includes("setExperience('customer')"),
    'StoreManagement has NO calls to setExperience(\'customer\')'
  );

  // 7. Code inspection: CommerceContext.tsx
  const contextCode = fs.readFileSync(path.join(process.cwd(), 'src/context/CommerceContext.tsx'), 'utf-8');
  assert(
    contextCode.includes('getUrlStoreSlug') &&
    contextCode.includes('/^\\/store\\/([^/]+)/i'),
    'CommerceContext extracts urlSlug matching /store/:slug or /store/:slug/*'
  );
  assert(
    contextCode.includes('addEventListener(\'popstate\', handlePopState)'),
    'CommerceContext listens to popstate for browser navigation slug updates'
  );
  assert(
    contextCode.includes('FLAGSHIP_SLUG = \'opticommerce-flagship-electronics\'') &&
    contextCode.includes('Stale store slug detected'),
    'CommerceContext preserves stale customer store recovery and flagship fallback'
  );

  // 8. Code inspection: App.tsx
  const appCode = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
  assert(
    appCode.includes("window.dispatchEvent(new PopStateEvent('popstate'))"),
    'App.tsx navigate dispatches popstate event for synchronized routing'
  );
  assert(
    !appCode.includes('<ExperienceSwitcher'),
    'ExperienceSwitcher is not rendered in App.tsx'
  );

  console.log(`\n==================================================`);
  console.log(`PHASE 2B RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log(`==================================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase2BVerification().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
