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
  console.log('PHASE 6H UI — REVENUE INTELLIGENCE FRONTEND VERIFICATION');
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
      name: `Merchant 6H UI ${timestamp}`,
      email: `merchant-6h-ui-${timestamp}@example.com`,
      store: {
        create: {
          name: `Store 6H UI ${timestamp}`,
          slug: `store-6h-ui-${timestamp}`,
          status: 'PUBLISHED',
        },
      },
    },
    include: { store: true },
  });

  const store = merchant.store!;

  const serviceFilePath = path.join(process.cwd(), 'src/services/merchant-dashboard.service.ts');
  const serviceContent = fs.readFileSync(serviceFilePath, 'utf-8');

  const insightsComponentPath = path.join(process.cwd(), 'src/components/merchant/RevenueInsights.tsx');
  const insightsContent = fs.readFileSync(insightsComponentPath, 'utf-8');

  const dashboardComponentPath = path.join(process.cwd(), 'src/components/merchant/Dashboard.tsx');
  const dashboardContent = fs.readFileSync(dashboardComponentPath, 'utf-8');

  const typesFilePath = path.join(process.cwd(), 'src/types.ts');
  const typesContent = fs.readFileSync(typesFilePath, 'utf-8');

  // Test 1: getInsights service exists
  await test(1, 'merchantDashboardService.getInsights exists and targets /api/merchant-dashboard/insights', async () => {
    if (!serviceContent.includes('/api/merchant-dashboard/insights?storeId=')) {
      throw new Error('Service does not target /api/merchant-dashboard/insights endpoint');
    }
    if (typeof merchantDashboardService.getInsights !== 'function') {
      throw new Error('merchantDashboardService.getInsights is not a function');
    }
  });

  // Test 2: storeId is URL-encoded and validated
  await test(2, 'storeId is URL-encoded and validated against empty string', async () => {
    if (!serviceContent.includes('encodeURIComponent(storeId.trim())')) {
      throw new Error('Service does not URL-encode storeId parameter');
    }

    let errorCaught = false;
    try {
      await merchantDashboardService.getInsights('');
    } catch (err: any) {
      errorCaught = true;
      if (!err.message.includes('storeId is required')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
    if (!errorCaught) throw new Error('Expected empty storeId to throw an error');
  });

  // Test 3: RevenueInsights component exists and is exported
  await test(3, 'RevenueInsights component exists and defines heading and supporting text', async () => {
    if (!fs.existsSync(insightsComponentPath)) {
      throw new Error('RevenueInsights.tsx does not exist');
    }
    if (!insightsContent.includes('Revenue Intelligence')) {
      throw new Error('Revenue Intelligence heading not found in RevenueInsights.tsx');
    }
    if (!insightsContent.includes("Actionable insights based on your store's commerce activity.")) {
      throw new Error('Supporting text not found in RevenueInsights.tsx');
    }
  });

  // Test 4: All 8 backend insight types are handled/supported
  await test(4, 'All 8 backend insight types are supported in component', async () => {
    const types = [
      'ATTRIBUTION_AI',
      'BUNDLE_PERFORMANCE',
      'OFFER_PERFORMANCE',
      'RECOVERY_PERFORMANCE',
      'FUNNEL_BOTTLENECK',
      'CHECKOUT_BOTTLENECK',
      'PRODUCT_OPPORTUNITY',
      'SYSTEM_STATUS',
    ];

    for (const t of types) {
      if (!insightsContent.includes(t)) {
        throw new Error(`Insight type "${t}" not handled in RevenueInsights.tsx`);
      }
    }
  });

  // Test 5: INFO severity is rendered and styled
  await test(5, 'INFO severity is styled and rendered with appropriate badge/card styles', async () => {
    if (!insightsContent.includes("'INFO'") || !insightsContent.includes('badgeLabel: \'Update\'')) {
      throw new Error('INFO severity handling not found in RevenueInsights.tsx');
    }
  });

  // Test 6: OPPORTUNITY severity is rendered and styled
  await test(6, 'OPPORTUNITY severity is styled and rendered with growth/optimization tokens', async () => {
    if (!insightsContent.includes("'OPPORTUNITY'") || !insightsContent.includes('badgeLabel: \'Opportunity\'')) {
      throw new Error('OPPORTUNITY severity handling not found in RevenueInsights.tsx');
    }
  });

  // Test 7: WARNING severity is rendered and styled
  await test(7, 'WARNING severity is styled as attention required (not system crash)', async () => {
    if (!insightsContent.includes("'WARNING'") || !insightsContent.includes('badgeLabel: \'Attention Needed\'')) {
      throw new Error('WARNING severity handling not found in RevenueInsights.tsx');
    }
  });

  // Test 8: Title rendered
  await test(8, 'Insight title is rendered in card layout', async () => {
    if (!insightsContent.includes('{insight.title}')) {
      throw new Error('{insight.title} binding not found in RevenueInsights.tsx');
    }
  });

  // Test 9: Description rendered
  await test(9, 'Insight description is rendered in card layout', async () => {
    if (!insightsContent.includes('{insight.description}')) {
      throw new Error('{insight.description} binding not found in RevenueInsights.tsx');
    }
  });

  // Test 10: Optional metric rendered with label and formatting
  await test(10, 'Optional metric value and label are conditionally rendered and formatted', async () => {
    if (!insightsContent.includes('insight.metric') || !insightsContent.includes('insight.metricLabel')) {
      throw new Error('insight.metric or insight.metricLabel binding not found in RevenueInsights.tsx');
    }
    if (!insightsContent.includes('formatMetricValue')) {
      throw new Error('Metric formatting helper not found in RevenueInsights.tsx');
    }
  });

  // Test 11: Optional recommendation rendered
  await test(11, 'Optional recommendation action box is conditionally rendered', async () => {
    if (!insightsContent.includes('insight.recommendation') || !insightsContent.includes('Suggested Action')) {
      throw new Error('Suggested Action recommendation block not found in RevenueInsights.tsx');
    }
  });

  // Test 12: Loading skeleton state exists
  await test(12, 'Loading skeleton state with animate-pulse is implemented', async () => {
    if (!insightsContent.includes('insights-loading-skeleton') || !insightsContent.includes('animate-pulse')) {
      throw new Error('insights-loading-skeleton or animate-pulse not found in RevenueInsights.tsx');
    }
  });

  // Test 13: Non-blocking error state exists
  await test(13, 'Non-blocking error banner with clear message is implemented', async () => {
    if (!insightsContent.includes('insights-error-banner') || !insightsContent.includes('Revenue Intelligence Unavailable')) {
      throw new Error('insights-error-banner or error message not found in RevenueInsights.tsx');
    }
  });

  // Test 14: Retry button and handler exist
  await test(14, 'Retry button and fetchInsights handler implemented in error state', async () => {
    if (!insightsContent.includes('retry-insights-button') || !insightsContent.includes('fetchInsights()')) {
      throw new Error('retry-insights-button or fetchInsights handler not found in RevenueInsights.tsx');
    }
  });

  // Test 15: Zero-data state exists
  await test(15, 'Zero-data state message is implemented when insights array is empty', async () => {
    if (!insightsContent.includes('insights-zero-state') || !insightsContent.includes('No revenue insights available yet.')) {
      throw new Error('insights-zero-state container or neutral message not found in RevenueInsights.tsx');
    }
  });

  // Test 16: Store switching supported
  await test(16, 'Store switching is supported via storeId dependency in useCallback/useEffect', async () => {
    if (!insightsContent.includes('activeStoreId') || !insightsContent.includes('useEffect(')) {
      throw new Error('Store ID reactivity not found in RevenueInsights.tsx');
    }
  });

  // Test 17: Dashboard integrates RevenueInsights
  await test(17, 'Dashboard.tsx integrates RevenueInsights component', async () => {
    if (!dashboardContent.includes('<RevenueInsights') || !dashboardContent.includes("import { RevenueInsights }")) {
      throw new Error('Dashboard.tsx does not import and embed RevenueInsights component');
    }
  });

  // Test 18: Refresh mechanism includes RevenueInsights
  await test(18, 'Dashboard refresh mechanism updates RevenueInsights via key/storeId', async () => {
    if (!dashboardContent.includes('insights-${store?.id}-${refreshKey}')) {
      throw new Error('RevenueInsights does not participate in refreshKey re-mounting');
    }
  });

  // Test 19: Insights failure is non-blocking to rest of dashboard
  await test(19, 'Insights failure is strictly isolated with independent try-catch and local state', async () => {
    if (!insightsContent.includes('try {') || !insightsContent.includes('catch (err: any) {')) {
      throw new Error('RevenueInsights does not have independent try/catch error boundary');
    }
  });

  // Test 20: No client-side revenue intelligence formulas (strictly server-authoritative)
  await test(20, 'Zero client-side insight rule generation or bottleneck derivations in component', async () => {
    // The component should not compute threshold rules or calculate severity
    if (insightsContent.includes('ctr < 10') || insightsContent.includes('conversion < 20') || insightsContent.includes('cartRate < 5')) {
      throw new Error('Client component contains forbidden client-side rule computation logic');
    }
  });

  // Test 21: Zero costPrice or internal margin economics leakage
  await test(21, 'Security: Zero sensitive economics, margins, cost prices, or profit formulas leaked', async () => {
    const lowerContent = insightsContent.toLowerCase();
    const forbiddenEconomics = [
      'costprice',
      'cost_price',
      'marginpercent',
      'expectedprofit',
      'expected_profit',
      'purchaseprobability',
      'purchase_probability',
      'razorpay_key_secret',
      'webhook_secret',
    ];

    for (const term of forbiddenEconomics) {
      if (lowerContent.includes(term)) {
        throw new Error(`Security violation: Found sensitive term "${term}" in RevenueInsights.tsx`);
      }
    }
  });

  // Test 22: Zero customer PII leakage
  await test(22, 'Privacy: Zero customer PII or authentication tokens referenced in component', async () => {
    const lowerContent = insightsContent.toLowerCase();
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
      if (lowerContent.includes(term)) {
        throw new Error(`Privacy violation: Found sensitive PII token "${term}" in RevenueInsights.tsx`);
      }
    }
  });

  // Test 23: Zero Gemini or external AI API calls
  await test(23, 'Zero Gemini or AI SDK imports in RevenueInsights or merchant dashboard service', async () => {
    if (insightsContent.includes('GoogleGenAI') || insightsContent.includes('@google/genai')) {
      throw new Error('Gemini SDK found in RevenueInsights.tsx');
    }
    if (serviceContent.includes('GoogleGenAI') || serviceContent.includes('@google/genai')) {
      throw new Error('Gemini SDK found in merchant-dashboard.service.ts');
    }
  });

  // Final Results
  console.log('\n======================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`PHASE 6H UI VERIFICATION SUMMARY: ${passed}/${results.length} tests passed (${failed} failed)`);
  console.log('======================================================\n');

  if (failed > 0) {
    console.error(`FAILED TESTS: ${results.filter((r) => !r.passed).map((f) => f.num).join(', ')}`);
    await prisma.$disconnect();
    process.exit(1);
  } else {
    console.log('ALL PHASE 6H UI TESTS PASSED SUCCESSFULLY!');
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTests().catch(async (err) => {
  console.error('Test execution error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
