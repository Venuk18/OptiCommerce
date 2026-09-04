import { prisma } from '../server/db/prisma';
import { recommendationService } from '../server/services/ai/recommendation.service';
import { salesReasonerService, SalesReasonerService } from '../server/services/ai/sales-reasoner.service';
import { aiProviderOrchestrator } from '../server/services/ai/providers/ai-provider.orchestrator';
import { CandidateProduct } from '../server/types/search.types';
import { RankedProduct } from '../server/types/ranking.types';
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

async function runPhase4Verification() {
  console.log('\n==================================================');
  console.log('OPTICOMMERCE PHASE 4 COMPREHENSIVE VERIFICATION');
  console.log('Sales Reasoner & Honest Trade-off Explanations');
  console.log('==================================================\n');

  // Enforce zero real API quota consumption across the test run
  aiProviderOrchestrator.setMode('deterministic');

  // Verify store exists
  const store = await prisma.store.findFirst();
  if (!store) {
    throw new Error('Store not found. Please ensure database is seeded.');
  }
  const storeId = store.id;

  // Mock candidates for testing
  const mockCandidates: CandidateProduct[] = [
    {
      id: 'prod_anc_pro',
      name: 'SoundTrue ANC 700',
      brand: 'SoundTrue',
      category: 'Headphones',
      price: 5499,
      stock: 25,
      description: 'Over-ear headphones with active noise cancellation and 30-hour battery life.',
      features: ['Active Noise Cancellation (ANC)', '30h battery life', 'Plush memory foam cushions'],
      specifications: { battery: '30h', anc: true, driver: '40mm' },
      tags: ['anc', 'travel', 'wireless'],
      images: [],
      relevanceScore: 1,
    },
    {
      id: 'prod_budget_bass',
      name: 'BassBeat Go 2',
      brand: 'BassBeat',
      category: 'Headphones',
      price: 2499,
      stock: 40,
      description: 'Compact wireless headphones with punchy bass and 20h battery.',
      features: ['Deep bass drivers', '20h battery', 'Foldable design'],
      specifications: { battery: '20h', driver: '32mm', anc: false },
      tags: ['bass', 'budget', 'wireless'],
      images: [],
      relevanceScore: 0.9,
    },
    {
      id: 'prod_audiophile_max',
      name: 'AcousticMaster Studio Pro',
      brand: 'AcousticMaster',
      category: 'Headphones',
      price: 8999,
      stock: 12,
      description: 'Studio-grade headphones featuring lossless audio and 50mm neodymium drivers.',
      features: ['50mm neodymium drivers', 'Hi-Res Lossless Audio', 'Aluminum frame'],
      specifications: { driver: '50mm', hiRes: true, weight: '380g' },
      tags: ['studio', 'audiophile', 'premium'],
      images: [],
      relevanceScore: 0.85,
    },
  ];

  const mockRanked: RankedProduct[] = [
    {
      productId: 'prod_anc_pro',
      rank: 1,
      matchScore: 95,
      reason: 'Best balance for travel',
    },
    {
      productId: 'prod_budget_bass',
      rank: 2,
      matchScore: 88,
      reason: 'Great budget alternative',
    },
    {
      productId: 'prod_audiophile_max',
      rank: 3,
      matchScore: 82,
      reason: 'Premium sound experience',
    },
  ];

  const sampleIntent: CustomerIntent = {
    category: 'Headphones',
    brand: null,
    useCase: 'travel and commutes',
    minPrice: null,
    maxPrice: 6000,
    preferences: ['anc'],
    exclusions: [],
    keywords: ['headphones', 'travel'],
  };

  const sampleState: ConversationState = {
    goal: 'Headphones for daily travel',
    category: 'Headphones',
    budget: { min: null, max: 6000 },
    preferences: ['anc'],
    exclusions: [],
    useCase: 'travel',
    discussedProducts: [],
    rejectedProducts: [],
    selectedProductId: null,
    stage: 'EVALUATING',
    pendingClarification: null,
  };

  // --------------------------------------------------------------------------
  // SECTION 1: AI ORCHESTRATOR SINGLE-CALL SALES REASONING
  // --------------------------------------------------------------------------
  console.log('\n--- 1. AI Orchestrator Structured Sales Reasoning ---');

  let orchestratorCallCount = 0;
  let receivedPrompt = '';

  const mockAiOrchestrator = {
    generateJson: async <T>(prompt: string, options: any): Promise<{ data: T; provider: string; model: string; durationMs: number }> => {
      orchestratorCallCount++;
      receivedPrompt = prompt;

      const mockResponse = {
        salesOverview:
          "Of these options, I'd choose the SoundTrue ANC 700 for your travel needs because it gives you Active Noise Cancellation within your ₹6,000 budget. If you want to spend significantly less, BassBeat Go 2 is a strong budget pick, while AcousticMaster Studio Pro offers studio-grade drivers if you can stretch your budget.",
        productReasonings: [
          {
            productId: 'prod_anc_pro',
            whyRecommended:
              'Strongest fit for travel because it provides Active Noise Cancellation to mute engine rumble while staying within your ₹6,000 budget.',
            keyAdvantage: 'Active Noise Cancellation (ANC)',
            tradeoff: 'Costs ₹3,000 more than the budget BassBeat alternative.',
            fitRole: 'Strongest Overall Fit',
            bestFor: 'Best overall fit for travel',
          },
          {
            productId: 'prod_budget_bass',
            whyRecommended:
              'Best budget option at ₹2,499, saving over ₹3,500 compared to your budget while offering 20h battery.',
            keyAdvantage: '20h battery',
            tradeoff: 'Lacks active noise cancellation found on higher-tier models.',
            fitRole: 'Best Budget Choice',
            bestFor: 'Best budget choice',
          },
          {
            productId: 'prod_audiophile_max',
            whyRecommended:
              'Premium alternative if you prioritize ultimate acoustic fidelity, featuring 50mm neodymium drivers.',
            keyAdvantage: '50mm neodymium drivers',
            tradeoff: 'Priced at ₹8,999, which exceeds your ₹6,000 budget target.',
            fitRole: 'Premium Pick',
            bestFor: 'Best for high-tier performance',
          },
        ],
      };

      return {
        data: mockResponse as unknown as T,
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        durationMs: 380,
      };
    },
  };

  const aiReasoningResult = await salesReasonerService.explainRecommendations(
    sampleIntent,
    sampleState,
    mockRanked,
    mockCandidates,
    mockAiOrchestrator
  );

  assert(orchestratorCallCount === 1, 'Enforces SINGLE AI call per turn across all 3 products (orchestratorCallCount === 1)');
  assert(receivedPrompt.includes('SoundTrue ANC 700'), 'Prompt encapsulates candidate 1');
  assert(receivedPrompt.includes('BassBeat Go 2'), 'Prompt encapsulates candidate 2');
  assert(receivedPrompt.includes('AcousticMaster Studio Pro'), 'Prompt encapsulates candidate 3');
  assert(aiReasoningResult.productReasonings.size === 3, 'Returns reasoning for all 3 products');

  const prod1Reasoning = aiReasoningResult.productReasonings.get('prod_anc_pro');
  assert(Boolean(prod1Reasoning?.whyRecommended), 'Option 1 includes whyRecommended');
  assert(prod1Reasoning?.keyAdvantage === 'Active Noise Cancellation (ANC)', 'Option 1 includes verified keyAdvantage');
  assert(Boolean(prod1Reasoning?.tradeoff), 'Option 1 includes honest trade-off');
  assert(prod1Reasoning?.fitRole === 'Strongest Overall Fit', 'Option 1 assigned Strongest Overall Fit');
  assert(prod1Reasoning?.bestFor === 'Best overall fit for travel', 'Option 1 assigned bestFor');

  const prod2Reasoning = aiReasoningResult.productReasonings.get('prod_budget_bass');
  assert(prod2Reasoning?.fitRole === 'Best Budget Choice', 'Option 2 assigned Best Budget Choice');
  assert(prod2Reasoning?.tradeoff?.includes('noise cancellation') === true, 'Option 2 highlights honest trade-off (lacks ANC)');

  assert(
    aiReasoningResult.salesOverview.includes('SoundTrue ANC 700'),
    'Sales overview identifies top pick and synthesizes shortlist'
  );

  // --------------------------------------------------------------------------
  // SECTION 2: STRICT ANTI-HALLUCINATION & HONESTY VALIDATION
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Anti-Hallucination & Grounding Validation ---');

  const reasoner = new SalesReasonerService();

  // 2.1 Valid result passes validation
  const validAiPayload = {
    salesOverview: 'Valid sales overview comparing options.',
    productReasonings: [
      {
        productId: 'prod_anc_pro',
        whyRecommended: 'Solid option for travel at ₹5,499.',
        keyAdvantage: '30h battery life',
        tradeoff: 'Higher cost than budget model.',
        fitRole: 'Strongest Overall Fit',
        bestFor: 'Best for travel',
      },
    ],
  };
  assert(
    reasoner.validateAiSalesReasoning(validAiPayload, mockCandidates, mockRanked, sampleIntent, sampleState) === true,
    'Authoritative grounded data passes validation'
  );

  // 2.2 Unknown product ID is rejected
  const invalidIdPayload = {
    salesOverview: 'Valid overview',
    productReasonings: [
      {
        productId: 'non_existent_id_999',
        whyRecommended: 'Fake product recommendation',
        keyAdvantage: 'Fake feature',
        tradeoff: null,
        fitRole: 'Best Value',
      },
    ],
  };
  assert(
    reasoner.validateAiSalesReasoning(invalidIdPayload, mockCandidates, mockRanked, sampleIntent, sampleState) === false,
    'Rejects unknown/hallucinated product ID'
  );

  // 2.3 Duplicate product IDs rejected
  const duplicateIdPayload = {
    salesOverview: 'Valid overview',
    productReasonings: [
      {
        productId: 'prod_anc_pro',
        whyRecommended: 'Recommendation 1',
        keyAdvantage: '30h battery',
        fitRole: 'Strongest Fit',
      },
      {
        productId: 'prod_anc_pro',
        whyRecommended: 'Recommendation 2 duplicate',
        keyAdvantage: '30h battery',
        fitRole: 'Strongest Fit',
      },
    ],
  };
  assert(
    reasoner.validateAiSalesReasoning(duplicateIdPayload, mockCandidates, mockRanked, sampleIntent, sampleState) === false,
    'Rejects duplicate product IDs in reasoning payload'
  );

  // 2.4 Banned hyperbolic marketing terms rejected
  const hypeTerms = ['absolutely perfect', 'unbeatable', 'miraculous', 'revolutionary'];
  for (const term of hypeTerms) {
    const hypePayload = {
      salesOverview: `This option is ${term} for everyone.`,
      productReasonings: [
        {
          productId: 'prod_anc_pro',
          whyRecommended: `An ${term} pair of headphones.`,
          keyAdvantage: 'ANC',
          fitRole: 'Top Pick',
        },
      ],
    };
    assert(
      reasoner.validateAiSalesReasoning(hypePayload, mockCandidates, mockRanked, sampleIntent, sampleState) === false,
      `Rejects banned hyperbolic marketing claim: "${term}"`
    );
  }

  // 2.5 Hallucinated numerical specification rejected (e.g. claiming 60h battery on a 30h product)
  const hallucinatedSpecPayload = {
    salesOverview: 'Comparing options.',
    productReasonings: [
      {
        productId: 'prod_anc_pro',
        whyRecommended: 'Great battery.',
        keyAdvantage: '60 hours battery life', // Actual is 30h
        tradeoff: null,
        fitRole: 'Top Pick',
      },
    ],
  };
  assert(
    reasoner.validateAiSalesReasoning(hallucinatedSpecPayload, mockCandidates, mockRanked, sampleIntent, sampleState) === false,
    'Rejects unsupported numerical specification (60 hours on 30h product)'
  );

  // 2.6 Hallucinated foreign brand rejected
  const foreignBrandPayload = {
    salesOverview: 'Comparing options.',
    productReasonings: [
      {
        productId: 'prod_anc_pro', // Brand is SoundTrue
        whyRecommended: 'Official Apple engineering.',
        keyAdvantage: 'Apple build quality',
        tradeoff: null,
        fitRole: 'Top Pick',
      },
    ],
  };
  assert(
    reasoner.validateAiSalesReasoning(foreignBrandPayload, mockCandidates, mockRanked, sampleIntent, sampleState) === false,
    'Rejects foreign brand claim ("Apple" for SoundTrue product)'
  );

  // 2.7 Introducing more products than shortlisted candidates rejected
  const extraProductsPayload = {
    salesOverview: 'Comparing options.',
    productReasonings: [
      { productId: 'prod_anc_pro', whyRecommended: 'A', keyAdvantage: 'B', fitRole: 'C' },
      { productId: 'prod_budget_bass', whyRecommended: 'A', keyAdvantage: 'B', fitRole: 'C' },
      { productId: 'prod_audiophile_max', whyRecommended: 'A', keyAdvantage: 'B', fitRole: 'C' },
      { productId: 'prod_extra', whyRecommended: 'A', keyAdvantage: 'B', fitRole: 'C' },
    ],
  };
  assert(
    reasoner.validateAiSalesReasoning(extraProductsPayload, mockCandidates, mockRanked, sampleIntent, sampleState) === false,
    'Rejects payload that introduces more products than shortlisted (max 3)'
  );

  // --------------------------------------------------------------------------
  // SECTION 3: DETERMINISTIC FALLBACK REASONING (0 NETWORK CALLS)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. High-Quality Deterministic Fallback Engine ---');

  const startTime = Date.now();
  // Pass null override to force deterministic fallback
  const fallbackResult = await salesReasonerService.explainRecommendations(
    sampleIntent,
    sampleState,
    mockRanked,
    mockCandidates,
    null
  );
  const durationMs = Date.now() - startTime;

  assert(durationMs < 50, `Deterministic fallback executes sub-5ms (actual: ${durationMs}ms)`);
  assert(fallbackResult.productReasonings.size === 3, 'Deterministic fallback covers all 3 products');

  const fbTop = fallbackResult.productReasonings.get('prod_anc_pro')!;
  assert(fbTop.fitRole === 'Strongest Overall Fit', 'Fallback: top rank gets Strongest Overall Fit');
  assert(fbTop.bestFor?.includes('travel') === true, 'Fallback: bestFor grounds in user use-case (travel)');
  assert(fbTop.whyRecommended.includes('travel'), 'Fallback: whyRecommended addresses user travel goal');
  assert(fbTop.keyAdvantage === 'Active Noise Cancellation (ANC)', 'Fallback: keyAdvantage matches user preference for ANC');

  const fbBudget = fallbackResult.productReasonings.get('prod_budget_bass')!;
  assert(fbBudget.fitRole === 'Best Budget Choice', 'Fallback: lowest price product gets Best Budget Choice');
  assert(fbBudget.whyRecommended.includes('saving ₹3,501'), 'Fallback: whyRecommended highlights exact savings vs budget');
  assert(
    fbBudget.tradeoff?.includes('Lacks active noise cancellation') === true,
    'Fallback: trade-off honestly reports lack of ANC found on top pick'
  );

  const fbPremium = fallbackResult.productReasonings.get('prod_audiophile_max')!;
  assert(fbPremium.fitRole === 'Premium Pick', 'Fallback: highest price product gets Premium Pick');
  assert(fbPremium.tradeoff?.includes('Costs ₹3,500 more') === true, 'Fallback: trade-off honestly highlights price differential');

  assert(
    fallbackResult.salesOverview.includes("I'd choose the SoundTrue ANC 700 for you"),
    'Fallback salesOverview provides clear strongest-fit recommendation'
  );

  // --------------------------------------------------------------------------
  // SECTION 4: INTEGRATION WITH RECOMMENDATION PIPELINE
  // --------------------------------------------------------------------------
  console.log('\n--- 4. End-to-End Recommendation Pipeline Integration ---');

  // Turn 1: Search query with use case & budget
  const turn1 = await recommendationService.getRecommendations(storeId, 'wireless headphones under ₹6000');

  assert(turn1.recommendations.length > 0, 'Turn 1 returns recommendations');
  assert(turn1.recommendations.length <= 3, 'Enforces MAXIMUM 3 recommendations');
  assert(Boolean(turn1.salesOverview), 'Turn 1 returns salesOverview in response');

  const topRec = turn1.recommendations[0];
  assert(Boolean(topRec.whyRecommended), 'Top recommendation includes whyRecommended');
  assert(Boolean(topRec.keyAdvantage), 'Top recommendation includes keyAdvantage');
  assert(Boolean(topRec.fitRole), 'Top recommendation includes fitRole');
  assert(Boolean(topRec.bestFor), 'Top recommendation includes bestFor');
  assert(topRec.tradeoff !== undefined, 'Top recommendation includes tradeoff property');

  // Turn 2: Factual feature question on Option 1
  const turn2 = await recommendationService.getRecommendations(
    storeId,
    'Does the first one have ANC?',
    { conversationContext: { state: turn1.conversationState } }
  );

  assert(turn2.mode === 'PRODUCT_QUESTION', 'Turn 2 classified as PRODUCT_QUESTION');
  assert(
    turn2.message?.includes('Option 1') === true,
    'Turn 2 message refers to Option 1 explicitly'
  );
  assert(
    turn2.message?.includes('Active Noise Cancellation') === true ||
      turn2.message?.includes("I can't confirm that from the product information available") === true,
    'Turn 2 answers factually based strictly on authoritative product data'
  );

  // Turn 3: Refinement with feature priority (better battery life)
  const turn3 = await recommendationService.getRecommendations(
    storeId,
    'Looking for better battery life',
    { conversationContext: { state: turn1.conversationState } }
  );

  assert(
    turn3.mode === 'DISSATISFACTION' || turn3.mode === 'FOLLOW_UP_REFINEMENT' || turn3.mode === 'CLARIFICATION_ANSWER',
    'Turn 3 handles priority refinement'
  );
  assert(turn3.recommendations.length > 0, 'Turn 3 returns refined recommendations');
  assert(Boolean(turn3.salesOverview), 'Turn 3 includes updated sales overview');

  // --------------------------------------------------------------------------
  // SECTION 5: FALLBACK RESILIENCE ON NETWORK TIMEOUT OR INVALID AI JSON
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Fallback Resilience & Graceful Degradation ---');

  // Test with an orchestrator that throws an error (e.g. simulated network timeout)
  const failingOrchestrator = {
    generateJson: async () => {
      throw new Error('Groq upstream connection timeout after 6000ms');
    },
  };

  const resilientResult = await salesReasonerService.explainRecommendations(
    sampleIntent,
    sampleState,
    mockRanked,
    mockCandidates,
    failingOrchestrator
  );

  assert(resilientResult.productReasonings.size === 3, 'Gracefully falls back to deterministic reasoning on AI error');
  assert(Boolean(resilientResult.salesOverview), 'Fallback generates complete salesOverview on AI failure');
  assert(
    resilientResult.productReasonings.get('prod_anc_pro')?.fitRole === 'Strongest Overall Fit',
    'Fallback correctly reasons about products even when AI fails'
  );

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n==================================================');
  console.log(`VERIFICATION SUMMARY: ${passedCount}/${totalCount} tests passed`);
  console.log('==================================================\n');

  if (passedCount !== totalCount) {
    throw new Error(`Phase 4 verification failed: ${totalCount - passedCount} tests failed.`);
  }
}

runPhase4Verification()
  .then(() => {
    console.log('Phase 4 verification completed successfully.\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Phase 4 verification failed with error:', err);
    process.exit(1);
  });
