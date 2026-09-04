import { recommendationService } from '../server/services/ai/recommendation.service';
import { intentExtractorService } from '../server/services/ai/intent-extractor.service';
import { referenceResolverService } from '../server/services/ai/reference-resolver.service';
import { prisma } from '../server/db/prisma';
import { DiscussedProduct, ConversationState } from '../server/types/recommendation.types';

async function runPhase2Tests() {
  console.log('=== RUNNING PHASE 2 VERIFICATION TESTS ===\n');
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

  // Find default store
  const store = await prisma.store.findFirst();
  if (!store) {
    throw new Error('Default store not found');
  }
  const storeId = store.id;
  console.log(`Target store: ${store.name} (${storeId})\n`);

  // Sample discussed products fixture
  const sampleDiscussedProducts: DiscussedProduct[] = [
    { id: 'prod-a', name: 'ZenAudio Pro ANC', price: 4999, category: 'headphones', position: 1 },
    { id: 'prod-b', name: 'BassMaster Go', price: 3999, category: 'headphones', position: 2 },
    { id: 'prod-c', name: 'AuraSound Pure', price: 4499, category: 'headphones', position: 3 },
  ];

  // ==========================================
  // SECTION 1: Reference Resolver Unit Tests
  // ==========================================
  console.log('--- SECTION 1: Reference Resolver Unit Tests ---');

  // 1.1 Ordinal references
  const refFirst = referenceResolverService.resolveReferences('tell me about the first one', sampleDiscussedProducts);
  assert(refFirst.resolved && refFirst.referencedPositions[0] === 1 && refFirst.referencedProductIds[0] === 'prod-a', 'Resolves "the first one" to position 1 (prod-a)');

  const refSecond = referenceResolverService.resolveReferences('tell me about the second one', sampleDiscussedProducts);
  assert(refSecond.resolved && refSecond.referencedPositions[0] === 2 && refSecond.referencedProductIds[0] === 'prod-b', 'Resolves "the second one" to position 2 (prod-b)');

  const refThird = referenceResolverService.resolveReferences('show the 3rd product', sampleDiscussedProducts);
  assert(refThird.resolved && refThird.referencedPositions[0] === 3 && refThird.referencedProductIds[0] === 'prod-c', 'Resolves "3rd product" to position 3 (prod-c)');

  const refLast = referenceResolverService.resolveReferences('tell me about the last one', sampleDiscussedProducts);
  assert(refLast.resolved && refLast.referencedPositions[0] === 3, 'Resolves "the last one" to position 3');

  // 1.2 Price comparatives (cheapest / cheaper / most expensive)
  const refCheaper = referenceResolverService.resolveReferences('which one is cheaper?', sampleDiscussedProducts);
  assert(refCheaper.resolved && refCheaper.referencedProductIds[0] === 'prod-b', 'Resolves "cheaper" deterministically to cheapest product (prod-b, ₹3999)');

  const refExpensive = referenceResolverService.resolveReferences('which is the most expensive one?', sampleDiscussedProducts);
  assert(refExpensive.resolved && refExpensive.referencedProductIds[0] === 'prod-a', 'Resolves "most expensive" to prod-a (₹4999)');

  // 1.3 Multiple references
  const refMultiple = referenceResolverService.resolveReferences('compare the first and third', sampleDiscussedProducts);
  assert(refMultiple.resolved && refMultiple.mode === 'multiple', 'Recognizes multiple product reference mode');
  assert(refMultiple.referencedPositions.includes(1) && refMultiple.referencedPositions.includes(3), 'Resolves positions [1, 3] for "first and third"');

  // 1.4 Pronoun references
  const refPronoun = referenceResolverService.resolveReferences('why this one?', sampleDiscussedProducts, 'prod-b');
  assert(refPronoun.resolved && refPronoun.referencedProductIds[0] === 'prod-b', 'Resolves pronoun "this one" using focusedProductId (prod-b)');

  // 1.5 Out-of-bounds invalid reference handling (Do NOT invent references)
  const refInvalid = referenceResolverService.resolveReferences('tell me about the fourth one', sampleDiscussedProducts);
  assert(!refInvalid.resolved && refInvalid.mode === 'invalid', 'Detects out-of-bounds fourth option as invalid');
  assert(typeof refInvalid.unresolvedMessage === 'string' && refInvalid.unresolvedMessage.includes('only showed you 3'), 'Returns graceful unresolved message without fabricating products');

  // ==========================================
  // SECTION 2: Intent Extractor & State Merging Tests
  // ==========================================
  console.log('\n--- SECTION 2: Intent Extractor & State Merging Tests ---');

  // 2.1 Mode detection
  const stateHeadphones: ConversationState = {
    goal: null,
    category: 'headphones',
    budget: { min: null, max: 5000 },
    preferences: ['wireless'],
    exclusions: [],
    useCase: null,
    discussedProducts: sampleDiscussedProducts,
    rejectedProducts: [],
    selectedProductId: null,
    stage: 'EVALUATING',
  };

  const modeFollowUp = intentExtractorService.detectIntentMode('something with better battery', stateHeadphones);
  assert(
    modeFollowUp === 'FOLLOW_UP_REFINEMENT' || modeFollowUp === 'DISSATISFACTION',
    'Classifies "something with better battery" as FOLLOW_UP_REFINEMENT or DISSATISFACTION'
  );

  const modeQuestion = intentExtractorService.detectIntentMode('does the first one have ANC?', stateHeadphones, {
    resolved: true,
    mode: 'single',
    referencedPositions: [1],
    referencedProductIds: ['prod-a'],
  });
  assert(modeQuestion === 'PRODUCT_QUESTION', 'Classifies "does the first one have ANC?" as PRODUCT_QUESTION');

  const modeComparison = intentExtractorService.detectIntentMode('compare the first and third', stateHeadphones, {
    resolved: true,
    mode: 'multiple',
    referencedPositions: [1, 3],
    referencedProductIds: ['prod-a', 'prod-c'],
  });
  assert(modeComparison === 'COMPARISON_REQUEST', 'Classifies "compare the first and third" as COMPARISON_REQUEST');

  // 2.2 Constraint Preservation vs Override
  // A: Preserve existing constraints when follow-up refinement arrives
  const rawRefinement = intentExtractorService.extractWithFallback('something with better battery');
  const mergedA = intentExtractorService.mergeWithPreviousState(rawRefinement, 'FOLLOW_UP_REFINEMENT', stateHeadphones, 'something with better battery');
  assert(mergedA.category === 'headphones', 'Preserves category "headphones" in follow-up refinement');
  assert(mergedA.maxPrice === 5000, 'Preserves budget limit 5000 in follow-up refinement');
  assert(mergedA.preferences.includes('good battery life'), 'Adds "good battery life" to preferences');
  assert(mergedA.preferences.includes('wireless'), 'Retains existing preference "wireless"');

  // B: Explicit constraint override
  const rawOverride = intentExtractorService.extractWithFallback('Actually my budget is ₹7000');
  const mergedB = intentExtractorService.mergeWithPreviousState(rawOverride, 'FOLLOW_UP_REFINEMENT', stateHeadphones, 'Actually my budget is ₹7000');
  assert(mergedB.maxPrice === 7000, 'Explicit budget override sets budget.max to 7000 (overrides 5000)');
  assert(mergedB.category === 'headphones', 'Retains category "headphones" during budget override');

  // C: Use case retention
  const stateLaptop: ConversationState = {
    goal: null,
    category: 'laptops',
    budget: { min: null, max: 70000 },
    preferences: [],
    exclusions: [],
    useCase: 'college',
    discussedProducts: [],
    rejectedProducts: [],
    selectedProductId: null,
    stage: 'EVALUATING',
  };
  const rawLighter = intentExtractorService.extractWithFallback('something lighter');
  const mergedC = intentExtractorService.mergeWithPreviousState(rawLighter, 'FOLLOW_UP_REFINEMENT', stateLaptop, 'something lighter');
  assert(mergedC.category === 'laptops', 'Retains category "laptops"');
  assert(mergedC.maxPrice === 70000, 'Retains maxPrice 70000');
  assert(mergedC.useCase === 'college', 'Retains useCase "college"');
  assert(mergedC.preferences.includes('lightweight'), 'Adds "lightweight" preference');

  // ==========================================
  // SECTION 3: End-to-End Test Conversations
  // ==========================================
  console.log('\n--- SECTION 3: End-to-End Test Conversations ---');

  // TEST CONVERSATION 1:
  // User: "I need wireless headphones under ₹5000"
  // Then: "Which one has the best battery?"
  console.log('\nTest Conversation 1: Follow-up battery inquiry');
  const turn1_A = await recommendationService.getRecommendations(storeId, 'I need wireless headphones under ₹5000');
  assert(turn1_A.recommendations.length > 0 && turn1_A.recommendations.length <= 3, 'Turn 1 returned 1-3 recommendations');
  assert(turn1_A.conversationState?.category === 'headphones', 'Turn 1 category is headphones');
  assert(turn1_A.conversationState?.budget.max === 5000, 'Turn 1 budget is 5000');

  const turn1_B = await recommendationService.getRecommendations(storeId, 'Which one has the best battery?', {
    conversationContext: { state: turn1_A.conversationState },
  });
  assert(turn1_B.intent.category === 'headphones', 'Turn 2 retains category headphones');
  assert(turn1_B.intent.maxPrice === 5000, 'Turn 2 retains ₹5000 budget');
  assert(turn1_B.mode === 'COMPARISON_REQUEST', 'Turn 2 classified as COMPARISON_REQUEST');
  assert(turn1_B.conversationState?.stage === 'COMPARING', 'Stage moved to COMPARING');
  assert(
    (turn1_B.conversationState?.discussedProducts.length ?? 0) === turn1_A.conversationState?.discussedProducts.length,
    'Turn 2 preserves discussed products without wiping'
  );

  // TEST CONVERSATION 2:
  // User: "I need a laptop for college under ₹70000"
  // Then: "Something lightweight"
  console.log('\nTest Conversation 2: Refinement with lightweight preference');
  const turn2_A = await recommendationService.getRecommendations(storeId, 'I need a laptop for college under ₹70000');
  assert(turn2_A.conversationState?.useCase === 'college', 'Turn 1 detected useCase college');

  const turn2_B = await recommendationService.getRecommendations(storeId, 'Something lightweight', {
    conversationContext: { state: turn2_A.conversationState },
  });
  assert(turn2_B.intent.category === 'laptops', 'Turn 2 retains category laptops');
  assert(turn2_B.intent.maxPrice === 70000, 'Turn 2 retains budget 70000');
  assert(turn2_B.intent.useCase === 'college', 'Turn 2 retains useCase college');
  assert(turn2_B.intent.preferences.includes('lightweight'), 'Turn 2 adds lightweight preference');
  assert(turn2_B.recommendations.length <= 3, 'Turn 2 adheres to max 3 recommendations ceiling');

  // TEST CONVERSATION 3:
  // User: "Show me headphones"
  // AI returns 3 products
  // Then: "Tell me about the second one"
  console.log('\nTest Conversation 3: Ordinal reference to second product');
  const turn3_A = await recommendationService.getRecommendations(storeId, 'Show me headphones');
  const prod2Id = turn3_A.conversationState?.discussedProducts.find((p) => p.position === 2)?.id;

  const turn3_B = await recommendationService.getRecommendations(storeId, 'Tell me about the second one', {
    conversationContext: { state: turn3_A.conversationState },
  });
  assert(turn3_B.mode === 'PRODUCT_REFERENCE' || turn3_B.mode === 'PRODUCT_QUESTION', 'Turn 2 recognized product reference');
  assert(turn3_B.conversationState?.selectedProductId === prod2Id, `Turn 2 focusedProductId set to product 2 (${prod2Id})`);
  assert(typeof turn3_B.message === 'string' && turn3_B.message.includes('Option 2'), 'Turn 2 message focuses on Option 2');

  // TEST CONVERSATION 4:
  // User: "Show me headphones"
  // Then: "Which one is cheaper?"
  console.log('\nTest Conversation 4: Deterministic cheaper option resolution');
  const turn4_A = await recommendationService.getRecommendations(storeId, 'Show me headphones');
  const expectedCheapest = [...(turn4_A.conversationState?.discussedProducts || [])].sort((a, b) => a.price - b.price)[0];

  const turn4_B = await recommendationService.getRecommendations(storeId, 'Which one is cheaper?', {
    conversationContext: { state: turn4_A.conversationState },
  });
  assert(turn4_B.mode === 'COMPARISON_REQUEST', 'Turn 2 recognized comparison intent');
  assert(turn4_B.conversationState?.selectedProductId === expectedCheapest.id, `Resolved cheapest option (${expectedCheapest.name})`);
  assert(typeof turn4_B.message === 'string' && turn4_B.message.includes(expectedCheapest.name), 'Response identifies cheapest product by name');

  // TEST CONVERSATION 5:
  // User: "Show me headphones"
  // Then: "Compare the first and third"
  console.log('\nTest Conversation 5: Comparison of positions 1 and 3');
  const turn5_A = await recommendationService.getRecommendations(storeId, 'Show me headphones');
  const turn5_B = await recommendationService.getRecommendations(storeId, 'Compare the first and third', {
    conversationContext: { state: turn5_A.conversationState },
  });
  assert(turn5_B.mode === 'COMPARISON_REQUEST', 'Turn 2 mode is COMPARISON_REQUEST');
  assert(turn5_B.conversationState?.stage === 'COMPARING', 'Stage is COMPARING');
  assert(turn5_B.resolvedProducts?.length === 2, 'Resolved exactly 2 products for comparison');
  assert(
    turn5_B.resolvedProducts?.some((p) => p.position === 1) && turn5_B.resolvedProducts?.some((p) => p.position === 3),
    'Resolved products correspond to positions 1 and 3'
  );

  // TEST CONVERSATION 6:
  // User: "Headphones under ₹5000"
  // Then: "Actually under ₹7000"
  console.log('\nTest Conversation 6: Explicit budget override');
  const turn6_A = await recommendationService.getRecommendations(storeId, 'Headphones under ₹5000');
  assert(turn6_A.conversationState?.budget.max === 5000, 'Turn 1 budget is 5000');

  const turn6_B = await recommendationService.getRecommendations(storeId, 'Actually under ₹7000', {
    conversationContext: { state: turn6_A.conversationState },
  });
  assert(turn6_B.conversationState?.budget.max === 7000, 'Turn 2 budget successfully overridden to 7000');
  assert(turn6_B.conversationState?.category === 'headphones', 'Turn 2 preserved category headphones');

  // TEST CONVERSATION 7:
  // User: "Show me headphones"
  // Then: "Tell me about the fourth one"
  console.log('\nTest Conversation 7: Graceful out-of-bounds reference handling');
  const turn7_A = await recommendationService.getRecommendations(storeId, 'Show me headphones');
  const turn7_B = await recommendationService.getRecommendations(storeId, 'Tell me about the fourth one', {
    conversationContext: { state: turn7_A.conversationState },
  });
  assert(typeof turn7_B.message === 'string' && turn7_B.message.includes('only showed you'), 'Graceful error message returned without fabrication');
  assert(!turn7_B.resolvedProducts || turn7_B.resolvedProducts.length === 0, 'Did not fabricate a fourth product');

  // ==========================================
  // SECTION 4: Regression Tests
  // ==========================================
  console.log('\n--- SECTION 4: Regression & Quality Safeguards ---');

  // 4.1 Max 3 recommendations
  assert(turn1_A.recommendations.length <= 3, 'Max 3 recommendations ceiling preserved');
  assert(turn2_B.recommendations.length <= 3, 'Max 3 recommendations ceiling preserved in refinement');

  // 4.2 Zero-match handling (impossible constraints)
  const impossibleResult = await recommendationService.getRecommendations(
    storeId,
    'earbuds under ₹10'
  );
  assert(impossibleResult.recommendations.length === 0, 'Zero-match query returns 0 recommendations');
  assert(typeof impossibleResult.message === 'string', 'Zero-match message returned');

  // 4.3 Store isolation
  const otherStore = await prisma.store.findFirst({
    where: { id: { not: storeId } },
  });
  if (otherStore) {
    const otherResult = await recommendationService.getRecommendations(otherStore.id, 'headphones');
    assert(
      otherResult.products?.every((p: any) => p.storeId === otherStore.id) ?? true,
      'Store isolation maintained across multi-tenant stores'
    );
  }

  // Summary
  console.log(`\n==========================================`);
  console.log(`PHASE 2 TESTS RESULT: ${passedCount}/${totalCount} assertions PASSED`);
  console.log(`==========================================\n`);

  if (passedCount !== totalCount) {
    process.exitCode = 1;
  }
}

runPhase2Tests().catch((err) => {
  console.error('Fatal error in Phase 2 tests:', err);
  process.exit(1);
});
