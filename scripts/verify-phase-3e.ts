import fetch from 'node-fetch';
import { prisma } from '../server/db/prisma';
import { parseAndValidateProductsCsv, generateSampleCsv } from '../src/utils/csvParser';

const BASE_URL = 'http://127.0.0.1:3000';

async function verifyPhase3E() {
  console.log('====================================================');
  console.log('--- STARTING PHASE 3E CSV IMPORT VERIFICATION ---');
  console.log('====================================================\n');

  // 1. Health check
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  if (!healthRes.ok) throw new Error(`Health check failed: ${healthRes.status}`);
  console.log('✓ [16] Health endpoint OK');

  // 2. Retrieve active merchant store
  const store = await prisma.store.findFirst();
  if (!store) throw new Error('No store found in database');
  console.log(`✓ [11] Retrieved active store: "${store.name}" (id: ${store.id})`);

  // 3. Test Sample CSV Template Generation
  const sampleCsv = generateSampleCsv();
  if (!sampleCsv.includes('name,description,category') || !sampleCsv.includes('ZenPods Elite 2')) {
    throw new Error('generateSampleCsv output is missing expected template fields');
  }
  console.log('✓ CSV Template Generator produced valid header and sample rows');

  // 4. Test CSV Parser with Valid Rows & Array/JSON representations
  const validCsvContent = `name,description,category,brand,price,costPrice,stock,images,features,specifications,tags,status
"AeroPulse ANC Studio","Studio monitor headphones with active noise cancelling","Audio","AeroSound",5499,3100,50,"https://images.unsplash.com/photo-1?w=800|https://images.unsplash.com/photo-2?w=800","Hybrid ANC|45h Battery|Low Latency","{""driver"":""40mm"",""impedance"":""32ohm""}","wireless|audio|anc",DRAFT
"OptiCharge Fast 65W","GaN 3-port wall fast charger with USB-C PD 3.0","Accessories","OptiCharge",2199,850,120,"https://images.unsplash.com/photo-3?w=800","GaN Technology|65W Max Output|Triple Ports","{""ports"":3,""wattage"":65}","charger|gan|fastcharge",PUBLISHED
"HyperScreen OLED 27","240Hz QHD gaming and creator OLED display","Electronics","HyperScreen",45999,32000,10,"https://images.unsplash.com/photo-4?w=800","240Hz Refresh|0.03ms Response|HDR TrueBlack","{""resolution"":""2560x1440"",""panel"":""OLED""}","monitor|oled|gaming",DRAFT`;

  const validParsed = parseAndValidateProductsCsv(validCsvContent, store.id);
  console.log(`✓ [1, 2] Parsed valid CSV: Total ${validParsed.totalRows} rows, Valid: ${validParsed.validRows.length}, Invalid: ${validParsed.invalidRows.length}`);
  if (validParsed.totalRows !== 3 || validParsed.validRows.length !== 3 || validParsed.invalidRows.length !== 0) {
    throw new Error(`Expected 3 valid rows, got valid=${validParsed.validRows.length}, invalid=${validParsed.invalidRows.length}`);
  }

  // Check array and JSON parsing
  const row1 = validParsed.validRows[0].product!;
  if (row1.images.length !== 2 || row1.features.length !== 3 || row1.tags.length !== 3) {
    throw new Error(`Array parsing error: images=${row1.images.length}, features=${row1.features.length}, tags=${row1.tags.length}`);
  }
  if (!row1.specifications || row1.specifications.driver !== '40mm') {
    throw new Error(`JSON specification parsing error: ${JSON.stringify(row1.specifications)}`);
  }
  if (row1.status !== 'DRAFT') {
    throw new Error(`Expected row 1 status to default/be DRAFT, got ${row1.status}`);
  }
  console.log('✓ Array fields (images, features, tags) and JSON specifications parsed accurately');

  // 5. Test Validation on Invalid Rows
  console.log('\n--- Testing Row-Level Validation Errors ---');
  const invalidCsvContent = `name,description,category,brand,price,costPrice,stock,specifications
"",Missing name product,Audio,BrandA,2999,1500,20,"{""valid"":true}"
"Missing Category Product",Some description,,BrandB,1999,1000,15,"{""valid"":true}"
"Invalid Price Product",Zero price,Audio,BrandC,-50,1000,15,"{""valid"":true}"
"Invalid Stock Product",Negative stock,Audio,BrandD,1999,1000,-10,"{""valid"":true}"
"Broken JSON Specs Product",Invalid json specs,Audio,BrandE,1999,1000,10,"{broken json specs"`;

  const invalidParsed = parseAndValidateProductsCsv(invalidCsvContent, store.id);
  console.log(`✓ [5] Parsed invalid CSV: Total ${invalidParsed.totalRows} rows, Valid: ${invalidParsed.validRows.length}, Invalid: ${invalidParsed.invalidRows.length}`);
  if (invalidParsed.invalidRows.length !== 5 || invalidParsed.validRows.length !== 0) {
    throw new Error(`Expected 5 invalid rows, got invalid=${invalidParsed.invalidRows.length}`);
  }

  // Verify specific error messages
  const err6 = invalidParsed.invalidRows[0].errors.join(' ');
  if (!err6.toLowerCase().includes('name is required')) {
    throw new Error(`[6] Expected missing name error, got: ${err6}`);
  }
  console.log('✓ [6] Missing name validation passed');

  const err7 = invalidParsed.invalidRows[1].errors.join(' ');
  if (!err7.toLowerCase().includes('category is required')) {
    throw new Error(`[7] Expected missing category error, got: ${err7}`);
  }
  console.log('✓ [7] Missing category validation passed');

  const err8 = invalidParsed.invalidRows[2].errors.join(' ');
  if (!err8.toLowerCase().includes('price must be a valid number greater than 0')) {
    throw new Error(`[8] Expected invalid price error, got: ${err8}`);
  }
  console.log('✓ [8] Invalid price validation passed');

  const err9 = invalidParsed.invalidRows[3].errors.join(' ');
  if (!err9.toLowerCase().includes('stock inventory must be an integer >= 0')) {
    throw new Error(`[9] Expected invalid stock error, got: ${err9}`);
  }
  console.log('✓ [9] Invalid stock validation passed');

  const err10 = invalidParsed.invalidRows[4].errors.join(' ');
  if (!err10.toLowerCase().includes('specifications contains invalid json syntax')) {
    throw new Error(`[10] Expected invalid json specs error, got: ${err10}`);
  }
  console.log('✓ [10] Invalid specifications JSON validation passed');

  // 6. Test Mixed/Partial Import Handling
  console.log('\n--- Testing Partial / Mixed CSV Import ---');
  const mixedCsvContent = `name,description,category,brand,price,costPrice,stock,tags,status
"Partial Valid Item 1","Valid description",Audio,BrandX,1499,800,25,"valid|item",DRAFT
"",Invalid because empty name,Audio,BrandY,999,500,10,"invalid",DRAFT
"Partial Valid Item 2","Another valid description",Wearables,BrandZ,3999,2200,15,"watch|wearable",PUBLISHED`;

  const mixedParsed = parseAndValidateProductsCsv(mixedCsvContent, store.id);
  if (mixedParsed.validRows.length !== 2 || mixedParsed.invalidRows.length !== 1) {
    throw new Error(`Expected 2 valid and 1 invalid row, got valid=${mixedParsed.validRows.length}, invalid=${mixedParsed.invalidRows.length}`);
  }
  console.log('✓ [12] Partial CSV parsed: 2 valid rows isolated, 1 invalid row flagged for skipping');

  // 7. Perform Live Import via Backend API for the valid rows
  console.log('\n--- Executing Backend Product Import for Valid Rows ---');
  const importedIds: string[] = [];
  for (const validItem of validParsed.validRows) {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validItem.product),
    });
    if (res.status !== 201) {
      const errTxt = await res.text();
      throw new Error(`Failed to create product during import: ${errTxt}`);
    }
    const resJson = await res.json() as any;
    const prod = resJson.data || resJson;
    importedIds.push(prod.id);
    console.log(`  ✓ Imported: "${prod.name}" (ID: ${prod.id}, Status: ${prod.status}, StoreId: ${prod.storeId})`);
    if (prod.storeId !== store.id) {
      throw new Error(`[11] Product storeId mismatch: expected ${store.id}, got ${prod.storeId}`);
    }
  }

  // 8. Verify Products Appear in Live Catalog
  console.log('\n--- Verifying Products in Live Catalog & Persistence ---');
  const catalogRes = await fetch(`${BASE_URL}/api/products?storeId=${store.id}`);
  if (!catalogRes.ok) throw new Error(`Catalog fetch failed: ${catalogRes.status}`);
  const catalogJson = await catalogRes.json() as any;
  const catalogList = Array.isArray(catalogJson) ? catalogJson : catalogJson.data;

  for (const importedId of importedIds) {
    const found = catalogList.find((p: any) => p.id === importedId);
    if (!found) {
      throw new Error(`[3] Product ${importedId} not found in live catalog`);
    }
    console.log(`✓ [3, 4] Product "${found.name}" found in catalog (Price: ₹${found.price}, Stock: ${found.stock})`);
  }

  // 9. Verify Existing Add Product Flow & Single Product APIs Still Work
  console.log('\n--- Regression: Verifying Existing Product & Store APIs ---');
  const singleProductPayload = {
    storeId: store.id,
    name: 'Regression Check Headset',
    category: 'Audio',
    price: 4999,
    costPrice: 2500,
    stock: 20,
    status: 'DRAFT',
  };
  const singleRes = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(singleProductPayload),
  });
  if (singleRes.status !== 201) throw new Error('[13] Single Add Product flow failed');
  const singleProd = ((await singleRes.json()) as any).data;
  console.log(`✓ [13] Single Add Product flow verified (ID: ${singleProd.id})`);

  // Update Status
  const statusRes = await fetch(`${BASE_URL}/api/products/${singleProd.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'PUBLISHED' }),
  });
  if (!statusRes.ok) throw new Error('[14] Update status failed');
  console.log('✓ [14] Product status update verified');

  // Clean up regression product
  const delRes = await fetch(`${BASE_URL}/api/products/${singleProd.id}`, { method: 'DELETE' });
  if (!delRes.ok) throw new Error('[14] Delete product failed');
  console.log('✓ [14] Product delete verified');

  // Verify Store APIs
  const storeRes = await fetch(`${BASE_URL}/api/stores`);
  if (!storeRes.ok) throw new Error('[15] Store API failed');
  console.log('✓ [15] Store management API verified');

  console.log('\n====================================================');
  console.log('--- ALL 18 PHASE 3E VERIFICATIONS COMPLETED SUCCESSFULLY ---');
  console.log('====================================================');
}

verifyPhase3E().catch((err) => {
  console.error('\n❌ Phase 3E verification failed:', err);
  process.exit(1);
});
