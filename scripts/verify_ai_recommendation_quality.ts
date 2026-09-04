import { prisma } from '../server/db/prisma';
import { recommendationService } from '../server/services/ai/recommendation.service';
import { isAccessoryProduct, candidateRetrievalService } from '../server/services/ai/candidate-retrieval.service';

interface QueryTestCase {
  id: string;
  query: string;
  expectedMinCount: number;
  expectedMaxCount: number;
  expectedCategories?: string[];
  disallowedCategories?: string[];
  disallowedKeywords?: string[];
  description: string;
}

async function runQualityVerification() {
  console.log('\n======================================================');
  console.log('AI RECOMMENDATION ENGINE QUALITY & PRECISION VERIFICATION');
  console.log('======================================================\n');

  // Find demo store
  const store = await prisma.store.findFirst();
  if (!store) {
    throw new Error('No store found in database.');
  }

  console.log(`Testing against store: ${store.name} (${store.id})\n`);

  const testCases: QueryTestCase[] = [
    {
      id: 'TC-1',
      query: 'I need wireless earbuds under ₹3000 with good battery life',
      expectedMinCount: 0,
      expectedMaxCount: 0,
      description: 'Budget < ₹3000 for earbuds: all earbuds cost >= ₹3999; accessories MUST NOT be returned',
    },
    {
      id: 'TC-2',
      query: 'laptop for a college student under ₹60000',
      expectedMinCount: 0,
      expectedMaxCount: 0,
      description: 'Budget < ₹60,000 for laptop: NovaBook is ₹199,999; sleeves/mice MUST NOT be returned',
    },
    {
      id: 'TC-3',
      query: 'wireless earbuds under ₹6000',
      expectedMinCount: 1,
      expectedMaxCount: 3,
      expectedCategories: ['Audio'],
      disallowedKeywords: ['case', 'sleeve', 'mouse', 'hub', 'charger'],
      description: 'Budget < ₹6000 for earbuds: ZenPods Pro (₹3,999) and ZenPods Max (₹4,499) must match, 0 accessories',
    },
    {
      id: 'TC-4',
      query: 'phone case under ₹1000',
      expectedMinCount: 1,
      expectedMaxCount: 2,
      expectedCategories: ['Accessories'],
      description: 'Explicit accessory request: ArmorShield Phone Case (₹799) must be returned',
    },
    {
      id: 'TC-5',
      query: 'running shoes under ₹3000',
      expectedMinCount: 0,
      expectedMaxCount: 0,
      description: 'Unrelated category: store does not sell footwear, should return 0 recommendations',
    },
  ];

  let passedTests = 0;
  let totalPrecisionSum = 0;

  for (const tc of testCases) {
    console.log(`\n--- Running ${tc.id}: "${tc.query}" ---`);
    console.log(`Intent: ${tc.description}`);

    const result = await recommendationService.getRecommendations(store.id, tc.query);

    const recs = result.recommendations || [];
    const prods = result.products || [];

    console.log(`Returned ${recs.length} recommendations:`);
    for (const r of recs) {
      const p = prods.find((x) => x.id === r.productId);
      console.log(`  - [Rank ${r.rank}] [${r.matchScore}%] ${p?.name || r.productId} (₹${p?.price || 0}) -> ${r.reason}`);
    }

    let isPassing = true;
    const errors: string[] = [];

    // 1. Check count bounds
    if (recs.length < tc.expectedMinCount || recs.length > tc.expectedMaxCount) {
      errors.push(`Count mismatch: expected between ${tc.expectedMinCount} and ${tc.expectedMaxCount}, got ${recs.length}`);
      isPassing = false;
    }

    // 2. Check disallowed keywords / accessories
    if (tc.disallowedKeywords && tc.disallowedKeywords.length > 0) {
      for (const r of recs) {
        const p = prods.find((x) => x.id === r.productId);
        const nameLower = (p?.name || '').toLowerCase();
        for (const kw of tc.disallowedKeywords) {
          if (nameLower.includes(kw)) {
            errors.push(`Disallowed keyword "${kw}" found in recommended product: "${p?.name}"`);
            isPassing = false;
          }
        }
      }
    }

    // 3. Compute Precision@3
    let precision = 1.0;
    if (recs.length > 0) {
      const relevantCount = recs.slice(0, 3).filter((r) => {
        const p = prods.find((x) => x.id === r.productId);
        if (!p) return false;
        if (tc.expectedCategories && !tc.expectedCategories.includes(p.category)) return false;
        if (tc.disallowedKeywords && tc.disallowedKeywords.some((kw) => (p.name || '').toLowerCase().includes(kw))) return false;
        return true;
      }).length;
      precision = relevantCount / Math.min(3, recs.length);
    } else {
      // If expected count is 0 and we got 0, precision is 100%
      precision = tc.expectedMaxCount === 0 ? 1.0 : 0.0;
    }

    totalPrecisionSum += precision;

    if (isPassing) {
      console.log(`✅ [PASS] ${tc.id} (Precision: ${(precision * 100).toFixed(0)}%)`);
      passedTests++;
    } else {
      console.log(`❌ [FAIL] ${tc.id}`);
      for (const err of errors) {
        console.log(`   Error: ${err}`);
      }
    }
  }

  const avgPrecision = totalPrecisionSum / testCases.length;
  console.log('\n======================================================');
  console.log(`SUMMARY: ${passedTests}/${testCases.length} tests passed`);
  console.log(`Average Precision@3: ${(avgPrecision * 100).toFixed(1)}%`);
  console.log('======================================================\n');

  if (passedTests < testCases.length || avgPrecision < 0.8) {
    process.exit(1);
  }
}

runQualityVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
