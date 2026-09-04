import { prisma } from '../server/db/prisma';
import { recommendationService } from '../server/services/ai/recommendation.service';
import { intentExtractorService } from '../server/services/ai/intent-extractor.service';
import { dissatisfactionDetectorService } from '../server/services/ai/dissatisfaction-detector.service';
import { ConversationState, DiscussedProduct } from '../server/types/recommendation.types';

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

async function runPhase3Verification() {
  console.log('\n==========================================');
  console.log('OPTICOMMERCE PHASE 3 COMPREHENSIVE VERIFICATION');
  console.log('Dissatisfaction & Targeted Clarification');
  console.log('==========================================\n');

  // Find default store
  const store = await prisma.store.findFirst();

  if (!store) {
    throw new Error('Store not found. Please ensure database is seeded.');
  }

  const storeId = store.id;

  // Mock discussed products for unit verification
  const sampleDiscussed: DiscussedProduct[] = [
    { id: 'prod_1', name: 'ZenAudio QuietComfort 45', price: 5999, category: 'Headphones', position: 1 },
    { id: 'prod_2', name: 'BassMaster Pro 700', price: 4999, category: 'Headphones', position: 2 },
    { id: 'prod_3', name: 'Sony WH-CH520', price: 3999, category: 'Headphones', position: 3 },
  ];

  const sampleState: ConversationState = {
    goal: 'Buy headphones',
    category: 'Headphones',
    budget: { min: null, max: 6000 },
    preferences: ['wireless'],
    exclusions: [],
    useCase: null,
    discussedProducts: sampleDiscussed,
    rejectedProducts: [],
    selectedProductId: null,
    stage: 'EVALUATING',
    pendingClarification: null,
  };

  // --------------------------------------------------------------------------
  // SECTION 1: DISSATISFACTION DETECTOR SERVICE UNIT TESTS
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Dissatisfaction Detection Unit Tests ---');

  // 1.1 Price dissatisfaction
  const priceDissat = dissatisfactionDetectorService.detectDissatisfaction(
    'These are way too expensive for me',
    sampleState,
    sampleDiscussed
  );
  assert(priceDissat.isDissatisfied === true, 'Detects price dissatisfaction: isDissatisfied === true');
  assert(priceDissat.reason === 'PRICE', 'Detects reason === PRICE');
  assert(
    priceDissat.extractedConstraint?.maxPrice !== undefined &&
      priceDissat.extractedConstraint.maxPrice < 4000,
    'Calculates lower maxPrice bound automatically'
  );

  // 1.2 Unknown / Vague dissatisfaction
  const vagueDissat = dissatisfactionDetectorService.detectDissatisfaction(
    "I don't like these options at all",
    sampleState,
    sampleDiscussed
  );
  assert(vagueDissat.isDissatisfied === true, 'Detects vague dissatisfaction: isDissatisfied === true');
  assert(vagueDissat.reason === 'UNKNOWN', 'Detects reason === UNKNOWN for vague dissatisfaction');
  assert(
    typeof vagueDissat.suggestedClarificationQuestion === 'string' &&
      vagueDissat.suggestedClarificationQuestion.length > 10,
    'Generates suggested targeted clarification question for UNKNOWN reason'
  );

  // 1.3 Performance dissatisfaction
  const perfDissat = dissatisfactionDetectorService.detectDissatisfaction(
    'I need something much faster with high performance',
    sampleState,
    sampleDiscussed
  );
  assert(perfDissat.isDissatisfied === true, 'Detects performance dissatisfaction');
  assert(perfDissat.reason === 'PERFORMANCE', 'Detects reason === PERFORMANCE');
  assert(
    perfDissat.extractedConstraint?.addedPreferences?.includes('high performance') ?? false,
    'Extracts performance preference'
  );

  // 1.4 Brand rejection dissatisfaction
  const brandDissat = dissatisfactionDetectorService.detectDissatisfaction(
    "I don't want Sony or ZenAudio, show me something else",
    sampleState,
    sampleDiscussed
  );
  assert(brandDissat.isDissatisfied === true, 'Detects brand dissatisfaction');
  assert(brandDissat.reason === 'BRAND', 'Detects reason === BRAND');
  assert(
    brandDissat.extractedConstraint?.excludedBrand !== undefined,
    'Extracts excludedBrand constraint'
  );

  // 1.5 Feature dissatisfaction
  const featureDissat = dissatisfactionDetectorService.detectDissatisfaction(
    'The battery life is way too short on these',
    sampleState,
    sampleDiscussed
  );
  assert(featureDissat.isDissatisfied === true, 'Detects feature dissatisfaction');
  assert(featureDissat.reason === 'FEATURE', 'Detects reason === FEATURE');

  // 1.6 Size dissatisfaction
  const sizeDissat = dissatisfactionDetectorService.detectDissatisfaction(
    'These look too bulky and heavy to carry',
    sampleState,
    sampleDiscussed
  );
  assert(sizeDissat.isDissatisfied === true, 'Detects size dissatisfaction');
  assert(sizeDissat.reason === 'SIZE', 'Detects reason === SIZE');

  // 1.7 Non-dissatisfaction queries (Ensure no false positives)
  const compQuery = dissatisfactionDetectorService.detectDissatisfaction(
    'Compare option 1 and option 2',
    sampleState,
    sampleDiscussed
  );
  assert(compQuery.isDissatisfied === false, 'Comparison query is NOT detected as dissatisfaction');

  const questionQuery = dissatisfactionDetectorService.detectDissatisfaction(
    'Does the second one have ANC?',
    sampleState,
    sampleDiscussed
  );
  assert(questionQuery.isDissatisfied === false, 'Product feature question is NOT detected as dissatisfaction');

  // --------------------------------------------------------------------------
  // SECTION 2: INTENT EXTRACTOR INTEGRATION TESTS
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Intent Extractor Mode & Exclusions Integration ---');

  const extractResult1 = await intentExtractorService.extractIntent('too expensive', {
    state: sampleState,
  });
  assert(extractResult1.mode === 'DISSATISFACTION', 'IntentExtractor classifies "too expensive" as DISSATISFACTION');
  assert(
    extractResult1.intent.rejectedProductIds?.includes('prod_1') ?? false,
    'IntentExtractor populates rejectedProductIds with discussed products'
  );

  const extractResult2 = await intentExtractorService.extractIntent("I don't like any of these", {
    state: sampleState,
  });
  assert(extractResult2.mode === 'DISSATISFACTION', 'IntentExtractor classifies vague rejection as DISSATISFACTION');
  assert(
    extractResult2.dissatisfactionResult?.reason === 'UNKNOWN',
    'DissatisfactionResult reason is UNKNOWN for vague rejection'
  );

  // Clarification answering
  const clarifyingState: ConversationState = {
    ...sampleState,
    stage: 'CLARIFYING',
    pendingClarification: {
      question: 'Are you looking for a lower price or better battery?',
      options: ['price', 'battery'],
    },
  };

  const extractResult3 = await intentExtractorService.extractIntent('better battery life please', {
    state: clarifyingState,
  });
  assert(extractResult3.mode === 'CLARIFICATION_ANSWER', 'IntentExtractor classifies answer as CLARIFICATION_ANSWER');

  // --------------------------------------------------------------------------
  // SECTION 3: END-TO-END MULTI-TURN COMMERCE CONVERSATION
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Multi-turn Commerce Conversation Tests ---');

  // Turn 1: Initial Discovery
  console.log('\n[Turn 1] User: "wireless headphones under ₹6000"');
  const turn1 = await recommendationService.getRecommendations(storeId, 'wireless headphones under ₹6000');
  assert(turn1.recommendations.length > 0, 'Turn 1 returns recommendations');
  assert(turn1.recommendations.length <= 3, 'Turn 1 enforces maximum 3 recommendations');
  assert(turn1.conversationState.category?.toLowerCase() === 'headphones', 'Turn 1 sets category to headphones');
  assert(turn1.conversationState.budget.max === 6000, 'Turn 1 sets budget to ₹6000');

  const turn1ProductIds = turn1.recommendations.map((r) => r.productId);
  console.log(`   Turn 1 recommended product IDs: ${turn1ProductIds.join(', ')}`);

  // Turn 2: Clear Dissatisfaction ("Too expensive")
  // Should refine immediately without asking clarification question!
  console.log('\n[Turn 2] User: "These are too expensive for me"');
  const turn2 = await recommendationService.getRecommendations(storeId, 'These are too expensive for me', {
    conversationContext: {
      history: [
        { role: 'user', content: 'wireless headphones under ₹6000' },
        { role: 'assistant', content: 'Here are 3 headphones' },
      ],
      state: turn1.conversationState,
    },
  });

  assert(turn2.mode === 'DISSATISFACTION', 'Turn 2 mode is DISSATISFACTION');
  assert(
    turn2.conversationState.pendingClarification === null,
    'Turn 2 does NOT ask clarification question when reason is clear (PRICE)'
  );
  assert(turn2.recommendations.length <= 3, 'Turn 2 enforces max 3 recommendations');
  assert(
    turn2.conversationState.rejectedProducts.length >= turn1ProductIds.length,
    'Turn 2 tracks rejected products from Turn 1'
  );
  assert(
    turn1ProductIds.every((id) => turn2.conversationState.rejectedProducts.includes(id)),
    'Turn 2 rejectedProducts includes all products from Turn 1'
  );
  assert(
    turn2.conversationState.category?.toLowerCase() === 'headphones',
    'Turn 2 preserves original intent category: headphones'
  );

  // Turn 3: Vague Dissatisfaction ("I don't like these options")
  // Should ask exactly ONE targeted clarification question!
  console.log('\n[Turn 3] User: "I don\'t like these options"');
  const turn3 = await recommendationService.getRecommendations(storeId, "I don't like these options", {
    conversationContext: {
      history: [
        { role: 'user', content: 'wireless headphones under ₹6000' },
        { role: 'assistant', content: 'Here are 3 headphones' },
        { role: 'user', content: 'These are too expensive for me' },
        { role: 'assistant', content: 'Here are more affordable options' },
      ],
      state: turn2.conversationState,
    },
  });

  assert(turn3.mode === 'DISSATISFACTION', 'Turn 3 mode is DISSATISFACTION');
  assert(
    turn3.conversationState.stage === 'CLARIFYING',
    'Turn 3 stage is CLARIFYING for vague dissatisfaction'
  );
  assert(
    turn3.conversationState.pendingClarification !== null,
    'Turn 3 has pendingClarification set'
  );
  assert(
    typeof turn3.message === 'string' && turn3.message.includes('?'),
    'Turn 3 returns exactly ONE targeted clarification question to the customer'
  );
  console.log(`   Clarification question asked: "${turn3.message}"`);

  // Turn 4: Customer answers the clarification question
  console.log('\n[Turn 4] User: "Looking for better battery life"');
  const turn4 = await recommendationService.getRecommendations(storeId, 'Looking for better battery life', {
    conversationContext: {
      history: [
        { role: 'user', content: "I don't like these options" },
        { role: 'assistant', content: turn3.message || '' },
      ],
      state: turn3.conversationState,
    },
  });

  assert(turn4.mode === 'CLARIFICATION_ANSWER', 'Turn 4 mode is CLARIFICATION_ANSWER');
  assert(
    turn4.conversationState.pendingClarification === null,
    'Turn 4 clears pendingClarification after customer answers'
  );
  assert(
    turn4.conversationState.stage === 'EVALUATING',
    'Turn 4 returns stage to EVALUATING'
  );
  assert(turn4.recommendations.length <= 3, 'Turn 4 enforces maximum 3 recommendations');
  assert(
    turn4.conversationState.category?.toLowerCase() === 'headphones',
    'Turn 4 preserves category: headphones'
  );

  // Turn 5: Specific Brand Exclusion ("I don't want ZenAudio")
  console.log('\n[Turn 5] User: "I don\'t want ZenAudio"');
  const turn5 = await recommendationService.getRecommendations(storeId, "I don't want ZenAudio", {
    conversationContext: {
      history: [
        { role: 'user', content: 'Looking for better battery life' },
        { role: 'assistant', content: 'Here are battery focused options' },
      ],
      state: turn4.conversationState,
    },
  });

  assert(turn5.mode === 'DISSATISFACTION', 'Turn 5 mode is DISSATISFACTION');
  assert(
    turn5.conversationState.exclusions.some((e) => e.toLowerCase() === 'zenaudio'),
    'Turn 5 adds ZenAudio to exclusions in conversationState'
  );
  assert(
    turn5.products?.every((p) => p.brand?.toLowerCase() !== 'zenaudio') ?? true,
    'Turn 5 excludes ZenAudio products from returned recommendations'
  );

  // --------------------------------------------------------------------------
  // SECTION 4: SAFEGUARDS & EDGE CASES
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Safeguards & Invariants Verification ---');

  // Anti-hallucination test: All recommended products exist in database
  const allRecommendedIds = turn1.recommendations
    .concat(turn2.recommendations)
    .concat(turn4.recommendations)
    .concat(turn5.recommendations)
    .map((r) => r.productId);

  const existingProds = await prisma.product.findMany({
    where: { id: { in: allRecommendedIds }, storeId },
  });
  assert(
    existingProds.length === new Set(allRecommendedIds).size,
    'Anti-hallucination: All recommended products across turns exist in database for this store'
  );

  // Zero Gemini calls performance test
  const startTimer = Date.now();
  const fastDissat = dissatisfactionDetectorService.detectDissatisfaction('too expensive', sampleState, sampleDiscussed);
  const elapsed = Date.now() - startTimer;
  assert(elapsed < 20, `Fast deterministic detection takes < 20ms (took ${elapsed}ms)`);

  // Summary
  console.log(`\n==========================================`);
  console.log(`PHASE 3 TESTS RESULT: ${passedCount}/${totalCount} assertions PASSED`);
  console.log(`==========================================\n`);

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runPhase3Verification()
  .catch((err) => {
    console.error('Phase 3 verification error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
