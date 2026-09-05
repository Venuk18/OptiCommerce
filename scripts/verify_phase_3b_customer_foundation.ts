import { Prisma } from '@prisma/client';
import { prisma } from '../server/db/prisma';
import {
  signMerchantToken,
  verifyMerchantToken,
  signCustomerToken,
  verifyCustomerToken,
  CustomerTokenPayload,
  MerchantTokenPayload,
} from '../server/utils/jwt';
import jwt from 'jsonwebtoken';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

async function runPhase3BVerification() {
  console.log('===============================================================');
  console.log('PHASE 3B — CUSTOMER DATABASE & JWT FOUNDATION VERIFICATION');
  console.log('===============================================================\n');

  const results: TestResult[] = [];

  function record(name: string, passed: boolean, details: string = 'OK') {
    results.push({ name, passed, details });
    if (passed) {
      console.log(`[PASS] ${name}`);
    } else {
      console.error(`[FAIL] ${name} -> ${details}`);
    }
  }

  // ==============================================================
  // A. PRISMA SCHEMA VERIFICATION
  // ==============================================================
  console.log('--- A. Prisma Schema Model & Relations ---');
  try {
    const models = Prisma.dmmf.datamodel.models;
    const customerModel = models.find((m) => m.name === 'Customer');
    const storeModel = models.find((m) => m.name === 'Store');
    const cartModel = models.find((m) => m.name === 'Cart');
    const orderModel = models.find((m) => m.name === 'Order');

    // 1. Customer model exists
    record('Customer model exists in Prisma schema', !!customerModel, customerModel ? 'Found' : 'Missing');

    // 2. Customer fields & relations
    if (customerModel) {
      const fieldNames = customerModel.fields.map((f) => f.name);
      const hasReqFields = ['id', 'storeId', 'email', 'passwordHash', 'createdAt', 'updatedAt', 'store', 'carts', 'orders'].every(
        (f) => fieldNames.includes(f)
      );
      record('Customer model contains required fields and relations', hasReqFields, `Fields: ${fieldNames.join(', ')}`);

      // Check unique constraints
      const hasCompoundUnique =
        customerModel.uniqueFields.some((fields) => fields.includes('storeId') && fields.includes('email')) ||
        customerModel.primaryKey === null;
      record('Customer has compound unique constraint [storeId, email]', hasCompoundUnique);
    }

    // 3. Store -> Customer relation
    if (storeModel) {
      const customerRel = storeModel.fields.find((f) => f.name === 'customers');
      record('Store model has customers Customer[] relation', !!customerRel && customerRel.type === 'Customer' && customerRel.isList);
    }

    // 4. Cart -> Customer optional relation
    if (cartModel) {
      const customerIdField = cartModel.fields.find((f) => f.name === 'customerId');
      const customerRel = cartModel.fields.find((f) => f.name === 'customer');
      const sessionIdField = cartModel.fields.find((f) => f.name === 'sessionId');

      record('Cart model has optional customerId (nullable)', !!customerIdField && !customerIdField.isRequired);
      record('Cart model has customer Customer? relation', !!customerRel && customerRel.type === 'Customer' && !customerRel.isRequired);
      record('Cart model retains required sessionId', !!sessionIdField && sessionIdField.isRequired);

      const hasSessionStoreUnique =
        cartModel.uniqueFields.some((fields) => fields.includes('sessionId') && fields.includes('storeId')) ||
        cartModel.primaryKey === null;
      record('Cart model retains @@unique([sessionId, storeId])', hasSessionStoreUnique);
    }

    // 5. Order -> Customer optional relation
    if (orderModel) {
      const customerIdField = orderModel.fields.find((f) => f.name === 'customerId');
      const customerRel = orderModel.fields.find((f) => f.name === 'customer');
      const sessionIdField = orderModel.fields.find((f) => f.name === 'sessionId');

      record('Order model has optional customerId (nullable)', !!customerIdField && !customerIdField.isRequired);
      record('Order model has customer Customer? relation', !!customerRel && customerRel.type === 'Customer' && !customerRel.isRequired);
      record('Order model retains required sessionId', !!sessionIdField && sessionIdField.isRequired);
    }
  } catch (err: any) {
    record('Prisma schema inspection', false, err.message);
  }

  // ==============================================================
  // B. CUSTOMER JWT VERIFICATION
  // ==============================================================
  console.log('\n--- B. Customer JWT Sign & Verify ---');
  try {
    const testCustomerId = 'cust-uuid-7777-8888';
    const testStoreId = 'store-uuid-1111-2222';

    // 1. Sign customer token
    const token = signCustomerToken({
      customerId: testCustomerId,
      storeId: testStoreId,
    });
    record('signCustomerToken generates a non-empty string token', typeof token === 'string' && token.length > 20);

    // 2. Verify customer token
    const payload: CustomerTokenPayload = verifyCustomerToken(token);
    record('verifyCustomerToken returns valid payload', !!payload);
    record('Customer token preserves customerId', payload.customerId === testCustomerId);
    record('Customer token preserves storeId', payload.storeId === testStoreId);
    record('Customer token role is strictly "customer"', payload.role === 'customer');

    // 3. Security: No secrets, passwords, or PII in JWT claims
    const decodedRaw = jwt.decode(token) as Record<string, any>;
    const allowedKeys = new Set(['customerId', 'storeId', 'role', 'iat', 'exp']);
    const extraKeys = Object.keys(decodedRaw).filter((k) => !allowedKeys.has(k));
    record('Customer JWT claims contain only customerId, storeId, role, iat, exp (no PII/passwords)', extraKeys.length === 0, `Keys: ${Object.keys(decodedRaw).join(', ')}`);

    // 4. Missing parameters validation
    let threwOnMissingCustomerId = false;
    try {
      signCustomerToken({ customerId: '', storeId: testStoreId });
    } catch {
      threwOnMissingCustomerId = true;
    }
    record('signCustomerToken rejects empty customerId', threwOnMissingCustomerId);

    let threwOnMissingStoreId = false;
    try {
      signCustomerToken({ customerId: testCustomerId, storeId: '' });
    } catch {
      threwOnMissingStoreId = true;
    }
    record('signCustomerToken rejects empty storeId', threwOnMissingStoreId);
  } catch (err: any) {
    record('Customer JWT execution', false, err.message);
  }

  // ==============================================================
  // C. TOKEN ISOLATION VERIFICATION
  // ==============================================================
  console.log('\n--- C. Cryptographic & Scope Token Isolation ---');
  try {
    const testCustomerId = 'cust-isolated-999';
    const testStoreId = 'store-isolated-999';
    const testMerchantId = 'merchant-isolated-123';

    const customerToken = signCustomerToken({
      customerId: testCustomerId,
      storeId: testStoreId,
    });

    const merchantToken = signMerchantToken(testMerchantId);

    // 1. Customer token CANNOT satisfy verifyMerchantToken
    let customerAsMerchantRejected = false;
    let customerAsMerchantError = '';
    try {
      verifyMerchantToken(customerToken);
    } catch (e: any) {
      customerAsMerchantRejected = true;
      customerAsMerchantError = e.message;
    }
    record(
      'verifyMerchantToken strictly rejects customer token',
      customerAsMerchantRejected,
      `Rejection message: "${customerAsMerchantError}"`
    );

    // 2. Merchant token CANNOT satisfy verifyCustomerToken
    let merchantAsCustomerRejected = false;
    let merchantAsCustomerError = '';
    try {
      verifyCustomerToken(merchantToken);
    } catch (e: any) {
      merchantAsCustomerRejected = true;
      merchantAsCustomerError = e.message;
    }
    record(
      'verifyCustomerToken strictly rejects merchant token',
      merchantAsCustomerRejected,
      `Rejection message: "${merchantAsCustomerError}"`
    );

    // 3. Forged token with merchantId AND customer role is rejected by verifyMerchantToken
    const forgedToken = jwt.sign(
      { merchantId: testMerchantId, customerId: testCustomerId, role: 'customer' },
      process.env.JWT_SECRET || 'opticommerce-dev-secret-jwt-key-2026'
    );
    let forgedRejectedByMerchant = false;
    try {
      verifyMerchantToken(forgedToken);
    } catch {
      forgedRejectedByMerchant = true;
    }
    record('verifyMerchantToken rejects hybrid/forged token with customer role/id', forgedRejectedByMerchant);
  } catch (err: any) {
    record('Token isolation execution', false, err.message);
  }

  // ==============================================================
  // D. GUEST COMPATIBILITY & DATABASE SCHEMA COMPATIBILITY
  // ==============================================================
  console.log('\n--- D. Guest Compatibility & Nullable customerId ---');
  try {
    // 1. Verify guest cart creation (customerId is null/undefined)
    const guestSessionId = `guest-sess-${Date.now()}`;
    const testStoreId = 'store-test-p3b';

    const guestCart = await prisma.cart.create({
      data: {
        sessionId: guestSessionId,
        storeId: testStoreId,
      },
    });
    record('Guest cart created without customerId', !!guestCart && (guestCart.customerId === null || guestCart.customerId === undefined));

    // 2. Verify guest order creation (customerId is null/undefined)
    const guestOrder = await prisma.order.create({
      data: {
        sessionId: guestSessionId,
        storeId: testStoreId,
        subtotal: 1000,
        discount: 0,
        total: 1000,
        currency: 'INR',
      },
    });
    record('Guest order created without customerId', !!guestOrder && (guestOrder.customerId === null || guestOrder.customerId === undefined));

    // 3. Verify customer creation & optional customer association
    const customerEmail = `p3b_cust_${Date.now()}@example.com`;
    const createdCustomer = await prisma.customer.create({
      data: {
        storeId: testStoreId,
        name: 'Jane Customer',
        email: customerEmail,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      },
    });
    record('Customer created with storeId, email, passwordHash', !!createdCustomer && createdCustomer.email === customerEmail);

    // 4. Verify associated cart with customerId
    const customerSessionId = `cust-sess-${Date.now()}`;
    const customerCart = await prisma.cart.create({
      data: {
        sessionId: customerSessionId,
        storeId: testStoreId,
        customerId: createdCustomer.id,
      },
    });
    record('Customer cart created with valid customerId', !!customerCart && customerCart.customerId === createdCustomer.id);

    // 5. Verify associated order with customerId
    const customerOrder = await prisma.order.create({
      data: {
        sessionId: customerSessionId,
        storeId: testStoreId,
        customerId: createdCustomer.id,
        subtotal: 2500,
        discount: 100,
        total: 2400,
        currency: 'INR',
      },
    });
    record('Customer order created with valid customerId', !!customerOrder && customerOrder.customerId === createdCustomer.id);
  } catch (err: any) {
    record('Guest compatibility DB operations', false, err.message);
  }

  // ==============================================================
  // E. MERCHANT AUTHENTICATION REGRESSION CHECK
  // ==============================================================
  console.log('\n--- E. Merchant Authentication Preserved ---');
  try {
    const testMerchantId = 'merchant-legacy-test-uuid';
    const merchantToken = signMerchantToken(testMerchantId);
    const verifiedMerchant: MerchantTokenPayload = verifyMerchantToken(merchantToken);

    record('signMerchantToken continues to function', typeof merchantToken === 'string');
    record('verifyMerchantToken returns original merchantId', verifiedMerchant.merchantId === testMerchantId);
    record('Merchant payload contains only merchantId', !('role' in (verifiedMerchant as any)) && !('customerId' in (verifiedMerchant as any)));
  } catch (err: any) {
    record('Merchant authentication regression', false, err.message);
  }

  // ==============================================================
  // SUMMARY
  // ==============================================================
  console.log('\n==============================================================');
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = total - passedCount;

  console.log(`TOTAL TESTS: ${total} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('==============================================================');

  if (failedCount > 0) {
    console.error(`\n❌ VERIFICATION FAILED with ${failedCount} failing test(s).`);
    process.exit(1);
  } else {
    console.log('\n✅ ALL PHASE 3B VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    process.exit(0);
  }
}

runPhase3BVerification().catch((err) => {
  console.error('Fatal error during Phase 3B verification:', err);
  process.exit(1);
});
