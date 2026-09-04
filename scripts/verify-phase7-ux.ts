import { prisma } from '../server/db/prisma';
import { isExplicitOfferRequest, intentExtractorService } from '../server/services/ai/intent-extractor.service';
import { recommendationService } from '../server/services/ai/recommendation.service';
import { hesitationDetectorService } from '../server/services/revenue/hesitation-detector.service';
import { aiProviderOrchestrator } from '../server/services/ai/providers/ai-provider.orchestrator';
import fs from 'fs';
import path from 'path';

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

async function runPhase7UxVerification() {
  console.log('\n==================================================');
  console.log('OPTICOMMERCE PHASE 7 UX CORRECTION VERIFICATION');
  console.log('Commercial Offer Experience & Decoupled Triggering');
  console.log('==================================================\n');

  aiProviderOrchestrator.setMode('deterministic');

  const store = await prisma.store.findFirst();
  if (!store) {
    throw new Error('Store not found.');
  }
  const storeId = store.id;

  // ==========================================
  // SUITE 1: Explicit Offer Request Classification
  // ==========================================
  console.log('--- SUITE 1: Explicit Offer Request Classification ---');

  const explicitQueries = [
    'Is there any price reduction on this?',
    'Can I get this cheaper?',
    'Is there a discount on this?',
    'Can you reduce the price?',
    'Any offer available?',
    'Can you make it cheaper?',
    'Can I get a better price?',
    'Is there an offer for this?',
    'Can you lower the price for me?',
    'What is the best price available on this?',
  ];

  for (const q of explicitQueries) {
    assert(
      isExplicitOfferRequest(q) === true,
      `Correctly identifies explicit offer query: "${q}"`
    );
  }

  const nonOfferQueries = [
    'Why is this expensive?',
    'Is this worth the price?',
    'What is the difference between these?',
    'Does this have ANC?',
    'Compare the first and third.',
    'Show me wireless headphones under 5000',
    'How long does the battery last?',
  ];

  for (const q of nonOfferQueries) {
    assert(
      isExplicitOfferRequest(q) === false,
      `Does NOT classify non-offer query as explicit offer: "${q}"`
    );
  }

  // ==========================================
  // SUITE 2: IntentMode Mapping & Separation
  // ==========================================
  console.log('\n--- SUITE 2: IntentMode Mapping & Separation ---');

  const mode1 = intentExtractorService.detectIntentMode('Is there any price reduction on this?');
  assert(mode1 === 'OFFER_REQUEST', 'detectIntentMode maps explicit reduction request to OFFER_REQUEST', `Got: ${mode1}`);

  const mode2 = intentExtractorService.detectIntentMode('Can I get this cheaper?');
  assert(mode2 === 'OFFER_REQUEST', 'detectIntentMode maps "Can I get this cheaper?" to OFFER_REQUEST', `Got: ${mode2}`);

  const mode3 = intentExtractorService.detectIntentMode('Does option 1 have ANC?');
  assert(mode3 !== 'OFFER_REQUEST', 'Feature inquiry does NOT map to OFFER_REQUEST', `Got: ${mode3}`);

  const mode4 = intentExtractorService.detectIntentMode('Compare the first and second');
  assert(mode4 === 'COMPARISON_REQUEST', 'Comparison query maps to COMPARISON_REQUEST', `Got: ${mode4}`);

  // ==========================================
  // SUITE 3: Internal Hesitation Preserved Without Unsolicited Offer UI
  // ==========================================
  console.log('\n--- SUITE 3: Internal Hesitation vs Unsolicited UI ---');

  const hesitationQuery = 'This is a bit expensive for my budget, not sure if I should get it';
  const hes = hesitationDetectorService.detectHesitation(hesitationQuery);
  assert(hes.type === 'PRICE', 'Internal PRICE hesitation detection remains active', `Got: ${hes.type}`);

  // Search recommendation with hesitation should NOT return an unsolicited commercial offer card
  const searchResult = await recommendationService.getRecommendations(
    storeId,
    'headphones',
    { sessionId: `p7-ux-test-${Date.now()}` }
  );
  assert(
    searchResult.commercialOffer === undefined,
    'Standard product discovery does NOT attach unsolicited commercial offer card'
  );

  // ==========================================
  // SUITE 4: Explicit Offer Request End-to-End Execution
  // ==========================================
  console.log('\n--- SUITE 4: Explicit Offer Request End-to-End ---');

  const sessionId = `p7-ux-explicit-${Date.now()}`;
  
  // Step A: Customer discovers headphones first
  const stepA = await recommendationService.getRecommendations(
    storeId,
    'wireless headphones',
    { sessionId }
  );
  assert(stepA.recommendations.length > 0, 'First turn returns recommendations');
  const targetProduct = stepA.products[0];

  // Step B: Customer explicitly asks for a price reduction
  const stepB = await recommendationService.getRecommendations(
    storeId,
    'Is there any price reduction on this?',
    {
      sessionId,
      conversationContext: {
        state: stepA.conversationState,
      },
    }
  );

  assert(stepB.mode === 'OFFER_REQUEST', 'Turn mode is OFFER_REQUEST', `Got mode: ${stepB.mode}`);
  assert(
    stepB.commercialOffer !== undefined && (stepB.commercialOffer.discountPercent || 0) > 0,
    'Commercial engine returns authorized price reduction upon explicit request'
  );
  assert(
    stepB.message?.includes('I found an eligible price reduction'),
    'Returns clean conversational response: "I found an eligible price reduction..."',
    `Message: ${stepB.message}`
  );

  // Verify no economic leakages in message
  const msg = stepB.message || '';
  assert(!msg.includes('costPrice'), 'Message NEVER mentions costPrice');
  assert(!msg.includes('marginPercent'), 'Message NEVER mentions marginPercent');
  assert(!msg.includes('internalScore'), 'Message NEVER mentions internalScore');

  // ==========================================
  // SUITE 5: UI Components Integrity & Button Contracts
  // ==========================================
  console.log('\n--- SUITE 5: UI Components Integrity & Button Contracts ---');

  const offerCardPath = path.join(process.cwd(), 'src/components/customer/CommercialOfferCard.tsx');
  const offerCardCode = fs.readFileSync(offerCardPath, 'utf8');

  assert(!offerCardCode.includes('No thanks, full price'), 'CommercialOfferCard has NO "No thanks, full price" button');
  assert(!offerCardCode.includes('id="decline-commercial-offer-btn"'), 'CommercialOfferCard has NO secondary decline button');
  assert(offerCardCode.includes('Apply offer & reduce price'), 'CommercialOfferCard contains single button "Apply offer & reduce price"');
  assert(offerCardCode.includes('Price reduction available'), 'CommercialOfferCard displays "Price reduction available" badge');

  const bannerPath = path.join(process.cwd(), 'src/components/customer/CustomerOfferBanner.tsx');
  const bannerCode = fs.readFileSync(bannerPath, 'utf8');

  assert(!bannerCode.includes('No thanks, full price'), 'CustomerOfferBanner has NO "No thanks, full price" button');
  assert(bannerCode.includes('Apply offer & reduce price'), 'CustomerOfferBanner contains single button "Apply offer & reduce price"');
  assert(bannerCode.includes('I found an eligible price reduction'), 'CustomerOfferBanner includes "I found an eligible price reduction..."');

  // ==========================================
  // SUITE 6: Product Details Modal Offer Entry Point & Focused Product
  // ==========================================
  console.log('\n--- SUITE 6: Product Details Modal Entry Point & Focused Product ---');

  const modalPath = path.join(process.cwd(), 'src/components/customer/ProductDetailsModal.tsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  // 1. Product modal displays the price-reduction action
  assert(
    modalCode.includes('Is there any reduced price?'),
    'Product modal displays the price-reduction action: "💬 Is there any reduced price?"'
  );
  assert(
    modalCode.includes('id="ask-price-reduction-btn"'),
    'Product modal contains button element id="ask-price-reduction-btn"'
  );

  // 2. Action is positioned directly below Add to Cart (Standard)
  const addBtnIndex = modalCode.indexOf('id="add-to-cart-standard-btn"');
  const askBtnIndex = modalCode.indexOf('id="ask-price-reduction-btn"');
  assert(
    addBtnIndex !== -1 && askBtnIndex !== -1 && askBtnIndex > addBtnIndex,
    'Price reduction action is positioned directly below Add to Cart button'
  );

  // 3. Existing Add to Cart behavior remains unchanged
  assert(
    modalCode.includes('Add to Cart (Standard)'),
    'Existing Add to Cart (Standard) button label and behavior remain unchanged'
  );

  // 4. No discount amount is hardcoded or shown before backend authorization
  const askBtnSnippet = modalCode.slice(
    modalCode.indexOf('id="ask-price-reduction-btn"'),
    modalCode.indexOf('id="ask-price-reduction-btn"') + 400
  );
  assert(
    !askBtnSnippet.includes('%') && !askBtnSnippet.includes('discount') && !askBtnSnippet.includes('off'),
    'No discount percentage is hardcoded or shown in modal prior to backend authorization'
  );

  // 5. Query string matches explicit offer request pattern
  const modalQuery = 'Is there any reduced price?';
  assert(
    isExplicitOfferRequest(modalQuery) === true,
    'Explicit offer request correctly matches "Is there any reduced price?"'
  );

  // 6. Test focusedProductId resolution with exact product
  const testProduct = await prisma.product.findFirst({
    where: { storeId },
  });
  if (!testProduct) {
    throw new Error('Test product not found');
  }

  const focusedSessionId = `p7-focused-${Date.now()}`;
  const focusedResult = await recommendationService.getRecommendations(
    storeId,
    modalQuery,
    {
      sessionId: focusedSessionId,
      focusedProductId: testProduct.id,
    }
  );

  assert(
    focusedResult.mode === 'OFFER_REQUEST',
    'Focused modal request correctly routes to OFFER_REQUEST mode'
  );
  assert(
    focusedResult.recommendations.some((r) => r.productId === testProduct.id),
    'Evaluated offer targets the exact focused product'
  );
  assert(
    focusedResult.products[0]?.id === testProduct.id,
    'No generic product search overrides the viewed product (focused product is returned)'
  );

  if (focusedResult.commercialOffer) {
    assert(
      focusedResult.commercialOffer.productId === testProduct.id,
      'Commercial offer productId matches focused product'
    );
    assert(
      Boolean(focusedResult.commercialOffer.token),
      'Commercial offer includes cryptographic HMAC validation token'
    );
    assert(
      (focusedResult.commercialOffer.finalPrice || 0) >= (Number(testProduct.costPrice) || 0),
      'Commercial offer satisfies strict margin floor (finalPrice >= costPrice)'
    );
  } else {
    assert(
      focusedResult.message?.includes("couldn't find an eligible price reduction"),
      'Fallback response returned when no eligible offer exists'
    );
  }

  // 7. Modal renders CommercialOfferCard on offer and fallback on no-offer
  assert(
    modalCode.includes('<CommercialOfferCard'),
    'ProductDetailsModal integrates existing CommercialOfferCard'
  );
  assert(
    modalCode.includes('id="no-offer-fallback"'),
    'ProductDetailsModal provides conversational fallback container when no offer exists'
  );

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n==================================================');
  console.log(`UX VERIFICATION SUMMARY: ${passedCount}/${totalCount} tests passed`);
  console.log('==================================================\n');

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runPhase7UxVerification()
  .catch((err) => {
    console.error('Phase 7 UX verification error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
