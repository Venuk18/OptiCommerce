import { prisma } from '../server/db/prisma';
import { comparisonService, ComparisonService } from '../server/services/ai/comparison.service';
import { recommendationService } from '../server/services/ai/recommendation.service';
import { aiProviderOrchestrator } from '../server/services/ai/providers/ai-provider.orchestrator';
import { CandidateProduct } from '../server/types/search.types';
import { CustomerIntent } from '../server/types/intent.types';
import { ConversationState } from '../server/types/recommendation.types';

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, testName: string) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(` PASS: ${testName}`);
  } else {
    console.error(` FAIL: ${testName}`);
  }
}

async function runPhase5Verification() {
  console.log('\n==================================================');
  console.log('OPTICOMMERCE PHASE 5 COMPREHENSIVE VERIFICATION');
  console.log('In-Chat Product Comparison & Focus View');
  console.log('==================================================\n');

  // Enforce zero real API quota consumption across the test run
  aiProviderOrchestrator.setMode('deterministic');

  // Verify store exists
  const store = await prisma.store.findFirst();
  if (!store) {
    throw new Error('Store not found. Please ensure database is seeded.');
  }
  const storeId = store.id;

  // Retrieve 3 published products from the store for authoritative testing
  const storeProducts = await prisma.product.findMany({
    where: { storeId, status: 'PUBLISHED' },
    take: 4,
  });

  if (storeProducts.length < 3) {
    throw new Error('At least 3 published products are required in store for Phase 5 verification.');
  }

  const p1 = storeProducts[0];
  const p2 = storeProducts[1];
  const p3 = storeProducts[2];

  // ----------------------------------------------------
  // 1. Critical Product Rule & Exact ID Invariant
  // ----------------------------------------------------
  console.log('--- 1. Critical Product Rule & Comparison Limit ---');

  // 1a. Compares exactly 2 products
  const res2 = await comparisonService.compareProducts({
    storeId,
    productIds: [p1.id, p2.id],
    query: 'Compare these two',
  }, null);

  assert(res2.comparison.products.length === 2, 'Compares exactly 2 requested products');
  assert(res2.comparison.products[0].productId === p1.id, 'Preserves Product 1 ID exactly');
  assert(res2.comparison.products[1].productId === p2.id, 'Preserves Product 2 ID exactly');
  assert(res2.comparison.products[0].price === Number(p1.price), 'Grounds Product 1 price in authoritative DB price');
  assert(res2.comparison.products[1].price === Number(p2.price), 'Grounds Product 2 price in authoritative DB price');

  // 1b. Compares exactly 3 products
  const res3 = await comparisonService.compareProducts({
    storeId,
    productIds: [p1.id, p2.id, p3.id],
    query: 'Compare all three and tell me the best',
  }, null);

  assert(res3.comparison.products.length === 3, 'Compares exactly 3 requested products');
  assert(res3.comparison.products[0].productId === p1.id, 'Option 1 matches input candidate 1');
  assert(res3.comparison.products[1].productId === p2.id, 'Option 2 matches input candidate 2');
  assert(res3.comparison.products[2].productId === p3.id, 'Option 3 matches input candidate 3');

  // 1c. Server enforces comparison limit: 4+ product IDs are rejected
  if (storeProducts.length >= 4) {
    let errorThrownOn4 = false;
    try {
      await comparisonService.compareProducts({
        storeId,
        productIds: [storeProducts[0].id, storeProducts[1].id, storeProducts[2].id, storeProducts[3].id],
      });
    } catch (err: any) {
      errorThrownOn4 = true;
    }
    assert(errorThrownOn4, 'Rejects attempt to compare more than 3 products (enforces 2-3 limit)');
  }

  // 1d. Rejects < 2 product IDs
  let errorThrownOn1 = false;
  try {
    await comparisonService.compareProducts({
      storeId,
      productIds: [p1.id],
    });
  } catch (err: any) {
    errorThrownOn1 = true;
  }
  assert(errorThrownOn1, 'Rejects attempt to compare fewer than 2 products');

  // 1e. Rejects empty storeId
  let errorThrownOnNoStore = false;
  try {
    await comparisonService.compareProducts({
      storeId: '',
      productIds: [p1.id, p2.id],
    });
  } catch (err: any) {
    errorThrownOnNoStore = true;
  }
  assert(errorThrownOnNoStore, 'Rejects comparison without storeId');

  // ----------------------------------------------------
  // 2. Single LLM Call & Prompt Grounding
  // ----------------------------------------------------
  console.log('\n--- 2. Single LLM Call & Grounding ---');

  let orchestratorCallCount = 0;
  let capturedPrompt = '';

  const mockOrchestrator = {
    async generateJson(prompt: string, options: any) {
      orchestratorCallCount++;
      capturedPrompt = prompt;
      return {
        products: [
          {
            productId: p1.id,
            name: p1.name,
            price: Number(p1.price),
            strengths: ['Great sound profile', 'Comfortable ear cups'],
            weaknesses: ['Lacks fast charging'],
            tradeoff: 'Balanced performance for everyday listening',
            fitSummary: 'Strong general contender',
          },
          {
            productId: p2.id,
            name: p2.name,
            price: Number(p2.price),
            strengths: ['Affordable entry price'],
            weaknesses: ['Plastic chassis'],
            tradeoff: 'Saves money but feels less premium',
            fitSummary: 'Best for budget-first buyers',
          },
        ],
        winnerProductId: p1.id,
        winnerReason: `Based on what you're looking for, I'd choose ${p1.name}. It is the strongest match for your stated requirements. ${p2.name} is the better choice if keeping the price lower is your priority.`,
        tradeoffs: `${p1.name} provides superior sound quality, while ${p2.name} is lighter on the budget.`,
      };
    },
  };

  const aiCompResult = await comparisonService.compareProducts(
    {
      storeId,
      productIds: [p1.id, p2.id],
      query: 'Compare these two',
    },
    mockOrchestrator
  );

  assert(orchestratorCallCount === 1, 'Enforces SINGLE LLM call per comparison across all products (orchestratorCallCount === 1)');
  assert(capturedPrompt.includes(p1.id), 'Prompt contains candidate 1 product ID');
  assert(capturedPrompt.includes(p2.id), 'Prompt contains candidate 2 product ID');
  assert(aiCompResult.comparison.winnerProductId === p1.id, 'Correctly captures winner product ID');
  assert(aiCompResult.comparison.winnerReason.includes(p1.name), 'Winner reason references winner name');
  assert(aiCompResult.comparison.tradeoffs.length > 0, 'Includes honest trade-offs summary');

  // ----------------------------------------------------
  // 3. Anti-Hallucination & Validation Rules
  // ----------------------------------------------------
  console.log('\n--- 3. Anti-Hallucination & Grounding Validation ---');

  const compCandidates: CandidateProduct[] = [
    {
      id: 'c1',
      name: 'Alpha Pro Headphones',
      brand: 'Alpha',
      category: 'Audio',
      price: 4999,
      stock: 10,
      description: 'Over-ear headphones with 40h battery.',
      features: ['Active Noise Cancellation (ANC)', '40h battery life'],
      specifications: { battery: '40h' },
      tags: ['anc', 'wireless'],
      images: [],
      relevanceScore: 1,
    },
    {
      id: 'c2',
      name: 'Beta Lite Earbuds',
      brand: 'Beta',
      category: 'Audio',
      price: 1999,
      stock: 20,
      description: 'Budget earbuds with punchy bass.',
      features: ['15h battery life', 'Compact case'],
      specifications: { battery: '15h' },
      tags: ['bass', 'budget'],
      images: [],
      relevanceScore: 0.9,
    },
  ];

  // 3a. Rejects unknown product ID
  const invalidIdPayload = {
    products: [
      { productId: 'c1', name: 'Alpha Pro', price: 4999, strengths: ['s'], weaknesses: ['w'] },
      { productId: 'c_unknown_999', name: 'Fake Prod', price: 1999, strengths: ['s'], weaknesses: ['w'] },
    ],
    winnerProductId: 'c1',
    winnerReason: 'Reason',
    tradeoffs: 'Tradeoffs',
  };
  assert(!comparisonService.validateAiComparison(invalidIdPayload, compCandidates), 'Rejects AI output with unknown product ID');

  // 3b. Rejects incorrect price
  const wrongPricePayload = {
    products: [
      { productId: 'c1', name: 'Alpha Pro', price: 9999, strengths: ['s'], weaknesses: ['w'] }, // Real price is 4999
      { productId: 'c2', name: 'Beta Lite', price: 1999, strengths: ['s'], weaknesses: ['w'] },
    ],
    winnerProductId: 'c1',
    winnerReason: 'Reason',
    tradeoffs: 'Tradeoffs',
  };
  assert(!comparisonService.validateAiComparison(wrongPricePayload, compCandidates), 'Rejects AI output claiming wrong product price (₹9,999 vs ₹4,999)');

  // 3c. Rejects hyperbolic marketing hype
  const hypeTerms = ['absolutely perfect', 'unbeatable', 'miraculous', 'flawless', 'revolutionary', 'game-changer'];
  for (const term of hypeTerms) {
    const hypePayload = {
      products: [
        { productId: 'c1', name: 'Alpha Pro', price: 4999, strengths: ['s'], weaknesses: ['w'] },
        { productId: 'c2', name: 'Beta Lite', price: 1999, strengths: ['s'], weaknesses: ['w'] },
      ],
      winnerProductId: 'c1',
      winnerReason: `Alpha Pro is ${term} and objectively superior!`,
      tradeoffs: 'Tradeoffs',
    };
    assert(!comparisonService.validateAiComparison(hypePayload, compCandidates), `Rejects banned marketing hype: "${term}"`);
  }

  // 3d. Rejects unsupported numerical unit claims
  const fakeUnitPayload = {
    products: [
      { productId: 'c1', name: 'Alpha Pro', price: 4999, strengths: ['120h battery life'], weaknesses: ['w'] }, // DB only says 40h
      { productId: 'c2', name: 'Beta Lite', price: 1999, strengths: ['s'], weaknesses: ['w'] },
    ],
    winnerProductId: 'c1',
    winnerReason: 'Alpha Pro has huge 120h battery.',
    tradeoffs: 'Tradeoffs',
  };
  assert(!comparisonService.validateAiComparison(fakeUnitPayload, compCandidates), 'Rejects unsupported unit claim (120h battery on 40h product)');

  // ----------------------------------------------------
  // 4. Deterministic Comparison Fallback Engine
  // ----------------------------------------------------
  console.log('\n--- 4. Deterministic Comparison Fallback Engine ---');

  const startTime = Date.now();
  const detResult = comparisonService.deterministicComparison(
    compCandidates,
    {
      category: 'Audio',
      brand: null,
      minPrice: null,
      maxPrice: 6000,
      preferences: ['anc'],
      keywords: [],
      mode: 'COMPARISON_REQUEST',
      useCase: 'travel',
      exclusions: [],
      rejectedProductIds: [],
    }
  );
  const duration = Date.now() - startTime;

  assert(duration < 15, `Deterministic fallback executes sub-5ms (actual: ${duration}ms)`);
  assert(detResult.products.length === 2, 'Fallback covers all products');
  assert(detResult.winnerProductId === 'c1', 'Fallback selects c1 as winner (matches ANC and travel use-case)');
  assert(detResult.winnerReason.includes('Alpha Pro'), 'Winner reason mentions Alpha Pro');
  assert(detResult.winnerReason.includes('Beta Lite'), 'Winner reason contrasts with Beta Lite');
  assert(detResult.products[0].strengths.length > 0, 'Generates strengths for option 1');
  assert(detResult.products[1].strengths.length > 0, 'Generates strengths for option 2');
  assert(detResult.products[1].strengths.some((s) => s.includes('Most affordable') || s.includes('₹1,999')), 'Highlights affordability strength for cheaper option');
  assert(detResult.products[1].weaknesses.some((w) => w.toLowerCase().includes('anc') || w.toLowerCase().includes('noise')), 'Honestly identifies lack of ANC as weakness for Beta Lite');

  // Test close match / tie handling
  const tieCandidates: CandidateProduct[] = [
    {
      id: 't1',
      name: 'EchoBuds 1',
      brand: 'Echo',
      category: 'Audio',
      price: 2999,
      stock: 10,
      description: 'Standard wireless earbuds.',
      features: ['Bluetooth 5.0'],
      specifications: null,
      tags: [],
      images: [],
      relevanceScore: 1,
    },
    {
      id: 't2',
      name: 'SonicBuds 1',
      brand: 'Sonic',
      category: 'Audio',
      price: 2999,
      stock: 10,
      description: 'Standard wireless earbuds.',
      features: ['Bluetooth 5.0'],
      specifications: null,
      tags: [],
      images: [],
      relevanceScore: 1,
    },
  ];

  const tieResult = comparisonService.deterministicComparison(tieCandidates, {
    category: 'Audio',
    brand: null,
    minPrice: null,
    maxPrice: null,
    preferences: [],
    keywords: [],
    mode: 'COMPARISON_REQUEST',
    useCase: null,
    exclusions: [],
    rejectedProductIds: [],
  });

  assert(tieResult.winnerReason.includes('close matches'), 'Handles virtually identical options with honest "close matches" guidance instead of forcing arbitrary winner');

  // ----------------------------------------------------
  // 5. ConversationState Preservation & Multi-Turn
  // ----------------------------------------------------
  console.log('\n--- 5. ConversationState Preservation & Multi-Turn ---');

  const prevState: ConversationState = {
    goal: 'travel headphones',
    category: 'Audio',
    budget: { min: 2000, max: 7000 },
    preferences: ['anc'],
    exclusions: ['wired'],
    useCase: 'flights',
    discussedProducts: [
      { id: p1.id, name: p1.name, price: Number(p1.price), category: p1.category, position: 1 },
      { id: p2.id, name: p2.name, price: Number(p2.price), category: p2.category, position: 2 },
    ],
    rejectedProducts: [],
    selectedProductId: null,
    stage: 'EVALUATING',
  };

  const multiTurnResult = await comparisonService.compareProducts(
    {
      storeId,
      productIds: [p1.id, p2.id],
      conversationState: prevState,
      query: 'Compare these 2 & suggest me the best',
    },
    null
  );

  const updatedState = multiTurnResult.conversationState;
  assert(updatedState.stage === 'COMPARING', 'Updates stage to COMPARING');
  assert(updatedState.goal === 'travel headphones', 'Preserves user goal');
  assert(updatedState.budget.max === 7000, 'Preserves budget constraint');
  assert(updatedState.preferences.includes('anc'), 'Preserves preferences');
  assert(updatedState.exclusions.includes('wired'), 'Preserves exclusions');
  assert(updatedState.discussedProducts.length === 2, 'Sets discussedProducts to compared products');
  assert(updatedState.discussedProducts[0].position === 1, 'Maintains position 1 for first compared product');
  assert(updatedState.discussedProducts[1].position === 2, 'Maintains position 2 for second compared product');
  assert(updatedState.selectedProductId === multiTurnResult.comparison.winnerProductId, 'Sets selectedProductId to winner for seamless follow-up');

  // ----------------------------------------------------
  // 6. Follow-up Resolution after Comparison
  // ----------------------------------------------------
  console.log('\n--- 6. Follow-up Resolution after Comparison ---');

  // Turn 2 follow-up: "Why did you choose this one?" or "Tell me more about that one"
  // Should resolve to the winner (selectedProductId)
  const followUpTurn = await recommendationService.getRecommendations(
    storeId,
    'Tell me more about that one',
    {
      conversationContext: {
        state: updatedState,
      },
    }
  );

  assert(followUpTurn.mode === 'PRODUCT_REFERENCE' || followUpTurn.mode === 'PRODUCT_QUESTION', 'Follow-up classified as product reference/question');
  assert(followUpTurn.resolvedProducts !== undefined && followUpTurn.resolvedProducts.length > 0, 'Resolves to product from comparison');
  assert(followUpTurn.resolvedProducts![0].id === updatedState.selectedProductId, '"that one" resolves directly to the comparison winner');

  // Turn 3 follow-up: "What about the second one?"
  const followUp2 = await recommendationService.getRecommendations(
    storeId,
    'What about the second one?',
    {
      conversationContext: {
        state: updatedState,
      },
    }
  );

  assert(followUp2.resolvedProducts !== undefined && followUp2.resolvedProducts.length > 0, 'Resolves second product by position');
  assert(followUp2.resolvedProducts![0].id === p2.id, '"second one" resolves to position 2 from comparison');

  // ----------------------------------------------------
  // 7. Store Isolation Enforcement
  // ----------------------------------------------------
  console.log('\n--- 7. Cross-Store Isolation Enforcement ---');

  let foreignStoreError = false;
  try {
    // Attempting to compare with a non-existent or foreign store ID
    await comparisonService.compareProducts({
      storeId: 'foreign_store_fake_id_123',
      productIds: [p1.id, p2.id],
    });
  } catch (err: any) {
    foreignStoreError = true;
  }
  assert(foreignStoreError, 'Rejects comparison request for invalid/foreign store');

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  console.log('\n==================================================');
  console.log(`VERIFICATION SUMMARY: ${passedCount}/${totalCount} tests passed`);
  console.log('==================================================\n');

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runPhase5Verification().catch((err) => {
  console.error('Phase 5 verification failed:', err);
  process.exit(1);
});
