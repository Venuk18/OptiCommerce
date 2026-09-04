import assert from 'assert';
import fs from 'fs';
import path from 'path';

async function runPhase2FVerification() {
  console.log('==================================================');
  console.log('STARTING PHASE 2F VERIFICATION SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      fn();
      console.log(`[PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] Test ${total}: ${name}`);
      console.error('       Error:', err.message);
    }
  }

  // -------------------------------------------------------------
  // TASK 1: PRODUCT CATALOG AUDIT & IMPLEMENTATION CHECKS
  // -------------------------------------------------------------
  const catalogPath = path.join(process.cwd(), 'src', 'components', 'merchant', 'ProductCatalog.tsx');
  const catalogContent = fs.readFileSync(catalogPath, 'utf8');

  test('ProductCatalog imports createPortal from react-dom', () => {
    assert(
      catalogContent.includes("import { createPortal } from 'react-dom';") ||
      catalogContent.includes('from "react-dom";'),
      'Expected createPortal import from react-dom'
    );
  });

  test('ProductCatalog top-level container does NOT have animate-fadeIn', () => {
    assert(
      !catalogContent.includes('<div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">'),
      'Root container should not have animate-fadeIn'
    );
    assert(
      catalogContent.includes('<div className="p-8 max-w-7xl mx-auto space-y-8">'),
      'Root container should have clean p-8 max-w-7xl mx-auto space-y-8'
    );
  });

  test('Add Product modal is wrapped in createPortal(..., document.body)', () => {
    assert(
      catalogContent.includes('showAddModal && typeof document !== \'undefined\' && createPortal(') ||
      catalogContent.includes('showAddModal && createPortal('),
      'showAddModal should use createPortal'
    );
  });

  test('CSV Import modal is wrapped in createPortal(..., document.body)', () => {
    assert(
      catalogContent.includes('showCSVModal && typeof document !== \'undefined\' && createPortal(') ||
      catalogContent.includes('showCSVModal && createPortal('),
      'showCSVModal should use createPortal'
    );
  });

  test('Existing product catalog handlers, state, and form fields are preserved', () => {
    assert(catalogContent.includes('handleCreateProduct'), 'handleCreateProduct must be preserved');
    assert(catalogContent.includes('handleConfirmCsvImport'), 'handleConfirmCsvImport must be preserved');
    assert(catalogContent.includes('handleGenerateAiDescription'), 'handleGenerateAiDescription must be preserved');
    assert(catalogContent.includes('productService.createProduct'), 'productService.createProduct must be preserved');
    assert(catalogContent.includes('STATUS_CONFIG'), 'STATUS_CONFIG must be preserved');
  });

  // -------------------------------------------------------------
  // TASK 2: REVENUE CHARTS & ANALYTICS CHECKS
  // -------------------------------------------------------------
  const chartsPath = path.join(process.cwd(), 'src', 'components', 'merchant', 'RevenueCharts.tsx');
  const chartsContent = fs.readFileSync(chartsPath, 'utf8');

  test('RevenueCharts component exists and exports RevenueCharts', () => {
    assert(fs.existsSync(chartsPath), 'RevenueCharts.tsx must exist');
    assert(chartsContent.includes('export function RevenueCharts'), 'Must export RevenueCharts component');
  });

  test('RevenueCharts includes 1: Revenue Trajectory line/area SVG chart', () => {
    assert(chartsContent.includes('Revenue Trajectory'), 'Chart 1 title must exist');
    assert(chartsContent.includes('<svg'), 'Must use native SVG');
    assert(chartsContent.includes('linearGradient id="revenueGradient"'), 'Must have gradient area definition');
  });

  test('RevenueCharts includes 2: Order Volume Distribution SVG bar chart', () => {
    assert(chartsContent.includes('Order Volume Distribution'), 'Chart 2 title must exist');
    assert(chartsContent.includes('orderBars'), 'Must calculate order bars from authentic data');
  });

  test('RevenueCharts includes 3: Top Products by Revenue horizontal ranking chart', () => {
    assert(chartsContent.includes('Top Products by Revenue'), 'Chart 3 title must exist');
    assert(chartsContent.includes('topProducts'), 'Must aggregate top products from order items');
  });

  test('RevenueCharts includes 4: Channel Attribution Breakdown SVG donut chart', () => {
    assert(chartsContent.includes('Channel Attribution Breakdown'), 'Chart 4 title must exist');
    assert(chartsContent.includes('donutSegments'), 'Must calculate donut segments from attribution breakdown');
    assert(chartsContent.includes('strokeDasharray'), 'Must use native SVG donut circle');
  });

  test('RevenueCharts handles zero/empty state gracefully without hardcoded fake data', () => {
    assert(chartsContent.includes('No verified paid revenue recorded yet'), 'Zero revenue state handled');
    assert(chartsContent.includes('No order history available'), 'Zero orders state handled');
    assert(chartsContent.includes('No product sales yet'), 'Zero products state handled');
    assert(chartsContent.includes('No channel attribution recorded yet'), 'Zero attribution state handled');
  });

  const analyticsPath = path.join(process.cwd(), 'src', 'components', 'merchant', 'RevenueAnalytics.tsx');
  const analyticsContent = fs.readFileSync(analyticsPath, 'utf8');

  test('RevenueAnalytics imports and renders RevenueCharts', () => {
    assert(analyticsContent.includes("import { RevenueCharts } from './RevenueCharts';"), 'RevenueCharts import');
    assert(analyticsContent.includes('<RevenueCharts'), 'RevenueCharts rendering');
    assert(analyticsContent.includes('orders={orders}'), 'orders prop passed');
    assert(analyticsContent.includes('attribution={attribution}'), 'attribution prop passed');
  });

  test('merchantDashboardService provides getStoreOrders alias', () => {
    const servicePath = path.join(process.cwd(), 'src', 'services', 'merchant-dashboard.service.ts');
    const serviceContent = fs.readFileSync(servicePath, 'utf8');
    assert(serviceContent.includes('getStoreOrders('), 'getStoreOrders alias must be present');
  });

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n==================================================');
  console.log(`PHASE 2F RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('==================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runPhase2FVerification().catch((err) => {
  console.error('Fatal error running Phase 2F verification:', err);
  process.exit(1);
});
