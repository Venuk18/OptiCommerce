import { recommendationService } from '../server/services/ai/recommendation.service';
import { candidateRetrievalService } from '../server/services/ai/candidate-retrieval.service';
import { productRankingService } from '../server/services/ai/product-ranking.service';
import { prisma } from '../server/db/prisma';
import { ConversationState, createInitialConversationState } from '../src/types';

async function runPhase1Tests() {
  console.log('=== RUNNING PHASE 1 VERIFICATION TESTS ===\n');
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, desc: string) {
    totalCount++;
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
      process.exitCode = 1;
    }
  }

  // Find store
  const store = await prisma.store.findFirst();

  if (!store) {
    throw new Error('Default store not found');
  }

  const storeId = store.id;
  console.log(`Target store: ${store.name} (${storeId})\n`);

  // ==========================================
  // TEST A: Query returns maximum 3 recommendations and discussedProducts
  // ==========================================
  console.log('--- TEST A: Max 3 recommendations and discussedProducts ---');
  const resultA = await recommendationService.getRecommendations(
    storeId,
    'I need wireless headphones under ₹5000'
  );

  assert(resultA.recommendations.length <= 3, `Recommendations length <= 3 (got ${resultA.recommendations.length})`);
  assert(resultA.recommendations.length > 0, `Returned at least 1 relevant recommendation (got ${resultA.recommendations.length})`);
  assert(!!resultA.conversationState, 'conversationState is returned in response');
  assert(
    (resultA.conversationState?.discussedProducts.length ?? 0) === resultA.recommendations.length,
    `discussedProducts count matches recommendation count (${resultA.conversationState?.discussedProducts.length} === ${resultA.recommendations.length})`
  );

  resultA.conversationState?.discussedProducts.forEach((p, idx) => {
    assert(p.position === idx + 1, `discussedProduct ${p.name} has correct position ${idx + 1}`);
    assert(p.id === resultA.recommendations[idx].productId, `discussedProduct ${idx + 1} ID matches recommendation ID`);
  });

  // ==========================================
  // TEST B: Second query transports previous conversation context
  // ==========================================
  console.log('\n--- TEST B: Transport previous conversation context ---');
  const stateA = resultA.conversationState!;
  const resultB = await recommendationService.getRecommendations(
    storeId,
    'Something with strong bass',
    {
      conversationContext: {
        history: [
          { role: 'user', content: 'I need wireless headphones under ₹5000' },
          { role: 'assistant', content: 'I found 3 strong options' },
        ],
        state: stateA,
      },
    }
  );

  assert(resultB.recommendations.length <= 3, `Turn 2 recommendations length <= 3 (got ${resultB.recommendations.length})`);
  assert(!!resultB.conversationState, 'Turn 2 response returns updated conversationState');
  assert(
    resultB.conversationState?.preferences.some((p) => p.toLowerCase().includes('bass')) ||
      resultB.intent.preferences.some((p) => p.toLowerCase().includes('bass')),
    'Bass preference preserved in updated intent/conversationState'
  );

  // ==========================================
  // TEST C: Reference query preserves discussedProducts with positions
  // ==========================================
  console.log('\n--- TEST C: Preserves discussedProducts positions ---');
  assert(stateA.discussedProducts.length > 0, 'Initial state has discussed products');
  assert(
    stateA.discussedProducts.every((p) => typeof p.position === 'number' && p.position >= 1 && p.position <= 3),
    'All discussed products have valid positions (1, 2, 3)'
  );

  // ==========================================
  // TEST D: Cart product IDs passed to recommendation context
  // ==========================================
  console.log('\n--- TEST D: Cart product IDs in context ---');
  const firstRecommendedId = resultA.recommendations[0]?.productId;
  assert(!!firstRecommendedId, `First recommended product ID exists: ${firstRecommendedId}`);

  const resultD = await recommendationService.getRecommendations(
    storeId,
    'Show complementary accessories',
    {
      conversationContext: {
        state: stateA,
      },
      cartProductIds: [firstRecommendedId],
      sessionId: 'test-session-phase1',
    }
  );
  assert(resultD.recommendations.length <= 3, `Recommendations capped at 3 with cart context (got ${resultD.recommendations.length})`);
  assert(!!resultD.conversationState, 'Returned conversationState with cart context');

  // ==========================================
  // TEST E: Narrow query recommendations cap at <= 3 and are strictly relevant
  // ==========================================
  console.log('\n--- TEST E: No padding with weak products ---');
  const resultE = await recommendationService.getRecommendations(
    storeId,
    'RuggedVault 2TB Portable External SSD'
  );
  assert(resultE.recommendations.length <= 3, `Recommendations <= 3 (got ${resultE.recommendations.length})`);
  console.log(`Candidate count for specific SSD: ${resultE.recommendations.length}`);
  if (resultE.products && resultE.products.length > 0) {
    const allRelevantToSSD = resultE.products.every(
      (p) =>
        p.category === 'Storage' ||
        p.name.toLowerCase().includes('ssd') ||
        p.name.toLowerCase().includes('vault') ||
        p.name.toLowerCase().includes('drive')
    );
    assert(allRelevantToSSD, 'All returned products are genuinely related to SSD/Storage');
  }

  // ==========================================
  // TEST F: Zero relevant products query returns zero products
  // ==========================================
  console.log('\n--- TEST F: Zero matches query ---');
  const resultF = await recommendationService.getRecommendations(
    storeId,
    'flying car with quantum propulsion teleportation engine under ₹50'
  );
  assert(resultF.recommendations.length === 0, `Zero products returned for impossible query (got ${resultF.recommendations.length})`);
  assert(resultF.products?.length === 0, 'Candidate products array is empty for zero matches');

  // ==========================================
  // TEST G: Existing regression tests (Store isolation & stock)
  // ==========================================
  console.log('\n--- TEST G: Store isolation & stock protection ---');
  // Different store ID must return zero products
  const resultStoreIso = await recommendationService.getRecommendations(
    'non-existent-store-id-99999',
    'wireless headphones'
  );
  assert(resultStoreIso.recommendations.length === 0, 'Non-existent store returns zero recommendations');

  // Backward-compatibility: calling without options works seamlessly
  const resultBackwardCompat = await recommendationService.getRecommendations(
    storeId,
    'ergonomic office mouse'
  );
  assert(resultBackwardCompat.recommendations.length <= 3, 'Legacy call signature works and caps at 3');
  assert(Array.isArray(resultBackwardCompat.recommendations), 'Legacy response has recommendations array');

  console.log(`\n==========================================`);
  console.log(`PHASE 1 VERIFICATION: ${passedCount}/${totalCount} TESTS PASSED`);
  console.log(`==========================================\n`);

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runPhase1Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
