import fetch from 'node-fetch';
import { prisma } from '../server/db/prisma';

const BASE_URL = 'http://127.0.0.1:3000';

async function verifyPhase3D() {
  console.log('--- STARTING PHASE 3D VERIFICATION ---');

  // 1. Check health
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  if (!healthRes.ok) throw new Error(`Health check failed: ${healthRes.status}`);
  console.log('✓ API Health OK');

  // 2. Fetch active store from database
  const store = await prisma.store.findFirst();
  if (!store) throw new Error('No store found in database');
  console.log(`✓ Retrieved store: ${store.name} (id: ${store.id}, slug: ${store.slug})`);

  // 3. Test creating a product without status (should default to DRAFT)
  const newProductPayload1 = {
    storeId: store.id,
    name: 'AeroPulse Wireless Earbuds Test',
    description: 'High fidelity audio earbuds with active noise cancellation.',
    category: 'Audio',
    brand: 'AeroSound',
    price: 3499,
    costPrice: 1900,
    stock: 75,
    images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800'],
    features: ['ANC', '30hr battery', 'IPX5 water resistance'],
    specifications: { driver: '11mm Dynamic', bluetooth: '5.3' },
    tags: ['wireless', 'anc', 'earbuds', 'audio'],
  };

  const createRes1 = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newProductPayload1),
  });

  if (createRes1.status !== 201) {
    const errBody = await createRes1.text();
    throw new Error(`Failed to create product 1: status ${createRes1.status}, body: ${errBody}`);
  }

  const res1Json = await createRes1.json() as any;
  const createdProd1 = res1Json.data || res1Json;
  console.log(`✓ Product 1 created: ID=${createdProd1.id}, Name="${createdProd1.name}", Status=${createdProd1.status}`);
  if (createdProd1.status !== 'DRAFT') {
    throw new Error(`Expected status to default to DRAFT, got ${createdProd1.status}`);
  }

  // 4. Test creating a product with explicit status
  const newProductPayload2 = {
    storeId: store.id,
    name: 'Titan Smartwatch Pro Test',
    description: 'Rugged smartwatch with sapphire glass and GPS tracking.',
    category: 'Wearables',
    brand: 'Titan',
    price: 8999,
    costPrice: 5200,
    stock: 30,
    images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800'],
    tags: ['smartwatch', 'wearables', 'fitness'],
    status: 'PUBLISHED',
  };

  const createRes2 = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newProductPayload2),
  });

  if (createRes2.status !== 201) {
    const errBody = await createRes2.text();
    throw new Error(`Failed to create product 2: status ${createRes2.status}, body: ${errBody}`);
  }

  const res2Json = await createRes2.json() as any;
  const createdProd2 = res2Json.data || res2Json;
  console.log(`✓ Product 2 created: ID=${createdProd2.id}, Name="${createdProd2.name}", Status=${createdProd2.status}`);
  if (createdProd2.status !== 'PUBLISHED') {
    throw new Error(`Expected status to be PUBLISHED, got ${createdProd2.status}`);
  }

  // 5. Test validation: Missing Name
  const invalidNameRes = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...newProductPayload1, name: '' }),
  });
  if (invalidNameRes.status !== 400) {
    throw new Error(`Expected 400 for empty name, got ${invalidNameRes.status}`);
  }
  console.log('✓ Validation: Correctly rejected empty name with 400');

  // 6. Test validation: Negative price
  const invalidPriceRes = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...newProductPayload1, price: -10 }),
  });
  if (invalidPriceRes.status !== 400) {
    throw new Error(`Expected 400 for negative price, got ${invalidPriceRes.status}`);
  }
  console.log('✓ Validation: Correctly rejected negative price with 400');

  // 7. Verify newly created products appear in catalog
  const listRes = await fetch(`${BASE_URL}/api/products?storeId=${store.id}`);
  if (!listRes.ok) throw new Error(`Failed to list products: ${listRes.status}`);
  const listJson = await listRes.json() as any;
  const list = Array.isArray(listJson) ? listJson : listJson.data;
  const found1 = list.find((p: any) => p.id === createdProd1.id);
  const found2 = list.find((p: any) => p.id === createdProd2.id);

  if (!found1 || !found2) {
    throw new Error('Created products were not found in store catalog listing');
  }
  console.log(`✓ Catalog Listing: Found both newly created products in catalog of ${list.length} items`);

  console.log('--- ALL PHASE 3D VERIFICATIONS PASSED SUCCESSFULLY ---');
}

verifyPhase3D().catch((err) => {
  console.error('Phase 3D verification failed:', err);
  process.exit(1);
});
