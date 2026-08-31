import { CreateProductInput, ProductStatus } from '../types';

export interface CsvRowValidationResult {
  rowIndex: number;
  raw: Record<string, string>;
  product: CreateProductInput | null;
  isValid: boolean;
  errors: string[];
}

export interface CsvParseSummary {
  totalRows: number;
  validRows: CsvRowValidationResult[];
  invalidRows: CsvRowValidationResult[];
  results: CsvRowValidationResult[];
}

/**
 * Robust RFC-4180 compliant CSV line tokenizer
 */
export function parseCsvText(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  const normalizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i];
    const nextChar = normalizedText[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++; // Skip the escaped quote
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  // Final cell & row if file doesn't end with newline
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Normalizes header names to canonical product fields
 */
function normalizeHeaderName(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (h === 'name' || h === 'productname' || h === 'title') return 'name';
  if (h === 'description' || h === 'desc') return 'description';
  if (h === 'category' || h === 'cat') return 'category';
  if (h === 'brand' || h === 'brandname') return 'brand';
  if (h === 'price' || h === 'sellingprice' || h === 'baseprice' || h === 'retailprice') return 'price';
  if (h === 'costprice' || h === 'cost' || h === 'wholesale' || h === 'costrate') return 'costPrice';
  if (h === 'stock' || h === 'inventory' || h === 'quantity' || h === 'qty') return 'stock';
  if (h === 'images' || h === 'image' || h === 'imageurl' || h === 'imageurls') return 'images';
  if (h === 'features' || h === 'feature' || h === 'keyfeatures') return 'features';
  if (h === 'specifications' || h === 'specs' || h === 'specification') return 'specifications';
  if (h === 'tags' || h === 'tag' || h === 'keywords') return 'tags';
  if (h === 'status') return 'status';
  return header;
}

/**
 * Parses and validates CSV string data against Product requirements
 */
export function parseAndValidateProductsCsv(csvText: string, storeId: string): CsvParseSummary {
  const rows = parseCsvText(csvText);

  if (rows.length === 0) {
    return {
      totalRows: 0,
      validRows: [],
      invalidRows: [],
      results: [],
    };
  }

  const rawHeaders = rows[0];
  const normalizedHeaders = rawHeaders.map((h) => normalizeHeaderName(h));
  const dataRows = rows.slice(1);

  const results: CsvRowValidationResult[] = [];

  dataRows.forEach((row, index) => {
    const rowIndex = index + 2; // 1-indexed, accounting for header row
    const raw: Record<string, string> = {};
    normalizedHeaders.forEach((key, colIdx) => {
      raw[key] = row[colIdx] ?? '';
    });

    const errors: string[] = [];

    // 1. Name validation
    const name = (raw['name'] || '').trim();
    if (!name) {
      errors.push('Product name is required');
    }

    // 2. Category validation
    const category = (raw['category'] || '').trim();
    if (!category) {
      errors.push('Category is required');
    }

    // 3. Price validation
    const rawPriceStr = (raw['price'] || '').trim();
    const cleanPrice = rawPriceStr.replace(/[₹$,\s]/g, '');
    const price = Number(cleanPrice);
    if (!cleanPrice || isNaN(price) || price <= 0) {
      errors.push('Price must be a valid number greater than 0');
    }

    // 4. CostPrice validation
    const rawCostStr = (raw['costPrice'] || '').trim();
    let costPrice = 0;
    if (rawCostStr) {
      const cleanCost = rawCostStr.replace(/[₹$,\s]/g, '');
      costPrice = Number(cleanCost);
      if (isNaN(costPrice) || costPrice < 0) {
        errors.push('Cost Price must be a valid number greater than or equal to 0');
      }
    }

    // 5. Stock validation
    const rawStockStr = (raw['stock'] || '').trim();
    let stock = 0;
    if (rawStockStr) {
      const cleanStock = rawStockStr.replace(/[,\s]/g, '');
      stock = Number(cleanStock);
      if (isNaN(stock) || !Number.isInteger(stock) || stock < 0) {
        errors.push('Stock inventory must be an integer >= 0');
      }
    }

    // 6. Images parsing
    let images: string[] = [];
    if (raw['images']) {
      images = raw['images']
        .split(/[|,]/)
        .map((img) => img.trim())
        .filter((img) => img.length > 0);
    }

    // 7. Features parsing
    let features: string[] = [];
    if (raw['features']) {
      features = raw['features']
        .split(/[|;\n]/)
        .map((f) => f.trim())
        .filter((f) => f.length > 0);
    }

    // 8. Tags parsing
    let tags: string[] = [];
    if (raw['tags']) {
      tags = raw['tags']
        .split(/[|,]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    }

    // 9. Specifications JSON parsing
    let specifications: Record<string, any> | null = null;
    if (raw['specifications'] && raw['specifications'].trim().length > 0) {
      const trimmedSpecs = raw['specifications'].trim();
      try {
        const parsed = JSON.parse(trimmedSpecs);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          specifications = parsed;
        } else {
          errors.push('Specifications must be a valid JSON key-value object (e.g. {"driver":"40mm"})');
        }
      } catch {
        errors.push('Specifications contains invalid JSON syntax');
      }
    }

    // 10. Status validation
    let status: ProductStatus = 'DRAFT';
    if (raw['status']) {
      const st = raw['status'].trim().toUpperCase();
      if (['PUBLISHED', 'DRAFT', 'LOW_STOCK', 'OUT_OF_STOCK', 'ARCHIVED'].includes(st)) {
        status = st as ProductStatus;
      }
    }

    const isValid = errors.length === 0;
    const product: CreateProductInput | null = isValid
      ? {
          storeId,
          name,
          description: raw['description']?.trim() || null,
          category,
          brand: raw['brand']?.trim() || null,
          price,
          costPrice,
          stock,
          images,
          features,
          specifications,
          tags,
          status,
        }
      : null;

    results.push({
      rowIndex,
      raw,
      product,
      isValid,
      errors,
    });
  });

  const validRows = results.filter((r) => r.isValid);
  const invalidRows = results.filter((r) => !r.isValid);

  return {
    totalRows: results.length,
    validRows,
    invalidRows,
    results,
  };
}

/**
 * Standard CSV Template Sample Generator
 */
export function generateSampleCsv(): string {
  const header = 'name,description,category,brand,price,costPrice,stock,images,features,specifications,tags,status';
  const row1 = '"ZenPods Elite 2","Active noise cancelling wireless earbuds with 36h playback","Audio","ZenAudio",3499,1900,40,"https://images.unsplash.com/photo-1590658268037-6bf12165a8df","36h Playback|Hybrid ANC|Dual Mics","{""bluetooth"":""5.3"",""waterproof"":""IPX5""}","wireless|anc|earbuds",DRAFT';
  const row2 = '"ProShield MagCase 15","Shockproof magnetic protective case with military-grade corner bumpers","Accessories","ProShield",1299,450,100,"https://images.unsplash.com/photo-1586953208448-b95a79798f07","MagSafe Compatible|Military Drop Tested|Anti-Yellowing","{""material"":""Polycarbonate"",""warranty"":""1 Year""}","case|magsafe|protection",DRAFT';
  const row3 = '"UltraVision 4K Monitor","27-inch 4K UHD IPS professional creator display with HDR400","Electronics","UltraVision",28999,19500,15,"https://images.unsplash.com/photo-1527443224154-c4a3942d3acf","4K UHD IPS|99% sRGB|USB-C 65W PD","{""resolution"":""3840x2160"",""panel"":""IPS""}","monitor|4k|creator",PUBLISHED';
  return [header, row1, row2, row3].join('\n');
}
