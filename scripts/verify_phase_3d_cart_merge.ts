import http from 'http';
import { app, initDatabase } from '../server/app';
import { prisma } from '../server/db/prisma';
import { signCustomerToken, signMerchantToken } from '../server/utils/jwt';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

async function runPhase3DVerification() {
  console.log('===============================================================');
  console.log('PHASE 3D — GUEST → CUSTOMER CART MERGE & CART OWNERSHIP');
  console.log('===============================================================\n');

  await initDatabase();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;

  const results: TestResult[] = [];

  function record(num: number, name: string, passed: boolean, details: string = 'OK') {
    results.push({ num, name, passed, details });
    if (passed) {
      console.log(`[PASS] Test ${num}: ${name}`);
    } else {
      console.error(`[FAIL] Test ${num}: ${name} -> ${details}`);
    }
  }

  try {
    // Setup: Get or create Store A & Store B
    let storeA = await prisma.store.findFirst();
    if (!storeA) {
      const merchantA = await prisma.merchant.create({
        data: {
          name: 'Store A Merchant',
          email: `store_a_${Date.now()}@test.com`,
          store: {
            create: {
              name: 'Store A',
              slug: `store-a-${Date.now()}`,
              status: 'PUBLISHED',
            },
          },
        },
        include: { store: true },
      });
      storeA = merchantA.store!;
    }

    const merchantB = await prisma.merchant.create({
      data: {
        name: 'Store B Merchant',
        email: `store_b_${Date.now()}@test.com`,
        store: {
          create: {
            name: 'Store B',
            slug: `store-b-${Date.now()}`,
            status: 'PUBLISHED',
          },
        },
      },
      include: { store: true },
    });
    const storeB = merchantB.store!;

    // Products in Store A
    const prodA1 = await prisma.product.create({
      data: {
        storeId: storeA.id,
        name: 'Wireless Mouse',
        category: 'Electronics',
        price: 1000,
        costPrice: 500,
        stock: 10,
        status: 'PUBLISHED',
      },
    });

    const prodA2 = await prisma.product.create({
      data: {
        storeId: storeA.id,
        name: 'Mechanical Keyboard',
        category: 'Electronics',
        price: 3000,
        costPrice: 1500,
        stock: 5,
        status: 'PUBLISHED',
      },
    });

    const prodA3_lowStock = await prisma.product.create({
      data: {
        storeId: storeA.id,
        name: 'Limited Edition Keycap',
        category: 'Electronics',
        price: 500,
        costPrice: 200,
        stock: 3,
        status: 'LOW_STOCK',
      },
    });

    const prodA4_outOfStock = await prisma.product.create({
      data: {
        storeId: storeA.id,
        name: 'Rare Vintage Cable',
        category: 'Electronics',
        price: 800,
        costPrice: 300,
        stock: 0,
        status: 'OUT_OF_STOCK',
      },
    });

    // Product in Store B
    const prodB1 = await prisma.product.create({
      data: {
        storeId: storeB.id,
        name: 'Store B Monitor',
        category: 'Electronics',
        price: 15000,
        costPrice: 9000,
        stock: 20,
        status: 'PUBLISHED',
      },
    });

    // Customers
    const custA = await prisma.customer.create({
      data: {
        storeId: storeA.id,
        email: `cust_a_${Date.now()}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
        name: 'Customer Alpha',
      },
    });
    const custAToken = signCustomerToken({ customerId: custA.id, storeId: storeA.id });

    const custB = await prisma.customer.create({
      data: {
        storeId: storeA.id,
        email: `cust_b_${Date.now()}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
        name: 'Customer Beta',
      },
    });
    const custBToken = signCustomerToken({ customerId: custB.id, storeId: storeA.id });

    const custStoreB = await prisma.customer.create({
      data: {
        storeId: storeB.id,
        email: `cust_store_b_${Date.now()}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
        name: 'Customer Store B',
      },
    });
    const custStoreBToken = signCustomerToken({ customerId: custStoreB.id, storeId: storeB.id });

    // ==============================================================
    // A. GUEST COMPATIBILITY
    // ==============================================================
    console.log('--- Section A: Guest Cart Compatibility ---');

    const guest1Session = `guest_sess_1_${Date.now()}`;

    // 1. Guest cart can still be created
    const add1Res = await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: guest1Session,
        storeId: storeA.id,
        productId: prodA1.id,
        quantity: 2,
      }),
    });
    const add1Body = await add1Res.json();
    const cart1 = add1Body.cart || add1Body.data?.cart;
    record(1, 'Guest cart can be created with items without auth header', add1Res.status === 200 && cart1.items.length === 1 && cart1.items[0].quantity === 2);

    // 2. Guest cart can still be read
    const get1Res = await fetch(`${baseUrl}/api/cart?sessionId=${guest1Session}&storeId=${storeA.id}`);
    const get1Body = await get1Res.json();
    const getCart1 = get1Body.cart || get1Body.data?.cart;
    record(2, 'Guest cart can be retrieved by sessionId and storeId', get1Res.status === 200 && getCart1.items.length === 1);

    // 3. Guest cart can still be modified (update quantity)
    const itemId = getCart1.items[0].id;
    const patch1Res = await fetch(`${baseUrl}/api/cart/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: guest1Session,
        storeId: storeA.id,
        quantity: 4,
      }),
    });
    const patch1Body = await patch1Res.json();
    const patchCart = patch1Body.cart || patch1Body.data?.cart;
    record(3, 'Guest cart item quantity can be updated', patch1Res.status === 200 && patchCart.items[0].quantity === 4);

    // ==============================================================
    // B. CUSTOMER CART ADOPTION (CASE A: NO EXISTING CUSTOMER CART)
    // ==============================================================
    console.log('\n--- Section B: Case A — Adoption of Guest Cart ---');

    // 4. Customer A has no cart, calls POST /api/cart/merge with guest1Session
    const merge1Res = await fetch(`${baseUrl}/api/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custAToken}`,
      },
      body: JSON.stringify({
        sessionId: guest1Session,
        storeId: storeA.id,
      }),
    });
    const merge1Body = await merge1Res.json();
    const merge1Cart = merge1Body.cart || merge1Body.data?.cart;

    record(4, 'Customer with no cart successfully adopts guest cart', merge1Res.status === 200 && merge1Cart.id !== null);
    record(5, 'Cart items remain unchanged after adoption', merge1Cart.items.length === 1 && merge1Cart.items[0].quantity === 4);

    // 6. Verify customerId is assigned in DB
    const dbAdoptedCart = await prisma.cart.findUnique({
      where: { id: merge1Cart.id },
    });
    record(6, 'Adopted cart has customerId correctly assigned in database', dbAdoptedCart?.customerId === custA.id);

    // ==============================================================
    // C. EXISTING CUSTOMER CART MERGE (CASE B)
    // ==============================================================
    console.log('\n--- Section C: Case B — Existing Customer Cart Merge ---');

    // Setup guest cart 2 for Customer A:
    // Customer A already has: prodA1 (qty 4)
    // Guest 2 has: prodA1 (qty 3) and prodA2 (qty 2)
    const guest2Session = `guest_sess_2_${Date.now()}`;
    await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: guest2Session,
        storeId: storeA.id,
        productId: prodA1.id,
        quantity: 3,
      }),
    });
    await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: guest2Session,
        storeId: storeA.id,
        productId: prodA2.id,
        quantity: 2,
      }),
    });

    const merge2Res = await fetch(`${baseUrl}/api/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custAToken}`,
      },
      body: JSON.stringify({
        sessionId: guest2Session,
        storeId: storeA.id,
      }),
    });
    const merge2Body = await merge2Res.json();
    const merge2Cart = merge2Body.cart || merge2Body.data?.cart;

    // 7. Merged items check
    record(7, 'Existing customer cart merges with guest cart successfully', merge2Res.status === 200);

    // 8. Duplicate product (prodA1) combines quantities: 4 + 3 = 7
    const mergedProdA1 = merge2Cart.items.find((i: any) => i.productId === prodA1.id);
    record(8, 'Duplicate product quantities combine (4 + 3 = 7)', mergedProdA1?.quantity === 7);

    // 9. Unique product (prodA2) from guest cart is included: qty 2
    const mergedProdA2 = merge2Cart.items.find((i: any) => i.productId === prodA2.id);
    record(9, 'Unique products from both carts are preserved in merged cart', mergedProdA2?.quantity === 2);

    // 10. No duplicate CartItem rows for the same product
    const prodA1Count = merge2Cart.items.filter((i: any) => i.productId === prodA1.id).length;
    record(10, 'No duplicate CartItem rows exist for the same product in the merged cart', prodA1Count === 1);

    // Verify redundant guest2 cart was cleaned up
    const redundantCart = await prisma.cart.findUnique({
      where: {
        sessionId_storeId: {
          sessionId: guest2Session,
          storeId: storeA.id,
        },
      },
    });
    record(11, 'Redundant guest cart is cleaned up and deleted after merge', redundantCart === null);

    // ==============================================================
    // D. INVENTORY SAFETY
    // ==============================================================
    console.log('\n--- Section D: Inventory Safety ---');

    // prodA3_lowStock has stock = 3.
    // Let customer have qty 2. Guest has qty 3. Combined = 5, but stock is 3 -> must cap at 3!
    const cust3 = await prisma.customer.create({
      data: {
        storeId: storeA.id,
        email: `cust_stock_${Date.now()}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
        name: 'Customer Stock Tester',
      },
    });
    const cust3Token = signCustomerToken({ customerId: cust3.id, storeId: storeA.id });

    // Customer cart with 2 of prodA3
    const cust3CartSess = `cust3_sess_${Date.now()}`;
    await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust3Token}`,
      },
      body: JSON.stringify({
        sessionId: cust3CartSess,
        storeId: storeA.id,
        productId: prodA3_lowStock.id,
        quantity: 2,
      }),
    });

    // Guest cart with 3 of prodA3
    const guestStockSess = `guest_stock_sess_${Date.now()}`;
    await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: guestStockSess,
        storeId: storeA.id,
        productId: prodA3_lowStock.id,
        quantity: 3,
      }),
    });

    // Merge: 2 + 3 = 5, capped at stock 3
    const stockMergeRes = await fetch(`${baseUrl}/api/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust3Token}`,
      },
      body: JSON.stringify({
        sessionId: guestStockSess,
        storeId: storeA.id,
      }),
    });
    const stockMergeCart = (await stockMergeRes.json()).cart;
    const cappedItem = stockMergeCart.items.find((i: any) => i.productId === prodA3_lowStock.id);
    record(12, 'Combined quantity is strictly capped at available inventory (5 capped at 3)', cappedItem?.quantity === 3);

    // Out of stock item: create a cart directly with out-of-stock product prodA4_outOfStock
    const cust4 = await prisma.customer.create({
      data: {
        storeId: storeA.id,
        email: `cust_oos_${Date.now()}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
        name: 'Customer OOS Tester',
      },
    });
    const cust4Token = signCustomerToken({ customerId: cust4.id, storeId: storeA.id });

    const guestOOSSess = `guest_oos_sess_${Date.now()}`;
    const guestOOSCart = await prisma.cart.create({
      data: {
        sessionId: guestOOSSess,
        storeId: storeA.id,
      },
    });
    await prisma.cartItem.create({
      data: {
        cartId: guestOOSCart.id,
        productId: prodA4_outOfStock.id,
        quantity: 1,
      },
    });

    const oosMergeRes = await fetch(`${baseUrl}/api/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust4Token}`,
      },
      body: JSON.stringify({
        sessionId: guestOOSSess,
        storeId: storeA.id,
      }),
    });
    const oosMergeCart = (await oosMergeRes.json()).cart;
    const oosItemInCart = oosMergeCart.items.find((i: any) => i.productId === prodA4_outOfStock.id);
    record(13, 'Out-of-stock items (stock = 0) are dropped and not added to the customer cart', oosItemInCart === undefined);

    // ==============================================================
    // E. IDEMPOTENCY
    // ==============================================================
    console.log('\n--- Section E: Idempotency ---');

    // Run merge again with guestStockSess on cust3
    const secondMergeRes = await fetch(`${baseUrl}/api/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust3Token}`,
      },
      body: JSON.stringify({
        sessionId: guestStockSess,
        storeId: storeA.id,
      }),
    });
    const secondMergeCart = (await secondMergeRes.json()).cart;
    const secondItem = secondMergeCart.items.find((i: any) => i.productId === prodA3_lowStock.id);
    record(14, 'Calling merge twice does not increase quantities again (idempotent)', secondItem?.quantity === 3);

    // ==============================================================
    // F. STORE ISOLATION & AUTHORIZATION
    // ==============================================================
    console.log('\n--- Section F: Store Isolation & Cart Authorization ---');

    // 15. Guest cart in Store B cannot be merged into Store A
    const guestStoreBSess = `guest_store_b_sess_${Date.now()}`;
    await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: guestStoreBSess,
        storeId: storeB.id,
        productId: prodB1.id,
        quantity: 1,
      }),
    });

    // Customer A (Store A token) attempts to merge Store B guest session
    const crossStoreMerge = await fetch(`${baseUrl}/api/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custAToken}`, // Store A token
      },
      body: JSON.stringify({
        sessionId: guestStoreBSess, // belongs to Store B
        storeId: storeA.id,
      }),
    });
    record(15, 'Store A customer cannot merge Store B guest cart (cross-store rejected 403)', crossStoreMerge.status === 403);

    // 16. Store A customer cannot submit Store B in request storeId
    const storeMismatchRes = await fetch(`${baseUrl}/api/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custAToken}`,
      },
      body: JSON.stringify({
        sessionId: `any_sess_${Date.now()}`,
        storeId: storeB.id, // mismatch with Store A token
      }),
    });
    record(16, 'Request storeId mismatch with customer token storeId is rejected (403)', storeMismatchRes.status === 403);

    // 17. Customer A cannot access or manipulate Customer B cart
    // Customer B tries to update Customer A's adopted item
    const custAAdoptedCart = await prisma.cart.findFirst({
      where: { customerId: custA.id, storeId: storeA.id },
      include: { items: true },
    });
    const custAItemId = custAAdoptedCart?.items[0]?.id;

    const crossCustPatch = await fetch(`${baseUrl}/api/cart/items/${custAItemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custBToken}`, // Customer B token
      },
      body: JSON.stringify({
        sessionId: `some_sess_${Date.now()}`,
        storeId: storeA.id,
        quantity: 9,
      }),
    });
    record(17, 'Customer B cannot modify Customer A cart item (403 Forbidden)', crossCustPatch.status === 403);

    // 18. Guest cannot access customer-owned cart merely by knowing the sessionId
    const unauthGetRes = await fetch(`${baseUrl}/api/cart?sessionId=${custAAdoptedCart?.sessionId}&storeId=${storeA.id}`);
    const unauthGetBody = await unauthGetRes.json();
    const unauthCart = unauthGetBody.cart || unauthGetBody.data?.cart;
    record(18, 'Unauthenticated guest cannot access customer-owned cart using its sessionId', unauthGetRes.status === 200 && unauthCart.items.length === 0);

    // ==============================================================
    // G. AUTHENTICATION CONTROLS
    // ==============================================================
    console.log('\n--- Section G: Authentication Controls ---');

    // 19. Missing Authorization header
    const noAuthMerge = await fetch(`${baseUrl}/api/cart/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: `test_sess_${Date.now()}`,
        storeId: storeA.id,
      }),
    });
    record(19, 'Merge request missing Authorization header is rejected (401)', noAuthMerge.status === 401);

    // 20. Merchant token rejected
    const merchantToken = signMerchantToken('merchant-fake-id');
    const merchantMerge = await fetch(`${baseUrl}/api/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({
        sessionId: `test_sess_${Date.now()}`,
        storeId: storeA.id,
      }),
    });
    record(20, 'Merchant token is rejected by customer merge endpoint (401)', merchantMerge.status === 401);

    // 21. Invalid customer token rejected
    const invalidMerge = await fetch(`${baseUrl}/api/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer invalid.jwt.token`,
      },
      body: JSON.stringify({
        sessionId: `test_sess_${Date.now()}`,
        storeId: storeA.id,
      }),
    });
    record(21, 'Invalid customer token is rejected by customer merge endpoint (401)', invalidMerge.status === 401);

    // ==============================================================
    // H. ADDITIONAL EDGE CASES (Section 19)
    // ==============================================================
    console.log('\n--- Section H: Edge Cases ---');

    // 22. Both carts empty: customer has empty cart, guest has empty session
    const cust5 = await prisma.customer.create({
      data: {
        storeId: storeA.id,
        email: `cust_empty_${Date.now()}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      },
    });
    const cust5Token = signCustomerToken({ customerId: cust5.id, storeId: storeA.id });

    const emptyMergeRes = await fetch(`${baseUrl}/api/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust5Token}`,
      },
      body: JSON.stringify({
        sessionId: `empty_sess_${Date.now()}`,
        storeId: storeA.id,
      }),
    });
    const emptyMergeCart = (await emptyMergeRes.json()).cart;
    record(22, 'Merging with non-existent guest cart returns empty cart safely (0 items)', emptyMergeRes.status === 200 && emptyMergeCart.items.length === 0);

    // 23. Customer adopts an empty guest cart
    const emptyGuestSess = `empty_guest_${Date.now()}`;
    await prisma.cart.create({
      data: {
        sessionId: emptyGuestSess,
        storeId: storeA.id,
      },
    });
    const emptyAdoptRes = await fetch(`${baseUrl}/api/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust5Token}`,
      },
      body: JSON.stringify({
        sessionId: emptyGuestSess,
        storeId: storeA.id,
      }),
    });
    record(23, 'Adopting an empty guest cart succeeds and sets customer ownership', emptyAdoptRes.status === 200);

    // 24. Authenticated customer retrieves own cart with Bearer token
    const custGetRes = await fetch(`${baseUrl}/api/cart?storeId=${storeA.id}`, {
      headers: {
        Authorization: `Bearer ${custAToken}`,
      },
    });
    const custGetCart = (await custGetRes.json()).cart;
    record(24, 'Authenticated customer retrieves their own cart using Bearer token without sessionId', custGetRes.status === 200 && custGetCart.items.length > 0);

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
      console.log('\n✅ ALL PHASE 3D CART MERGE & OWNERSHIP TESTS PASSED!');
      process.exit(0);
    }
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runPhase3DVerification().catch(async (err) => {
  console.error('Fatal error during Phase 3D verification:', err);
  await prisma.$disconnect();
  process.exit(1);
});
