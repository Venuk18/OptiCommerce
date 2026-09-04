import { prisma } from '../server/db/prisma';
import { commercialEngineService } from '../server/services/revenue/commercial-engine.service';
import { hesitationDetectorService } from '../server/services/revenue/hesitation-detector.service';
import { offerFatigueService } from '../server/services/revenue/offer-fatigue.service';
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

async function runPhase7Verification() {
  console.log('\n==================================================');
  console.log('OPTICOMMERCE PHASE 7 COMPREHENSIVE VERIFICATION');
  console.log('Intent-Aware Commercial Offers & Merchant Value');
  console.log('==================================================\n');

  // Enforce zero real API quota consumption across test runs
  aiProviderOrchestrator.setMode('deterministic');

  // Retrieve published test store and products
  const store = await prisma.store.findFirst();
  if (!store) {
    throw new Error('Store not found. Please ensure database is seeded.');
  }
  const storeId = store.id;

  const products = await prisma.product.findMany({
    where: { storeId, status: 'PUBLISHED' },
  });

  if (products.length < 2) {
    throw new Error('At least 2 published products are required in store for Phase 7 verification.');
  }

  const testProduct = products[0];
  const secondProduct = products[1];

  console.log(`Using Store: ${store.name} (${storeId})`);
  console.log(`Test Product: ${testProduct.name} (Price: ₹${testProduct.price}, Cost: ₹${testProduct.costPrice})\n`);

  // ==========================================
  // SUITE 1: Hesitation Signal Detection
  // ==========================================
  console.log('--- SUITE 1: Hesitation Signal Detection ---');

  const priceQuery1 = 'This is a bit too expensive for me, is there a discount?';
  const sig1 = hesitationDetectorService.detectHesitation(priceQuery1);
  assert(sig1.type === 'PRICE', 'Detects PRICE hesitation for "too expensive / discount query"', `Got: ${sig1.type}`);
  assert(sig1.confidence >= 0.8, 'Assigns high confidence to explicit price hesitation');

  const valueQuery = 'Is this laptop really worth the money compared to others?';
  const sig2 = hesitationDetectorService.detectHesitation(valueQuery);
  assert(sig2.type === 'VALUE', 'Detects VALUE hesitation for "worth the money" query', `Got: ${sig2.type}`);

  const uncertaintyQuery = 'I am not sure if I should buy this right now, need to think';
  const sig3 = hesitationDetectorService.detectHesitation(uncertaintyQuery);
  assert(sig3.type === 'UNCERTAINTY', 'Detects UNCERTAINTY hesitation for "need to think"', `Got: ${sig3.type}`);

  const abandonQuery = 'Never mind then, I will pass for now';
  const sig4 = hesitationDetectorService.detectHesitation(abandonQuery);
  assert(sig4.type === 'ABANDONMENT', 'Detects ABANDONMENT hesitation for "never mind, I will pass"', `Got: ${sig4.type}`);

  const neutralQuery = 'Show me wireless Bluetooth headphones';
  const sig5 = hesitationDetectorService.detectHesitation(neutralQuery);
  assert(sig5.type === 'NONE', 'Returns NONE for standard product discovery query', `Got: ${sig5.type}`);

  // ==========================================
  // SUITE 2: Deterministic Commercial Engine & Margin Safety
  // ==========================================
  console.log('\n--- SUITE 2: Deterministic Commercial Engine & Margin Safety ---');

  const sessionA = `p7-test-session-a-${Date.now()}`;

  // Evaluate price hesitation on testProduct
  const decision1 = await commercialEngineService.evaluateCommercialDecision({
    storeId,
    sessionId: sessionA,
    query: 'This is a bit steep for my budget, can you give me any discount?',
    productId: testProduct.id,
  });

  assert(
    decision1.decision === 'SMALL_DISCOUNT' || decision1.decision === 'TARGETED_OFFER' || decision1.decision === 'BUNDLE_VALUE' || decision1.decision === 'NON_PRICE_INCENTIVE',
    'Commercial engine produces valid authorized intervention',
    `Decision: ${decision1.decision}`
  );

  // Verify Margin Floor: final price must NEVER be below cost price
  if (decision1.offer.finalPrice !== undefined) {
    const cost = Number(testProduct.costPrice);
    assert(
      decision1.offer.finalPrice >= cost,
      `Margin Floor strictly enforced: finalPrice (₹${decision1.offer.finalPrice}) >= costPrice (₹${cost})`
    );
  }

  // Verify token generation
  assert(
    typeof decision1.offer.token === 'string' && decision1.offer.token.length > 10,
    'Commercial engine produces cryptographic token for offer validation'
  );

  // ==========================================
  // SUITE 3: Customer DTO Sanitization (Zero Leakage)
  // ==========================================
  console.log('\n--- SUITE 3: Customer DTO Sanitization (Zero Economic Leakage) ---');

  const customerResponse = commercialEngineService.toCustomerResponse(decision1);
  const jsonStr = JSON.stringify(customerResponse);

  assert(!jsonStr.includes('costPrice'), 'Customer response NEVER contains costPrice');
  assert(!jsonStr.includes('marginPercent'), 'Customer response NEVER contains marginPercent');
  assert(!jsonStr.includes('internalScore'), 'Customer response NEVER contains internalScore');
  assert(!jsonStr.includes('purchaseProbability'), 'Customer response NEVER contains purchaseProbability');
  assert(customerResponse.offer.productId === testProduct.id, 'Customer response accurately identifies offered product');

  // ==========================================
  // SUITE 4: HMAC Token Validation & Tamper Resistance
  // ==========================================
  console.log('\n--- SUITE 4: HMAC Token Validation & Tamper Resistance ---');

  // Accept with valid token
  const acceptResult = await commercialEngineService.acceptOffer({
    storeId,
    sessionId: sessionA,
    productId: testProduct.id,
    offerType: decision1.offer.type,
    discountPercent: decision1.offer.discountPercent || 0,
    token: decision1.offer.token,
  });

  assert(acceptResult.success === true, 'Accepts valid commercial offer with correct HMAC token');

  // Attempt to tamper with discount percent (e.g. client claims 50% discount instead of 10%)
  let tamperedCaught = false;
  try {
    await commercialEngineService.acceptOffer({
      storeId,
      sessionId: sessionA,
      productId: testProduct.id,
      offerType: decision1.offer.type,
      discountPercent: 50, // Tampered discount!
      token: decision1.offer.token,
    });
  } catch (err: any) {
    tamperedCaught = true;
  }
  assert(tamperedCaught, 'Tampered discount percent is rejected by HMAC validation');

  // ==========================================
  // SUITE 5: Offer Fatigue & Margin Erosion Suppression
  // ==========================================
  console.log('\n--- SUITE 5: Offer Fatigue & Margin Erosion Suppression ---');

  const fatigueSession = `p7-fatigue-session-${Date.now()}`;

  // Check initial fatigue state
  const check1 = offerFatigueService.checkFatigue(fatigueSession, testProduct.id);
  assert(check1.suppressOffer === false, 'Initial session is not fatigued');

  // Simulate offer view
  offerFatigueService.recordOfferView(fatigueSession, testProduct.id, 'SMALL_DISCOUNT');
  const check2 = offerFatigueService.checkFatigue(fatigueSession, testProduct.id);
  assert(check2.suppressOffer === true, 'Immediate duplicate offer on same product is suppressed by cooldown');

  // Simulate multiple rejections
  offerFatigueService.recordOfferRejection(fatigueSession, testProduct.id, 'SMALL_DISCOUNT');
  offerFatigueService.recordOfferRejection(fatigueSession, secondProduct.id, 'TARGETED_OFFER');

  const check3 = offerFatigueService.checkFatigue(fatigueSession, secondProduct.id);
  assert(check3.suppressOffer === true, 'Consecutive rejections trigger fatigue suppression to prevent erosion');

  // Commercial engine evaluation under fatigue should NOT return a discount
  const fatiguedDecision = await commercialEngineService.evaluateCommercialDecision({
    storeId,
    sessionId: fatigueSession,
    query: 'give me a big discount please',
    productId: testProduct.id,
  });

  assert(
    fatiguedDecision.decision === 'NO_OFFER' || fatiguedDecision.decision === 'NON_PRICE_INCENTIVE' || fatiguedDecision.decision === 'SALE_RECOVERY',
    'Commercial engine suppresses discounts under fatigue and falls back safely',
    `Got decision: ${fatiguedDecision.decision}`
  );

  // ==========================================
  // SUITE 6: Offer Rejection & Recovery Routing
  // ==========================================
  console.log('\n--- SUITE 6: Offer Rejection & Recovery Routing ---');

  const rejectResult = await commercialEngineService.rejectOffer({
    storeId,
    sessionId: sessionA,
    productId: testProduct.id,
    offerType: decision1.offer.type,
    reason: 'Too expensive for my budget',
  });

  assert(rejectResult.success === true, 'Successfully records offer rejection');
  assert(Array.isArray(rejectResult.recoveryAlternatives), 'Returns recovery alternatives upon rejection');

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n==================================================');
  console.log(`VERIFICATION SUMMARY: ${passedCount}/${totalCount} tests passed`);
  console.log('==================================================\n');

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runPhase7Verification()
  .catch((err) => {
    console.error('Phase 7 verification error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
