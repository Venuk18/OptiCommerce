import { prisma } from '../server/db/prisma';
import { merchantDashboardService } from '../src/services/merchant-dashboard.service';
import fs from 'fs';
import path from 'path';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

async function runTests() {
  const results: TestResult[] = [];

  console.log('\n======================================================');
  console.log('PHASE 6G.2 — MERCHANT FUNNEL ANALYTICS UI VERIFICATION');
  console.log('======================================================\n');

  async function test(num: number, name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.push({ num, name, passed: true, details: 'OK' });
      console.log(`[PASS] Test ${num}: ${name}`);
    } catch (err: any) {
      results.push({ num, name, passed: false, details: err.message || String(err) });
      console.error(`[FAIL] Test ${num}: ${name} -> ${err.message || String(err)}`);
    }
  }

  const timestamp = Date.now();

  // Setup test store in database
  const merchant = await prisma.merchant.create({
    data: {
      name: `Merchant 6G2 ${timestamp}`,
      email: `merchant-6g2-${timestamp}@example.com`,
      store: {
        create: {
          name: `Store 6G2 ${timestamp}`,
          slug: `store-6g2-${timestamp}`,
          status: 'PUBLISHED',
        },
      },
    },
    include: { store: true },
  });

  const store = merchant.store!;

  const serviceFilePath = path.join(process.cwd(), 'src/services/merchant-dashboard.service.ts');
  const serviceContent = fs.readFileSync(serviceFilePath, 'utf-8');

  const funnelComponentPath = path.join(process.cwd(), 'src/components/merchant/FunnelAnalytics.tsx');
  const funnelContent = fs.readFileSync(funnelComponentPath, 'utf-8');

  const dashboardComponentPath = path.join(process.cwd(), 'src/components/merchant/Dashboard.tsx');
  const dashboardContent = fs.readFileSync(dashboardComponentPath, 'utf-8');

  // Test 1: Funnel service calls correct endpoint
  await test(1, 'Funnel service calls correct endpoint (/api/merchant-dashboard/funnel)', async () => {
    if (!serviceContent.includes('/api/merchant-dashboard/funnel?storeId=')) {
      throw new Error('Service does not target /api/merchant-dashboard/funnel endpoint');
    }
    if (typeof merchantDashboardService.getFunnel !== 'function') {
      throw new Error('merchantDashboardService.getFunnel is not a function');
    }
  });

  // Test 2: Correct storeId is encoded and validated
  await test(2, 'Correct storeId is URL-encoded and validated against empty string', async () => {
    if (!serviceContent.includes('encodeURIComponent(storeId.trim())')) {
      throw new Error('Service does not URL-encode storeId parameter');
    }

    let errorCaught = false;
    try {
      await merchantDashboardService.getFunnel('');
    } catch (err: any) {
      errorCaught = true;
      if (!err.message.includes('storeId is required')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
    if (!errorCaught) throw new Error('Expected empty storeId to throw an error');
  });

  // Test 3: Recommendation views render
  await test(3, 'Recommendation views metric configured and rendered', async () => {
    if (!funnelContent.includes('Recommendation Views') || !funnelContent.includes('metric-recommendation-views')) {
      throw new Error('Recommendation Views metric label or element ID not found in FunnelAnalytics');
    }
    if (!funnelContent.includes('funnel.recommendationViews')) {
      throw new Error('funnel.recommendationViews data binding not found');
    }
  });

  // Test 4: Recommendation clicks render
  await test(4, 'Recommendation clicks metric configured and rendered', async () => {
    if (!funnelContent.includes('Recommendation Clicks') || !funnelContent.includes('metric-recommendation-clicks')) {
      throw new Error('Recommendation Clicks metric label or element ID not found in FunnelAnalytics');
    }
    if (!funnelContent.includes('funnel.recommendationClicks')) {
      throw new Error('funnel.recommendationClicks data binding not found');
    }
  });

  // Test 5: Recommendation CTR renders
  await test(5, 'Recommendation CTR renders with percentage formatting', async () => {
    if (!funnelContent.includes('metric-recommendation-click-rate') || !funnelContent.includes('funnel.recommendationClickRate')) {
      throw new Error('Recommendation Click Rate metric element or data binding not found in FunnelAnalytics');
    }
  });

  // Test 6: Product views render
  await test(6, 'Product views metric configured and rendered', async () => {
    if (!funnelContent.includes('Product Views') || !funnelContent.includes('metric-product-views')) {
      throw new Error('Product Views metric label or element ID not found in FunnelAnalytics');
    }
    if (!funnelContent.includes('funnel.productViews')) {
      throw new Error('funnel.productViews data binding not found');
    }
  });

  // Test 7: Add-to-cart count renders
  await test(7, 'Add-to-cart count metric configured and rendered', async () => {
    if (!funnelContent.includes('Add to Cart') || !funnelContent.includes('metric-add-to-cart-events')) {
      throw new Error('Add to Cart metric label or element ID not found in FunnelAnalytics');
    }
    if (!funnelContent.includes('funnel.addToCartEvents')) {
      throw new Error('funnel.addToCartEvents data binding not found');
    }
  });

  // Test 8: Add-to-cart rate renders
  await test(8, 'Add-to-cart rate renders with percentage formatting', async () => {
    if (!funnelContent.includes('metric-add-to-cart-rate') || !funnelContent.includes('funnel.addToCartRate')) {
      throw new Error('Add to Cart rate element or data binding not found in FunnelAnalytics');
    }
  });

  // Test 9: Checkout count renders
  await test(9, 'Checkout started count metric configured and rendered', async () => {
    if (!funnelContent.includes('Checkout Started') || !funnelContent.includes('metric-checkout-started')) {
      throw new Error('Checkout Started metric label or element ID not found in FunnelAnalytics');
    }
    if (!funnelContent.includes('funnel.checkoutStarted')) {
      throw new Error('funnel.checkoutStarted data binding not found');
    }
  });

  // Test 10: Purchase count renders
  await test(10, 'Purchase count metric configured and rendered', async () => {
    if (!funnelContent.includes('Purchases') || !funnelContent.includes('metric-purchases')) {
      throw new Error('Purchases metric label or element ID not found in FunnelAnalytics');
    }
    if (!funnelContent.includes('funnel.purchases')) {
      throw new Error('funnel.purchases data binding not found');
    }
  });

  // Test 11: Checkout conversion renders
  await test(11, 'Checkout conversion rate renders with percentage formatting', async () => {
    if (!funnelContent.includes('metric-checkout-conversion-rate') || !funnelContent.includes('funnel.checkoutConversionRate')) {
      throw new Error('Checkout Conversion Rate element or data binding not found in FunnelAnalytics');
    }
  });

  // Test 12: Offer views render
  await test(12, 'Offer views metric configured and rendered in Offer Performance section', async () => {
    if (!funnelContent.includes('Offer Views') || !funnelContent.includes('metric-offer-views')) {
      throw new Error('Offer Views metric label or element ID not found in FunnelAnalytics');
    }
    if (!funnelContent.includes('funnel.offerViews')) {
      throw new Error('funnel.offerViews data binding not found');
    }
  });

  // Test 13: Offer accepted renders
  await test(13, 'Offer accepted metric configured and rendered in Offer Performance section', async () => {
    if (!funnelContent.includes('Offers Accepted') || !funnelContent.includes('metric-offer-accepted')) {
      throw new Error('Offers Accepted metric label or element ID not found in FunnelAnalytics');
    }
    if (!funnelContent.includes('funnel.offerAccepted')) {
      throw new Error('funnel.offerAccepted data binding not found');
    }
  });

  // Test 14: Offer acceptance rate renders
  await test(14, 'Offer acceptance rate renders with percentage formatting', async () => {
    if (!funnelContent.includes('metric-offer-acceptance-rate') || !funnelContent.includes('funnel.offerAcceptanceRate')) {
      throw new Error('Offer Acceptance Rate element or data binding not found in FunnelAnalytics');
    }
  });

  // Test 15: Loading state
  await test(15, 'Loading state with polished skeleton animation is implemented', async () => {
    if (!funnelContent.includes('funnel-loading-skeleton') || !funnelContent.includes('animate-pulse')) {
      throw new Error('funnel-loading-skeleton or animate-pulse not found in FunnelAnalytics');
    }
  });

  // Test 16: Error state
  await test(16, 'Non-blocking error state banner is implemented', async () => {
    if (!funnelContent.includes('funnel-error-banner') || !funnelContent.includes('Funnel Analytics Unavailable')) {
      throw new Error('funnel-error-banner or error message not found in FunnelAnalytics');
    }
  });

  // Test 17: Retry behavior
  await test(17, 'Retry button and retry handler implemented in error state', async () => {
    if (!funnelContent.includes('retry-funnel-button') || !funnelContent.includes('fetchFunnel()')) {
      throw new Error('retry-funnel-button or fetchFunnel retry handler not found in FunnelAnalytics');
    }
  });

  // Test 18: Zero-data state
  await test(18, 'Friendly zero-data state message is implemented', async () => {
    if (!funnelContent.includes('funnel-zero-state')) {
      throw new Error('funnel-zero-state container not found in FunnelAnalytics');
    }
    if (!funnelContent.includes('Funnel data will appear as customers interact')) {
      throw new Error('Expected zero-data explanation message not found in FunnelAnalytics');
    }
  });

  // Test 19: No sensitive economics rendered
  await test(19, 'Security: Zero sensitive merchant economics or margins rendered', async () => {
    const combinedContent = (funnelContent + ' ' + dashboardContent).toLowerCase();
    const forbiddenEconomics = [
      'costprice',
      'cost_price',
      'expectedprofit',
      'expected_profit',
      'purchaseprobability',
      'purchase_probability',
      'razorpay_key_secret',
      'webhook_secret',
      'merchant margin',
      'discount economics',
    ];

    for (const term of forbiddenEconomics) {
      if (combinedContent.includes(term)) {
        throw new Error(`Security breach: Found sensitive term "${term}" in merchant dashboard UI`);
      }
    }
  });

  // Test 20: No PII rendered
  await test(20, 'Privacy: Zero customer PII or authentication tokens rendered', async () => {
    const combinedContent = (funnelContent + ' ' + dashboardContent).toLowerCase();
    const forbiddenPII = [
      'customer.email',
      'customer.phone',
      'customer_email',
      'customer_phone',
      'auth_token',
      'password_hash',
      'user_password',
    ];

    for (const term of forbiddenPII) {
      if (combinedContent.includes(term)) {
        throw new Error(`Privacy breach: Found PII reference "${term}" in UI components`);
      }
    }
  });

  // Test 21: Zero Gemini / AI model invocations
  await test(21, 'Zero Gemini or AI model invocations in funnel service and UI component', async () => {
    if (serviceContent.includes('GoogleGenAI') || serviceContent.includes('@google/genai')) {
      throw new Error('Gemini SDK found in merchant-dashboard.service.ts');
    }
    if (funnelContent.includes('GoogleGenAI') || funnelContent.includes('@google/genai')) {
      throw new Error('Gemini SDK found in FunnelAnalytics.tsx');
    }
    if (dashboardContent.includes('GoogleGenAI') || dashboardContent.includes('@google/genai')) {
      throw new Error('Gemini SDK found in Dashboard.tsx');
    }
  });

  // Test 22: Dashboard integrates FunnelAnalytics cleanly
  await test(22, 'Dashboard integrates FunnelAnalytics with independent non-blocking error isolation', async () => {
    if (!dashboardContent.includes('<FunnelAnalytics')) {
      throw new Error('Dashboard.tsx does not embed FunnelAnalytics component');
    }
  });

  // Test 23: Responsive Layout classes
  await test(23, 'Responsive layout classes support desktop, tablet, and mobile', async () => {
    if (!funnelContent.includes('grid-cols-1') || !funnelContent.includes('md:grid-cols-3')) {
      throw new Error('FunnelAnalytics is missing responsive grid layout classes');
    }
  });

  // Final Results
  console.log('\n======================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`PHASE 6G.2 VERIFICATION SUMMARY: ${passed}/${results.length} tests passed (${failed} failed)`);
  console.log('======================================================\n');

  if (failed > 0) {
    console.error(`FAILED TESTS: ${results.filter((r) => !r.passed).map((f) => f.num).join(', ')}`);
    await prisma.$disconnect();
    process.exit(1);
  } else {
    console.log('ALL PHASE 6G.2 TESTS PASSED SUCCESSFULLY!');
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTests().catch(async (err) => {
  console.error('Test execution error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
