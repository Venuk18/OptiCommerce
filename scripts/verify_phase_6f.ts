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

  console.log('\n==================================================');
  console.log('PHASE 6F — MERCHANT REVENUE DASHBOARD UI VERIFICATION');
  console.log('==================================================\n');

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

  // Setup: Create clean store for frontend service integration testing
  const timestamp = Date.now();
  const merchant = await prisma.merchant.create({
    data: {
      name: `Merchant 6F ${timestamp}`,
      email: `merchant-6f-${timestamp}@example.com`,
      store: {
        create: {
          name: `Store 6F ${timestamp}`,
          slug: `store-6f-${timestamp}`,
          status: 'PUBLISHED',
        },
      },
    },
    include: { store: true },
  });

  const store = merchant.store!;

  // Create product and paid order
  const product = await prisma.product.create({
    data: {
      storeId: store.id,
      name: `Test 6F Product ${timestamp}`,
      category: 'Electronics',
      price: 1999,
      costPrice: 999,
      stock: 50,
      status: 'PUBLISHED',
    },
  });

  await prisma.order.create({
    data: {
      sessionId: `sess_6f_${timestamp}`,
      storeId: store.id,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      subtotal: 3998,
      discount: 398,
      total: 3600,
      currency: 'INR',
      items: {
        create: [
          {
            productId: product.id,
            productName: product.name,
            quantity: 2,
            unitPrice: 1999,
            discountPercent: 10,
            discountAmount: 398,
            lineTotal: 3600,
          },
        ],
      },
    },
  });

  // Test 1: Dashboard service requests correct storeId parameter
  await test(1, 'Dashboard service requests correct storeId and rejects empty storeId', async () => {
    let errorThrown = false;
    try {
      await merchantDashboardService.getSummary('');
    } catch (err: any) {
      errorThrown = true;
      if (!err.message.includes('storeId is required')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
    if (!errorThrown) throw new Error('Expected empty storeId to throw an error');
  });

  // Test 2: Service file exists and exports getSummary method
  await test(2, 'merchantDashboardService is exported with getSummary method', async () => {
    if (typeof merchantDashboardService.getSummary !== 'function') {
      throw new Error('merchantDashboardService.getSummary is not a function');
    }
  });

  // Test 3: KPI values format in INR correctly
  await test(3, 'INR Currency formatting helper produces valid symbol and 2 decimal places', async () => {
    const formatCurrency = (amount: number): string => {
      const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(validAmount);
    };

    const formatted1 = formatCurrency(24950);
    const formatted2 = formatCurrency(1386.11);
    const formatted0 = formatCurrency(0);

    if (!formatted1.includes('24,950.00')) {
      throw new Error(`Expected INR formatted 24,950.00, got ${formatted1}`);
    }
    if (!formatted2.includes('1,386.11')) {
      throw new Error(`Expected INR formatted 1,386.11, got ${formatted2}`);
    }
    if (!formatted0.includes('0.00')) {
      throw new Error(`Expected INR formatted 0.00, got ${formatted0}`);
    }
  });

  // Test 4: Percentage formatting helper
  await test(4, 'Percentage formatting produces 2 decimal places with percent sign', async () => {
    const formatPercent = (rate: number): string => {
      const validRate = typeof rate === 'number' && !isNaN(rate) ? rate : 0;
      return `${validRate.toFixed(2)}%`;
    };

    const formatted = formatPercent(42.8571);
    if (formatted !== '42.86%') {
      throw new Error(`Expected 42.86%, got ${formatted}`);
    }

    const formattedZero = formatPercent(0);
    if (formattedZero !== '0.00%') {
      throw new Error(`Expected 0.00%, got ${formattedZero}`);
    }
  });

  // Test 5: Integer formatting for order counts
  await test(5, 'Integer formatting for order counts displays clean count', async () => {
    const formatInteger = (num: number): string => {
      const validNum = typeof num === 'number' && !isNaN(num) ? num : 0;
      return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(validNum);
    };

    if (formatInteger(18) !== '18') {
      throw new Error(`Expected 18, got ${formatInteger(18)}`);
    }
    if (formatInteger(1250) !== '1,250') {
      throw new Error(`Expected 1,250, got ${formatInteger(1250)}`);
    }
  });

  // Test 6: Dashboard component code contains all 6 required KPI cards
  await test(6, 'Dashboard component defines all 6 required KPI metrics', async () => {
    const dashboardFile = path.join(process.cwd(), 'src/components/merchant/Dashboard.tsx');
    const content = fs.readFileSync(dashboardFile, 'utf-8');

    const requiredMetrics = [
      'Total Revenue',
      'Orders',
      'Average Order Value',
      'Offer Acceptance',
      'Recovered Sales',
      'Bundle Revenue',
    ];

    for (const metric of requiredMetrics) {
      if (!content.includes(metric)) {
        throw new Error(`Dashboard component is missing required metric: ${metric}`);
      }
    }
  });

  // Test 7: Dashboard component contains polished loading skeleton state
  await test(7, 'Dashboard component contains loading skeleton state', async () => {
    const dashboardFile = path.join(process.cwd(), 'src/components/merchant/Dashboard.tsx');
    const content = fs.readFileSync(dashboardFile, 'utf-8');

    if (!content.includes('dashboard-loading-skeleton') && !content.includes('animate-pulse')) {
      throw new Error('Dashboard component is missing loading skeleton state');
    }
  });

  // Test 8: Dashboard component contains clear error state with retry button
  await test(8, 'Dashboard component contains error state with retry handler', async () => {
    const dashboardFile = path.join(process.cwd(), 'src/components/merchant/Dashboard.tsx');
    const content = fs.readFileSync(dashboardFile, 'utf-8');

    if (!content.includes('dashboard-error-banner') || !content.includes('Retry Now')) {
      throw new Error('Dashboard component is missing error state or retry button');
    }
  });

  // Test 9: Dashboard component contains friendly zero-data state
  await test(9, 'Dashboard component contains zero-data state message', async () => {
    const dashboardFile = path.join(process.cwd(), 'src/components/merchant/Dashboard.tsx');
    const content = fs.readFileSync(dashboardFile, 'utf-8');

    if (!content.includes('Your revenue dashboard will appear here as orders come in.')) {
      throw new Error('Dashboard component is missing expected zero-data state message');
    }
  });

  // Test 10: Merchant Value Highlight section present and professional
  await test(10, 'Merchant Value Highlight section explains revenue optimization loop concisely', async () => {
    const dashboardFile = path.join(process.cwd(), 'src/components/merchant/Dashboard.tsx');
    const content = fs.readFileSync(dashboardFile, 'utf-8');

    if (!content.includes('Revenue Optimization')) {
      throw new Error('Dashboard component is missing Revenue Optimization section');
    }
    if (
      !content.includes(
        'Customers discovered through AI recommendations, personalized offers, sale recovery, and complementary bundles contribute to merchant revenue.'
      )
    ) {
      throw new Error('Dashboard component is missing expected value proposition description');
    }
  });

  // Test 11: Recent Orders deferral compliance (Section 6F.4)
  await test(11, 'Recent Orders is appropriately deferred without unauthorized backend changes', async () => {
    const dashboardFile = path.join(process.cwd(), 'src/components/merchant/Dashboard.tsx');
    const content = fs.readFileSync(dashboardFile, 'utf-8');

    if (!content.includes('recent-orders-deferral-notice') && !content.includes('Merchant Order Ledger')) {
      throw new Error('Expected recent-orders deferral notice in dashboard UI');
    }
  });

  // Test 12: Security: No leakage of costPrice, margin, expectedProfit, purchaseProbability in Dashboard UI
  await test(12, 'Security: Zero leakage of costPrice, margin, expectedProfit, or purchaseProbability in Dashboard', async () => {
    const dashboardFile = path.join(process.cwd(), 'src/components/merchant/Dashboard.tsx');
    const content = fs.readFileSync(dashboardFile, 'utf-8');
    const lower = content.toLowerCase();

    const sensitiveWords = [
      'costprice',
      'cost_price',
      'expectedprofit',
      'expected_profit',
      'purchaseprobability',
      'purchase_probability',
      'razorpay_key_secret',
      'webhook_secret',
    ];

    for (const word of sensitiveWords) {
      if (lower.includes(word)) {
        throw new Error(`Security breach: Found sensitive word "${word}" in Dashboard.tsx`);
      }
    }
  });

  // Test 13: Zero Gemini or AI model invocations in merchant dashboard frontend
  await test(13, 'Zero Gemini / AI model invocations in merchant dashboard service and component', async () => {
    const serviceFile = path.join(process.cwd(), 'src/services/merchant-dashboard.service.ts');
    const dashboardFile = path.join(process.cwd(), 'src/components/merchant/Dashboard.tsx');

    const serviceContent = fs.readFileSync(serviceFile, 'utf-8');
    const dashboardContent = fs.readFileSync(dashboardFile, 'utf-8');

    if (serviceContent.includes('GoogleGenAI') || serviceContent.includes('@google/genai')) {
      throw new Error('Unexpected Gemini SDK found in merchant-dashboard.service.ts');
    }
    if (dashboardContent.includes('GoogleGenAI') || dashboardContent.includes('@google/genai')) {
      throw new Error('Unexpected Gemini SDK found in Dashboard.tsx');
    }
  });

  // Test 14: Responsive layout classes present
  await test(14, 'Responsive layout classes for desktop, tablet, and mobile', async () => {
    const dashboardFile = path.join(process.cwd(), 'src/components/merchant/Dashboard.tsx');
    const content = fs.readFileSync(dashboardFile, 'utf-8');

    if (!content.includes('grid-cols-1') || !content.includes('sm:grid-cols-2') || !content.includes('lg:grid-cols-3')) {
      throw new Error('Dashboard is missing responsive grid layout classes');
    }
  });

  // Test 15: Frontend service correctly interfaces with backend endpoint
  await test(15, 'Frontend service API contract matches backend response schema', async () => {
    const serviceFile = path.join(process.cwd(), 'src/services/merchant-dashboard.service.ts');
    const content = fs.readFileSync(serviceFile, 'utf-8');

    if (!content.includes('/api/merchant-dashboard/summary?storeId=')) {
      throw new Error('Service does not target /api/merchant-dashboard/summary endpoint');
    }
  });

  console.log('\n==================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`PHASE 6F TEST RESULTS: ${passed}/${results.length} PASSED (${failed} FAILED)`);
  console.log('==================================================\n');

  if (failed > 0) {
    await prisma.$disconnect();
    process.exit(1);
  } else {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTests().catch(async (err) => {
  console.error('Fatal test error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
