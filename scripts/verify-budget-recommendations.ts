const BASE_URL = 'http://localhost:3000';
const STORE_ID = 'store-opticommerce-001';

async function testQuery(query: string) {
  const res = await fetch(`${BASE_URL}/api/ai/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storeId: STORE_ID,
      query,
    }),
  });

  const json: any = await res.json();
  return { status: res.status, data: json.data };
}

async function runTests() {
  console.log('==================================================');
  console.log('STARTING BUDGET-CONSTRAINED RECOMMENDATIONS TESTS');
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

  // Test 1: "I need a laptop for coding under 60000"
  try {
    const { status, data } = await testQuery('I need a laptop for coding under 60000');
    const recs = data?.recommendations || [];
    const prods = data?.products || [];
    const topRec = recs[0];
    const topProd = prods.find((p: any) => p.id === topRec?.productId);

    assert(
      status === 200 && recs.length > 0,
      'Test 1: "I need a laptop for coding under 60000" returns non-empty recommendations',
      `Got ${recs.length} recommendations`
    );

    assert(
      topRec?.productId === 'prod-029',
      'Test 1: prod-029 (AeroBook Air 14" at ₹64,999) is top nearest budget-relaxed candidate',
      `Top product: ${topRec?.productId} (${topProd?.name}) at ₹${topProd?.price}`
    );

    const hasNoAccessories = prods.every(
      (p: any) => (p.category === 'Computing' || p.category === 'Gaming') && !/sleeve|stand|cooling pad|mouse/i.test(p.name)
    );
    assert(
      hasNoAccessories,
      'Test 1: No accessories returned as substitutes for primary device laptop',
      `Products: ${prods.map((p: any) => p.name).join(', ')}`
    );

    const allText = [
      data?.message || '',
      data?.salesOverview || '',
      topRec?.whyRecommended || '',
      topRec?.reason || '',
      topRec?.tradeoff || '',
    ].join(' ');
    const acknowledgesAboveBudget = /above\s+(your\s+)?(budget|₹60,000)|closest\s+available|64,999/i.test(allText);
    assert(
      acknowledgesAboveBudget,
      'Test 1: Explanation honestly acknowledges price ₹64,999 is above ₹60,000 budget',
      `Text snippet: ${allText.slice(0, 200)}...`
    );
  } catch (err: any) {
    assert(false, 'Test 1 failed with error', err.message);
  }

  // Test 2: "laptop under 80000"
  try {
    const { status, data } = await testQuery('laptop under 80000');
    const recs = data?.recommendations || [];
    const prods = data?.products || [];

    assert(
      status === 200 && recs.length >= 3,
      'Test 2: "laptop under 80000" returns strict in-budget recommendations (>=3)',
      `Got ${recs.length} recommendations`
    );

    const allWithinBudget = prods.every((p: any) => p.price <= 80000);
    assert(
      allWithinBudget,
      'Test 2: All returned laptops are strictly within ₹80,000 budget',
      `Prices: ${prods.map((p: any) => p.price).join(', ')}`
    );

    const hasExpectedIds = ['prod-029', 'prod-032', 'prod-005'].every((id) =>
      prods.some((p: any) => p.id === id)
    );
    assert(
      hasExpectedIds,
      'Test 2: Contains prod-029, prod-032, prod-005 as in-budget candidates',
      `Found IDs: ${prods.map((p: any) => p.id).join(', ')}`
    );
  } catch (err: any) {
    assert(false, 'Test 2 failed with error', err.message);
  }

  // Test 3: "laptop sleeve under 2000"
  try {
    const { status, data } = await testQuery('laptop sleeve under 2000');
    const recs = data?.recommendations || [];
    const prods = data?.products || [];

    assert(
      status === 200 && recs.length > 0,
      'Test 3: "laptop sleeve under 2000" returns sleeve accessory',
      `Got ${recs.length} recommendations`
    );

    const allUnder2000Accessories = prods.every(
      (p: any) => p.price <= 2000 && (p.category === 'Accessories' || /sleeve|bag/i.test(p.name))
    );
    assert(
      allUnder2000Accessories,
      'Test 3: Returns accessories/sleeves under ₹2,000, no primary laptops',
      `Products: ${prods.map((p: any) => `${p.name} (₹${p.price})`).join(', ')}`
    );
  } catch (err: any) {
    assert(false, 'Test 3 failed with error', err.message);
  }

  // Test 4: "laptop"
  try {
    const { status, data } = await testQuery('laptop');
    const recs = data?.recommendations || [];
    const prods = data?.products || [];

    assert(
      status === 200 && recs.length >= 3,
      'Test 4: "laptop" returns top laptop recommendations without regression',
      `Got ${recs.length} recommendations`
    );

    const allAreLaptops = prods.every(
      (p: any) => (p.category === 'Computing' || p.category === 'Gaming') && !/sleeve|stand|cooling pad/i.test(p.name)
    );
    assert(
      allAreLaptops,
      'Test 4: All recommendations are laptops',
      `Products: ${prods.map((p: any) => p.name).join(', ')}`
    );
  } catch (err: any) {
    assert(false, 'Test 4 failed with error', err.message);
  }

  // Test 5: "wireless headphones under 5000"
  try {
    const { status, data } = await testQuery('wireless headphones under 5000');
    const recs = data?.recommendations || [];
    const prods = data?.products || [];

    assert(
      status === 200 && recs.length >= 3,
      'Test 5: "wireless headphones under 5000" returns strict in-budget audio options',
      `Got ${recs.length} recommendations`
    );

    const allWithin5000 = prods.every((p: any) => p.price <= 5000);
    assert(
      allWithin5000,
      'Test 5: All audio products strictly <= ₹5,000',
      `Prices: ${prods.map((p: any) => p.price).join(', ')}`
    );

    const expectedAudio = ['prod-001', 'prod-002', 'prod-003'].every((id) =>
      prods.some((p: any) => p.id === id)
    );
    assert(
      expectedAudio,
      'Test 5: Contains expected headphones (prod-001, prod-002, prod-003)',
      `Found IDs: ${prods.map((p: any) => p.id).join(', ')}`
    );
  } catch (err: any) {
    assert(false, 'Test 5 failed with error', err.message);
  }

  // Test 6: "laptop under 10000"
  try {
    const { status, data } = await testQuery('laptop under 10000');
    const recs = data?.recommendations || [];

    assert(
      status === 200 && recs.length === 0,
      'Test 6: "laptop under 10000" returns graceful empty state (no absurd 20% stretching)',
      `Got ${recs.length} recommendations (expected 0)`
    );

    assert(
      /no published products/i.test(data?.message || ''),
      'Test 6: Message indicates no matching products found',
      `Message: "${data?.message}"`
    );
  } catch (err: any) {
    assert(false, 'Test 6 failed with error', err.message);
  }

  console.log('\n==================================================');
  console.log(`TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('==================================================\n');

  if (passed === total) {
    console.log('SUCCESS: All 6 budget-constrained recommendation tests passed!');
    process.exit(0);
  } else {
    console.error(`FAILURE: ${total - passed} tests failed.`);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
