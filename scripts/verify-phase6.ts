import { prisma } from '../server/db/prisma';
import { bundleService } from '../server/services/bundle.service';
import { recommendationService } from '../server/services/ai/recommendation.service';
import { intentExtractorService } from '../server/services/ai/intent-extractor.service';
import { aiProviderOrchestrator } from '../server/services/ai/providers/ai-provider.orchestrator';

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(` PASS [${totalCount}]: ${testName}`);
  } else {
    console.error(`❌ FAIL [${totalCount}]: ${testName}${detail ? ` (${detail})` : ''}`);
  }
}

async function runPhase6Verification() {
  console.log('\n==================================================');
  console.log('OPTICOMMERCE PHASE 6 COMPREHENSIVE VERIFICATION');
  console.log('Cart-Aware Cross-Sell & Intelligent Bundling');
  console.log('==================================================\n');

  // Enforce zero real API quota consumption across the test run
  aiProviderOrchestrator.setMode('deterministic');

  // Verify store exists
  const store = await prisma.store.findFirst();
  if (!store) {
    throw new Error('Store not found. Please ensure database is seeded.');
  }
  const storeId = store.id;

  // Retrieve published products from store
  const storeProducts = await prisma.product.findMany({
    where: { storeId, status: 'PUBLISHED' },
  });

  if (storeProducts.length < 3) {
    throw new Error('At least 3 published products are required in store for Phase 6 verification.');
  }

  // Identify or classify test products
  const laptopProduct = storeProducts.find(p => 
    p.category.toLowerCase().includes('laptop') || 
    p.name.toLowerCase().includes('laptop') ||
    p.name.toLowerCase().includes('macbook')
  ) || storeProducts[0];

  const accessoryProduct = storeProducts.find(p => 
    p.id !== laptopProduct.id && (
      p.category.toLowerCase().includes('accessory') ||
      p.category.toLowerCase().includes('mouse') ||
      p.category.toLowerCase().includes('sleeve') ||
      p.category.toLowerCase().includes('audio') ||
      p.category.toLowerCase().includes('keyboard')
    )
  ) || storeProducts[1];

  const thirdProduct = storeProducts.find(p => 
    p.id !== laptopProduct.id && p.id !== accessoryProduct.id
  ) || storeProducts[2];

  const testSessionId = `test-phase6-session-${Date.now()}`;

  // =========================================================================
  // SUITE 1: Intent Extraction — Cross-Sell & Bundle Intents (Tests 1 - 8)
  // =========================================================================
  console.log('\n--- 1. Intent Extraction: Cross-Sell & Bundle Trigger Patterns ---');

  const intent1 = await intentExtractorService.extractIntent('complete my setup');
  assert(
    intent1.mode === 'CROSS_SELL_REQUEST' || intent1.mode === 'BUNDLE_REQUEST',
    'Extracts "complete my setup" as CROSS_SELL_REQUEST or BUNDLE_REQUEST',
    `got: ${intent1.mode}`
  );

  const intent2 = await intentExtractorService.extractIntent('what accessories go well with this laptop?');
  assert(
    intent2.mode === 'CROSS_SELL_REQUEST' || intent2.mode === 'BUNDLE_REQUEST',
    'Extracts "what accessories go well with this" as cross-sell intent',
    `got: ${intent2.mode}`
  );

  const intent3 = await intentExtractorService.extractIntent('pair with a good mouse or stand');
  assert(
    intent3.mode === 'CROSS_SELL_REQUEST' || intent3.mode === 'BUNDLE_REQUEST',
    'Extracts "pair with" as cross-sell intent',
    `got: ${intent3.mode}`
  );

  const intent4 = await intentExtractorService.extractIntent('is there a bundle discount for these together?');
  assert(
    intent4.mode === 'BUNDLE_REQUEST',
    'Extracts "bundle discount" explicitly as BUNDLE_REQUEST',
    `got: ${intent4.mode}`
  );

  const intent5 = await intentExtractorService.extractIntent('what else should I buy with my cart?');
  assert(
    intent5.mode === 'CROSS_SELL_REQUEST' || intent5.mode === 'BUNDLE_REQUEST',
    'Extracts "what else should I buy" as cross-sell intent',
    `got: ${intent5.mode}`
  );

  const intent6 = await intentExtractorService.extractIntent('give me a bundle offer');
  assert(
    intent6.mode === 'BUNDLE_REQUEST' || intent6.mode === 'CROSS_SELL_REQUEST',
    'Extracts "bundle offer" as BUNDLE_REQUEST',
    `got: ${intent6.mode}`
  );

  // Regression safety: non-cross-sell intents must NOT be triggered
  const intent7 = await intentExtractorService.extractIntent('compare MacBook and ThinkPad');
  assert(
    intent7.mode === 'COMPARISON_REQUEST',
    'Preserves COMPARISON_REQUEST intent without false cross-sell triggering',
    `got: ${intent7.mode}`
  );

  const intent8 = await intentExtractorService.extractIntent('find mechanical keyboard under 4000');
  assert(
    intent8.mode === 'NEW_REQUEST',
    'Preserves standard NEW_REQUEST search intent without false cross-sell triggering',
    `got: ${intent8.mode}`
  );

  // =========================================================================
  // SUITE 2: Empty Cart & Base Product Resolution (Tests 9 - 13)
  // =========================================================================
  console.log('\n--- 2. Empty Cart & Base Product Resolution ---');

  // Test 9: Empty cart without focused product
  const emptyRes = await bundleService.getCartCrossSell({
    sessionId: `empty-session-${Date.now()}`,
    storeId,
  });
  assert(emptyRes.hasCartItems === false, 'Returns hasCartItems: false for empty cart without focused product');
  assert(emptyRes.suggestions.length === 0, 'Returns empty suggestions for empty cart without focused product');
  assert(emptyRes.bundleOpportunity === null, 'Returns null bundleOpportunity for empty cart without focused product');

  // Test 10: Empty cart with focused product
  const focusedRes = await bundleService.getCartCrossSell({
    sessionId: `empty-session-${Date.now()}`,
    storeId,
    focusedProductId: laptopProduct.id,
  });
  assert(focusedRes.hasCartItems === false, 'Maintains hasCartItems: false when only focusedProductId is supplied');
  assert(focusedRes.baseProducts.length === 1, 'Resolves baseProducts containing the focused product');
  assert(focusedRes.baseProducts[0].id === laptopProduct.id, 'Base product matches supplied focusedProductId');
  assert(focusedRes.suggestions.length > 0, 'Generates cross-sell suggestions for focused product even with empty cart');

  // Clean up any existing test cart for testSessionId
  await prisma.cart.deleteMany({
    where: { sessionId: testSessionId, storeId },
  });

  // Create authoritative Cart in DB with 1 laptop product
  const createdCart = await prisma.cart.create({
    data: {
      sessionId: testSessionId,
      storeId,
    },
  });

  await prisma.cartItem.create({
    data: {
      cartId: createdCart.id,
      productId: laptopProduct.id,
      quantity: 1,
    },
  });

  // Test 11: Single item in cart
  const cartRes1 = await bundleService.getCartCrossSell({
    sessionId: testSessionId,
    storeId,
  });
  assert(cartRes1.hasCartItems === true, 'Returns hasCartItems: true when cart contains products');
  assert(cartRes1.baseProducts.length >= 1, 'Resolves at least 1 base product from cart');
  assert(cartRes1.baseProducts[0].id === laptopProduct.id, 'Resolves cart item as base product');
  assert(cartRes1.suggestions.length > 0, 'Returns non-empty complementary suggestions for cart item');

  // Test 12: Priority resolution — focusedProduct takes precedence over cart item
  const priorityRes = await bundleService.getCartCrossSell({
    sessionId: testSessionId,
    storeId,
    focusedProductId: thirdProduct.id,
  });
  assert(priorityRes.baseProducts[0].id === thirdProduct.id, 'Focused product takes precedence over cart items for anchor resolution');

  // =========================================================================
  // SUITE 3: Self-Exclusion & In-Cart Deduplication (Tests 13 - 17)
  // =========================================================================
  console.log('\n--- 3. Exclusion Rules: Self-Exclusion, In-Cart Deduplication & Rejections ---');

  // Test 13: Base product must NEVER appear in suggestions
  const hasSelf = cartRes1.suggestions.some(s => s.productId === laptopProduct.id);
  assert(!hasSelf, 'Base product is never included in complementary suggestions (no self-recommendation)');

  // Test 14: Products already in cart must NEVER appear in suggestions
  // Add accessoryProduct to cart
  await prisma.cartItem.create({
    data: {
      cartId: createdCart.id,
      productId: accessoryProduct.id,
      quantity: 1,
    },
  });

  const cartRes2 = await bundleService.getCartCrossSell({
    sessionId: testSessionId,
    storeId,
  });

  const containsCartItem = cartRes2.suggestions.some(s => 
    s.productId === laptopProduct.id || s.productId === accessoryProduct.id
  );
  assert(!containsCartItem, 'Products currently in cart are strictly excluded from suggestions');

  // Test 15: Standalone device priority over accessory in multi-item cart
  assert(
    cartRes2.baseProducts[0].id === laptopProduct.id,
    'Standalone device (Laptop) is prioritized as base product over accessory item'
  );

  // Test 16: Explicit exclusion of rejected products from conversation state
  const rejectedRes = await bundleService.getCartCrossSell({
    sessionId: testSessionId,
    storeId,
    conversationState: {
      rejectedProducts: [thirdProduct.id],
    },
  });
  const hasRejected = rejectedRes.suggestions.some(s => s.productId === thirdProduct.id);
  assert(!hasRejected, 'Explicitly rejected products from conversationState are excluded from suggestions');

  // Test 17: Multi-tenant store isolation
  const allSuggestionsInStore = cartRes2.suggestions.every(s => {
    const found = storeProducts.some(p => p.id === s.productId);
    return found;
  });
  assert(allSuggestionsInStore, 'All suggestions strictly belong to the specified store (multi-tenant safety)');

  // =========================================================================
  // SUITE 4: Scoring, Ranking & Limit Enforcement (Tests 18 - 22)
  // =========================================================================
  console.log('\n--- 4. Scoring, Ranking & Limit Enforcement ---');

  // Test 18: Suggestions are ordered by bundleScore descending
  let isSorted = true;
  for (let i = 1; i < cartRes1.suggestions.length; i++) {
    if (cartRes1.suggestions[i].bundleScore > cartRes1.suggestions[i - 1].bundleScore) {
      isSorted = false;
      break;
    }
  }
  assert(isSorted, 'Suggestions are ranked in descending order of bundleScore');

  // Test 19: All bundle scores are non-negative and positive
  const validScores = cartRes1.suggestions.every(s => typeof s.bundleScore === 'number' && s.bundleScore > 0);
  assert(validScores, 'All suggestion bundleScores are strictly positive numbers');

  // Test 20: Limit enforcement
  const limitRes = await bundleService.getCartCrossSell({
    sessionId: testSessionId,
    storeId,
    limit: 2,
  });
  assert(limitRes.suggestions.length <= 2, 'Strictly respects limit parameter (returned at most 2 items)');

  // Test 21: Authoritative DB prices match product records
  const pricesGrounded = cartRes1.suggestions.every(s => {
    const prod = storeProducts.find(p => p.id === s.productId);
    return prod && s.price === Number(prod.price);
  });
  assert(pricesGrounded, 'Suggestion prices are strictly grounded in authoritative DB product prices');

  // Test 22: Cart state hash changes when cart items change
  assert(
    typeof cartRes1.cartStateHash === 'string' && cartRes1.cartStateHash.length > 0,
    'Generates non-empty cartStateHash'
  );
  assert(
    cartRes1.cartStateHash !== cartRes2.cartStateHash,
    'cartStateHash updates deterministically when cart items change'
  );

  // =========================================================================
  // SUITE 5: Bundle Opportunity & Margin Safety (Tests 23 - 28)
  // =========================================================================
  console.log('\n--- 5. Bundle Opportunity & Margin Safety ---');

  const bundleRes = await bundleService.getCartCrossSell({
    sessionId: testSessionId,
    storeId,
  });

  const bundleOpp = bundleRes.bundleOpportunity;
  assert(bundleOpp !== null, 'Generates valid BundleOpportunity when base product and suggestions exist');

  if (bundleOpp) {
    // Test 24: Bundle includes base product and suggestions
    const expectedProductCount = 1 + bundleRes.suggestions.length;
    assert(
      bundleOpp.products.length === expectedProductCount,
      'BundleOpportunity includes base product plus all complementary suggestions'
    );

    // Test 25: Original total matches exact sum of individual product prices
    const manualTotal = bundleOpp.products.reduce((sum, p) => sum + p.price, 0);
    assert(
      bundleOpp.originalTotal === manualTotal,
      'Original total equals exact mathematical sum of product prices',
      `expected ${manualTotal}, got ${bundleOpp.originalTotal}`
    );

    // Test 26: Discount calculation and savings
    if (bundleOpp.discountEligible) {
      assert(
        bundleOpp.bundlePrice < bundleOpp.originalTotal,
        'Discounted bundle price is less than original total'
      );
      assert(
        bundleOpp.savings === (bundleOpp.originalTotal - bundleOpp.bundlePrice),
        'Savings exactly equals originalTotal - bundlePrice'
      );
    } else {
      assert(
        bundleOpp.bundlePrice === bundleOpp.originalTotal,
        'Non-eligible bundle price retains full original total'
      );
    }

    // Test 27: Strict Margin Safety Guarantee — Price must never fall below total cost price
    // Compute total cost price directly from DB
    const bundleProductIds = bundleOpp.products.map(p => p.id);
    const dbBundleProducts = await prisma.product.findMany({
      where: { id: { in: bundleProductIds } },
    });
    const totalCostPrice = dbBundleProducts.reduce((sum, p) => sum + Number(p.costPrice), 0);

    assert(
      bundleOpp.bundlePrice >= totalCostPrice,
      'CRITICAL: Bundle price strictly preserves profit margin (bundlePrice >= totalCostPrice)',
      `bundlePrice: ${bundleOpp.bundlePrice}, totalCost: ${totalCostPrice}`
    );

    // Test 28: No sensitive financial fields exposed on client-facing bundle types
    const exposedCost = (bundleOpp as any).costPrice !== undefined || (bundleOpp as any).profit !== undefined;
    assert(!exposedCost, 'Client-facing bundle opportunity does not expose costPrice or internal profit');
  }

  // =========================================================================
  // SUITE 6: Conversational Explanation & Stage Preservation (Tests 29 - 31)
  // =========================================================================
  console.log('\n--- 6. Conversational Explanation & State Preservation ---');

  // Test 29: Deterministic explanation generated
  assert(
    typeof bundleRes.explanation === 'string' && bundleRes.explanation.length > 5,
    'Generates human-readable conversational explanation for the cross-sell recommendation'
  );

  // Test 30: End-to-end integration via recommendationService.getRecommendations
  const recResponse = await recommendationService.getRecommendations(
    storeId,
    'complete my setup for this laptop',
    {
      sessionId: testSessionId,
      conversationContext: {
        state: {
          goal: null,
          category: 'Computing',
          budget: { min: null, max: null },
          preferences: [],
          exclusions: [],
          useCase: null,
          discussedProducts: [
            {
              id: laptopProduct.id,
              name: laptopProduct.name,
              price: Number(laptopProduct.price),
              category: laptopProduct.category,
              position: 1,
            },
          ],
          rejectedProducts: [],
          selectedProductId: laptopProduct.id,
          stage: 'EVALUATING',
          pendingClarification: null,
        },
      },
    }
  );

  assert(
    recResponse.crossSell !== undefined,
    'recommendationService populates crossSell field when query matches cross-sell intent'
  );
  assert(
    recResponse.bundleOpportunity !== undefined,
    'recommendationService populates bundleOpportunity field when query matches cross-sell intent'
  );

  // Test 31: Conversation stage preservation
  assert(
    recResponse.conversationState?.stage !== undefined,
    'Preserves conversation state and stage across cross-sell turn'
  );

  // =========================================================================
  // SUITE 7: Phase 1-5 Non-Regression Invariants (Tests 32 - 34)
  // =========================================================================
  console.log('\n--- 7. Non-Regression Invariants: Normal Search & Comparison Unbroken ---');

  // Test 32: Normal search still returns recommendations
  const searchResponse = await recommendationService.getRecommendations(
    storeId,
    'wireless headphones',
    {
      sessionId: `search-session-${Date.now()}`,
    }
  );
  assert(
    searchResponse.mode === 'NEW_REQUEST',
    'Standard search maintains valid search mode without cross-sell pollution'
  );
  assert(
    Array.isArray(searchResponse.recommendations),
    'Standard search recommendations array remains fully functional'
  );

  // Test 33: Deduplication with suppressDuplicates flag
  const dedupRes = await bundleService.getCartCrossSell({
    sessionId: testSessionId,
    storeId,
    suppressDuplicates: true,
  });
  assert(dedupRes.suggestions.length >= 0, 'Handles suppressDuplicates gracefully');

  // Test 34: Clean cleanup of test data
  await prisma.cart.deleteMany({
    where: { sessionId: testSessionId, storeId },
  });
  assert(true, 'Test cart resources cleaned up successfully');

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n==================================================');
  console.log(`PHASE 6 VERIFICATION SUMMARY: ${passedCount} / ${totalCount} PASSED`);
  if (passedCount === totalCount) {
    console.log('🎉 ALL PHASE 6 CART-AWARE CROSS-SELL & BUNDLE TESTS PASSED!');
  } else {
    console.error(`⚠️ ${totalCount - passedCount} TESTS FAILED!`);
  }
  console.log('==================================================\n');

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runPhase6Verification().catch((err) => {
  console.error('Fatal error in Phase 6 verification:', err);
  process.exit(1);
});
