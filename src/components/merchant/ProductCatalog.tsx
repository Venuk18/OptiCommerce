import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useCommerce } from '../../context/CommerceContext';
import { DbProduct, ProductStatus } from '../../types';
import { productService } from '../../services/product.service';
import { parseAndValidateProductsCsv, generateSampleCsv, CsvParseSummary } from '../../utils/csvParser';
import { 
  Plus, 
  Upload, 
  Search, 
  Sparkles, 
  Trash2, 
  Check, 
  X, 
  FileSpreadsheet, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Package, 
  Filter,
  Download,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const STATUS_CONFIG: Record<ProductStatus, { label: string; badgeClass: string; dotClass: string }> = {
  PUBLISHED: {
    label: 'Published',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  DRAFT: {
    label: 'Draft',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-400',
  },
  LOW_STOCK: {
    label: 'Low Stock',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  OUT_OF_STOCK: {
    label: 'Out of Stock',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500',
  },
  ARCHIVED: {
    label: 'Archived',
    badgeClass: 'bg-slate-50 text-slate-500 border-slate-200',
    dotClass: 'bg-slate-300',
  },
};

const ALL_STATUSES: ProductStatus[] = [
  'PUBLISHED',
  'DRAFT',
  'LOW_STOCK',
  'OUT_OF_STOCK',
  'ARCHIVED',
];

const INITIAL_PRODUCT_FORM = {
  name: '',
  description: '',
  category: 'Audio',
  brand: '',
  basePrice: 2999 as number | string,
  costPrice: 1800 as number | string,
  stock: 50 as number | string,
  image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
  tags: '',
  status: 'DRAFT' as ProductStatus,
};

export function ProductCatalog() {
  const { store, formatINR } = useCommerce();
  
  // Real API state
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Add Product Form & Submission state
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState(INITIAL_PRODUCT_FORM);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState<boolean>(false);
  const [aiDescriptionError, setAiDescriptionError] = useState<string | null>(null);

  // CSV Import state
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvSummary, setCsvSummary] = useState<CsvParseSummary | null>(null);
  const [isParsingCsv, setIsParsingCsv] = useState<boolean>(false);
  const [isImportingCsv, setIsImportingCsv] = useState<boolean>(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    failed: number;
    errors: { row: number; name: string; error: string }[];
  } | null>(null);
  const [isDraggingCsv, setIsDraggingCsv] = useState<boolean>(false);
  const [showInvalidDetails, setShowInvalidDetails] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modals (Visual source of truth preserved)
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);

  // Fetch products from live API
  const fetchProducts = useCallback(async () => {
    if (!store?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await productService.getProducts({
        storeId: store.id,
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
      });
      setProducts(data);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load products from database');
    } finally {
      setIsLoading(false);
    }
  }, [store?.id, selectedCategory, selectedStatus]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Add Product Submit Handler
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!store?.id) {
      setCreateError('No active merchant store found. Please create or select a store first.');
      return;
    }

    const trimmedName = newProduct.name.trim();
    if (!trimmedName) {
      setCreateError('Product Title is required.');
      return;
    }

    const trimmedCategory = newProduct.category.trim();
    if (!trimmedCategory) {
      setCreateError('Category is required.');
      return;
    }

    const priceNum = Number(newProduct.basePrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setCreateError('Selling Price must be a valid number greater than 0.');
      return;
    }

    const costNum = Number(newProduct.costPrice);
    if (isNaN(costNum) || costNum < 0) {
      setCreateError('Cost Price must be a valid number greater than or equal to 0.');
      return;
    }

    const stockNum = Number(newProduct.stock);
    if (isNaN(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) {
      setCreateError('Stock Inventory must be an integer greater than or equal to 0.');
      return;
    }

    const images = newProduct.image && newProduct.image.trim() ? [newProduct.image.trim()] : [];
    const tags = newProduct.tags
      ? newProduct.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    setIsCreating(true);
    try {
      const created = await productService.createProduct({
        storeId: store.id,
        name: trimmedName,
        description: newProduct.description?.trim() || null,
        category: trimmedCategory,
        brand: newProduct.brand?.trim() || null,
        price: priceNum,
        costPrice: costNum,
        stock: stockNum,
        images,
        features: [],
        specifications: null,
        tags,
        status: newProduct.status || 'DRAFT',
      });

      // Reset form and close modal
      setNewProduct(INITIAL_PRODUCT_FORM);
      setShowAddModal(false);
      setCreateError(null);
      setAiDescriptionError(null);
      setIsGeneratingDescription(false);

      // Feedback and refresh
      setSuccessMessage(`Product "${created.name}" created successfully (Status: ${STATUS_CONFIG[created.status]?.label || created.status})`);
      setTimeout(() => setSuccessMessage(null), 4000);

      await fetchProducts();
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create product. Please verify your inputs and try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // AI Description Generation Handler (Phase 6#6)
  const handleGenerateAiDescription = async () => {
    const trimmedName = newProduct.name.trim();
    if (!trimmedName || isGeneratingDescription || isCreating) return;

    setIsGeneratingDescription(true);
    setAiDescriptionError(null);

    try {
      const tagsArray = newProduct.tags
        ? newProduct.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      const description = await productService.generateProductDescription({
        name: trimmedName,
        category: newProduct.category || 'General',
        brand: newProduct.brand?.trim() || undefined,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
      });

      if (description) {
        setNewProduct((prev) => ({ ...prev, description }));
      }
    } catch (err: any) {
      setAiDescriptionError(err?.message || 'Failed to generate AI description');
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  // Status Change Handler
  const handleStatusChange = async (productId: string, newStatus: ProductStatus) => {
    setStatusUpdatingId(productId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await productService.updateProductStatus(productId, newStatus);
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
      setSuccessMessage(`Product status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update product status');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Delete Handler
  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${productName}" from the catalog?`)) {
      return;
    }
    setDeletingId(productId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await productService.deleteProduct(productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setSuccessMessage(`Product "${productName}" was deleted successfully`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete product from database');
    } finally {
      setDeletingId(null);
    }
  };

  // CSV File Processing Handler
  const handleProcessCsvFile = (file: File) => {
    if (!store?.id) {
      setCsvError('No active merchant store found. Please create or select a store first.');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
      setCsvError('Please upload a valid .csv file.');
      return;
    }

    setIsParsingCsv(true);
    setCsvError(null);
    setImportResult(null);
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text || !text.trim()) {
          setCsvError('The selected CSV file is empty.');
          setCsvSummary(null);
          setIsParsingCsv(false);
          return;
        }

        const summary = parseAndValidateProductsCsv(text, store.id);
        setCsvSummary(summary);
      } catch (err: any) {
        setCsvError(err?.message || 'Failed to parse CSV file.');
        setCsvSummary(null);
      } finally {
        setIsParsingCsv(false);
      }
    };
    reader.onerror = () => {
      setCsvError('Error reading file from disk.');
      setIsParsingCsv(false);
    };
    reader.readAsText(file);
  };

  // CSV Drag and Drop Handlers
  const handleCsvDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCsv(true);
  };

  const handleCsvDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCsv(false);
  };

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCsv(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessCsvFile(e.dataTransfer.files[0]);
    }
  };

  // Download Sample Template Handler
  const handleDownloadSampleCsv = () => {
    const csvContent = generateSampleCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'opticommerce_catalog_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Execute Bulk CSV Import
  const handleConfirmCsvImport = async () => {
    if (!store?.id) {
      setCsvError('Active store ID is missing.');
      return;
    }

    if (!csvSummary || csvSummary.validRows.length === 0) {
      setCsvError('No valid products to import.');
      return;
    }

    setIsImportingCsv(true);
    setCsvError(null);

    const validRows = csvSummary.validRows;
    const totalToImport = validRows.length;
    let successCount = 0;
    const failedItems: { row: number; name: string; error: string }[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const item = validRows[i];
      setImportProgress({ current: i + 1, total: totalToImport });

      try {
        if (!item.product) throw new Error('Invalid product payload');
        await productService.createProduct({
          ...item.product,
          storeId: store.id, // Explicit active storeId
        });
        successCount++;
      } catch (err: any) {
        failedItems.push({
          row: item.rowIndex,
          name: item.raw['name'] || `Row ${item.rowIndex}`,
          error: err?.message || 'Failed to create product in database',
        });
      }
    }

    const totalRejected = csvSummary.invalidRows.length + failedItems.length;
    setImportResult({
      imported: successCount,
      failed: totalRejected,
      errors: [
        ...csvSummary.invalidRows.map((r) => ({
          row: r.rowIndex,
          name: r.raw['name'] || `Row ${r.rowIndex}`,
          error: r.errors.join(', '),
        })),
        ...failedItems,
      ],
    });

    setIsImportingCsv(false);
    setImportProgress(null);

    if (successCount > 0) {
      setSuccessMessage(`Bulk CSV Import: Successfully added ${successCount} product${successCount > 1 ? 's' : ''} to catalog.`);
      setTimeout(() => setSuccessMessage(null), 5000);
      await fetchProducts();
    }
  };

  // Reset CSV modal state
  const handleResetCsvState = () => {
    setCsvFileName(null);
    setCsvSummary(null);
    setIsParsingCsv(false);
    setIsImportingCsv(false);
    setCsvError(null);
    setImportProgress(null);
    setImportResult(null);
    setShowInvalidDetails(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Compute Categories from products + standard
  const uniqueCategories = Array.from(
    new Set(['All', 'Audio', 'Electronics', 'Accessories', ...products.map((p) => p.category)])
  );

  // In-memory text search filter over the fetched products
  const filteredProducts = products.filter((p) => {
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    const nameMatch = p.name?.toLowerCase().includes(query);
    const categoryMatch = p.category?.toLowerCase().includes(query);
    const brandMatch = p.brand?.toLowerCase().includes(query);
    const tagMatch = p.tags?.some((t) => t.toLowerCase().includes(query));
    return nameMatch || categoryMatch || brandMatch || tagMatch;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Product Catalog</h1>
            {store && (
              <span className="text-xs font-semibold px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                {store.name}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Merchant catalog source of truth. Manage stock, profit margins, and AI discount eligibility.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchProducts}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh catalog from live database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>{isLoading ? 'Loading...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => setShowCSVModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>CSV Import</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* API Feedback Alerts */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex items-start justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-900">API Notice</p>
              <p className="mt-0.5 text-red-700 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchProducts}
              className="text-xs font-bold text-red-700 hover:text-red-900 underline cursor-pointer"
            >
              Retry
            </button>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-800 font-bold px-2 py-0.5 rounded cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-start justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-900">Operation Successful</p>
              <p className="mt-0.5 text-emerald-700 leading-relaxed">{successMessage}</p>
            </div>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-800 font-bold px-2 py-0.5 rounded cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        {/* Search input */}
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter catalog by name, brand, or tag..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Categories and Status filters */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Status Filter Dropdown / Pills */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-semibold text-slate-500">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">All Statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
            {uniqueCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-b border-slate-200 tracking-wider">
              <tr>
                <th className="px-6 py-4">Product Details</th>
                <th className="px-6 py-4">Price & Cost</th>
                <th className="px-6 py-4">Margin %</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Status Control</th>
                <th className="px-6 py-4">AI Optimizer</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {/* Loading State */}
              {isLoading && products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                      <p className="font-semibold text-xs text-slate-600">Loading catalog from database...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                /* Empty State */
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                        <Package className="w-5 h-5" />
                      </div>
                      <p className="font-bold text-slate-800 text-sm mt-1">No products found</p>
                      <p className="text-[11px] text-slate-400">
                        {searchFilter || selectedCategory !== 'All' || selectedStatus !== 'ALL'
                          ? 'No products match the selected filters or search query.'
                          : 'Your store catalog is currently empty. Seed or add products to view them here.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                /* Real Database Products */
                filteredProducts.map((product) => {
                  const price = Number(product.price);
                  const cost = Number(product.costPrice);
                  const margin = price > 0 ? Math.round(((price - cost) / price) * 100) : 0;
                  const imageUrl =
                    product.images && product.images.length > 0 && product.images[0]
                      ? product.images[0]
                      : 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80';
                  const isUpdatingStatus = statusUpdatingId === product.id;
                  const isDeleting = deletingId === product.id;
                  const statusInfo = STATUS_CONFIG[product.status] || STATUS_CONFIG.DRAFT;

                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isDeleting ? 'opacity-40 pointer-events-none' : ''
                      }`}
                    >
                      {/* Product Details */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={imageUrl}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded-xl border border-slate-200 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80';
                            }}
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate">{product.name}</p>
                            <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-0.5">
                              <span className="font-medium text-slate-500">{product.category}</span>
                              {product.brand && (
                                <>
                                  <span>•</span>
                                  <span>{product.brand}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Price & Cost */}
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">{formatINR(price)}</p>
                        <p className="text-slate-400 text-[11px]">Cost: {formatINR(cost)}</p>
                      </td>

                      {/* Margin % */}
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                            margin >= 35 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {margin}%
                        </span>
                      </td>

                      {/* Stock */}
                      <td className="px-6 py-4">
                        <span
                          className={`font-semibold ${
                            product.stock === 0
                              ? 'text-rose-600 font-bold'
                              : product.stock <= 10
                              ? 'text-amber-600'
                              : 'text-slate-700'
                          }`}
                        >
                          {product.stock} units
                        </span>
                      </td>

                      {/* Live Status Control */}
                      <td className="px-6 py-4">
                        <div className="relative inline-flex items-center gap-1.5">
                          {isUpdatingStatus ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-xs text-slate-500 font-semibold">
                              <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                              <span>Updating...</span>
                            </div>
                          ) : (
                            <div className="relative">
                              <select
                                value={product.status}
                                onChange={(e) => handleStatusChange(product.id, e.target.value as ProductStatus)}
                                className={`appearance-none pl-6 pr-6 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${statusInfo.badgeClass}`}
                              >
                                {ALL_STATUSES.map((st) => (
                                  <option key={st} value={st} className="bg-white text-slate-900 font-normal">
                                    {STATUS_CONFIG[st]?.label || st}
                                  </option>
                                ))}
                              </select>
                              <span
                                className={`w-2 h-2 rounded-full absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none ${statusInfo.dotClass}`}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* AI Optimizer */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-blue-50 text-blue-600 border border-blue-200">
                            <Sparkles className="w-3 h-3" />
                            <span>Enabled</span>
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteProduct(product.id, product.name)}
                          disabled={isDeleting}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                          title="Delete Product"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal (Preserved design) */}
      {showAddModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Add New Catalog Product</h3>
                {store && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Adding to store: <span className="font-semibold text-slate-600">{store.name}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isCreating) {
                    setShowAddModal(false);
                    setCreateError(null);
                  }
                }}
                disabled={isCreating}
                className="text-slate-400 hover:text-slate-700 cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error inside modal */}
            {createError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-red-900">Creation Error</p>
                  <p className="mt-0.5 text-red-700 leading-relaxed">{createError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateError(null)}
                  className="text-red-400 hover:text-red-700 font-bold px-1"
                >
                  ×
                </button>
              </div>
            )}

            <form
              onSubmit={handleCreateProduct}
              className="space-y-4 pt-4 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700">Product Title *</label>
                <input
                  type="text"
                  required
                  disabled={isCreating}
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="e.g. AeroFlow Noise Pro"
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Category *</label>
                  <select
                    value={newProduct.category}
                    disabled={isCreating}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none disabled:opacity-60"
                  >
                    <option value="Audio">Audio</option>
                    <option value="Wearables">Wearables</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Accessories">Accessories</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700">Brand Name</label>
                  <input
                    type="text"
                    disabled={isCreating}
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                    placeholder="e.g. ZenAudio"
                    className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Selling Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    disabled={isCreating}
                    value={newProduct.basePrice}
                    onChange={(e) => setNewProduct({ ...newProduct, basePrice: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Cost Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    disabled={isCreating}
                    value={newProduct.costPrice}
                    onChange={(e) => setNewProduct({ ...newProduct, costPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Stock Inventory *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1"
                    disabled={isCreating}
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Status</label>
                  <select
                    value={newProduct.status}
                    disabled={isCreating}
                    onChange={(e) => setNewProduct({ ...newProduct, status: e.target.value as ProductStatus })}
                    className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none disabled:opacity-60"
                  >
                    <option value="DRAFT">Draft (Default)</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="LOW_STOCK">Low Stock</option>
                    <option value="OUT_OF_STOCK">Out of Stock</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">Description</label>
                  <button
                    type="button"
                    disabled={!newProduct.name.trim() || isCreating || isGeneratingDescription}
                    onClick={handleGenerateAiDescription}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors border border-purple-200"
                    title={!newProduct.name.trim() ? 'Enter a product name first to generate description' : 'Generate description with AI'}
                  >
                    {isGeneratingDescription ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        <span>✨ Generate with AI</span>
                      </>
                    )}
                  </button>
                </div>
                {aiDescriptionError && (
                  <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{aiDescriptionError}</span>
                  </p>
                )}
                <textarea
                  rows={2}
                  disabled={isCreating}
                  value={newProduct.description}
                  onChange={(e) => {
                    setNewProduct({ ...newProduct, description: e.target.value });
                    if (aiDescriptionError) setAiDescriptionError(null);
                  }}
                  placeholder="Detailed product overview and key selling points..."
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 resize-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Image URL</label>
                <input
                  type="url"
                  disabled={isCreating}
                  value={newProduct.image}
                  onChange={(e) => setNewProduct({ ...newProduct, image: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Tags (comma-separated)</label>
                <input
                  type="text"
                  disabled={isCreating}
                  value={newProduct.tags}
                  onChange={(e) => setNewProduct({ ...newProduct, tags: e.target.value })}
                  placeholder="e.g. wireless, anc, audio, premium"
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none disabled:opacity-60"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={() => {
                    setShowAddModal(false);
                    setCreateError(null);
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isCreating ? 'Creating Product...' : 'Save Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* CSV Import Modal (Preserved design & functional workflow) */}
      {showCSVModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Bulk CSV Inventory Import</h3>
                  {store && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Target Store: <span className="font-semibold text-slate-600">{store.name}</span>
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                disabled={isImportingCsv}
                onClick={() => {
                  setShowCSVModal(false);
                  handleResetCsvState();
                }}
                className="text-slate-400 hover:text-slate-700 cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500 leading-relaxed">
                Upload your standard CSV manifest to instantly import products with automatic cost-margin calculation and AI discount binding.
              </p>
              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg shrink-0 transition-colors cursor-pointer"
                title="Download sample CSV template with standard fields"
              >
                <Download className="w-3 h-3 text-slate-600" />
                <span>Template</span>
              </button>
            </div>

            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessCsvFile(e.target.files[0]);
                }
              }}
            />

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={handleCsvDragOver}
              onDragLeave={handleCsvDragLeave}
              onDrop={handleCsvDrop}
              onClick={() => {
                if (!isImportingCsv && !isParsingCsv) {
                  fileInputRef.current?.click();
                }
              }}
              className={`p-6 border-2 border-dashed rounded-2xl text-center space-y-2 transition-all cursor-pointer ${
                isDraggingCsv
                  ? 'border-blue-500 bg-blue-50/70 scale-[0.99]'
                  : csvSummary
                  ? 'border-emerald-300 bg-emerald-50/30'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
              }`}
            >
              {isParsingCsv ? (
                <div className="py-2 flex flex-col items-center gap-2">
                  <Loader2 className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Parsing and validating CSV data...</p>
                </div>
              ) : csvFileName && csvSummary ? (
                <div className="space-y-1">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-800">{csvFileName}</p>
                  <p className="text-[11px] text-slate-500">
                    {csvSummary.validRows.length} product{csvSummary.validRows.length === 1 ? '' : 's'} ready for ingest
                    {csvSummary.invalidRows.length > 0 && ` (${csvSummary.invalidRows.length} invalid)`}
                  </p>
                  <p className="text-[10px] text-blue-600 font-medium underline pt-1">
                    Click to choose a different CSV file
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Upload className="w-8 h-8 text-blue-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-800">
                    {csvFileName || 'sample_catalog_batch_v2.csv'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Drag & drop your .csv file here, or click to browse
                  </p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {csvError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-red-900">Validation Notice</p>
                  <p className="mt-0.5 text-red-700">{csvError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCsvError(null)}
                  className="text-red-400 hover:text-red-700 font-bold px-1"
                >
                  ×
                </button>
              </div>
            )}

            {/* Import Summary Results banner */}
            {importResult && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1.5 animate-fadeIn">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Import Completed</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  Successfully imported <strong>{importResult.imported}</strong> products.
                  {importResult.failed > 0 && ` (${importResult.failed} rows skipped/failed)`}
                </p>
              </div>
            )}

            {/* Parsed Breakdown & Row Preview */}
            {csvSummary && !importResult && (
              <div className="space-y-3 pt-1">
                {/* Status Badges */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-semibold">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    {csvSummary.validRows.length} Valid Ready
                  </span>
                  {csvSummary.invalidRows.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      {csvSummary.invalidRows.length} Invalid / Errors
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 ml-auto">
                    Total: {csvSummary.totalRows} row{csvSummary.totalRows === 1 ? '' : 's'}
                  </span>
                </div>

                {/* Invalid Row Error Inspection */}
                {csvSummary.invalidRows.length > 0 && (
                  <div className="border border-amber-200 bg-amber-50/50 rounded-xl overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setShowInvalidDetails(!showInvalidDetails)}
                      className="w-full px-3 py-2 flex items-center justify-between text-amber-900 font-semibold hover:bg-amber-100/50 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Validation errors ({csvSummary.invalidRows.length} rows will be skipped)</span>
                      </span>
                      {showInvalidDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {showInvalidDetails && (
                      <div className="max-h-40 overflow-y-auto p-3 space-y-2 border-t border-amber-200 bg-white">
                        {csvSummary.invalidRows.map((inv) => (
                          <div key={inv.rowIndex} className="text-[11px] bg-amber-50/70 p-2 rounded-lg border border-amber-100">
                            <div className="font-semibold text-amber-900">
                              Row {inv.rowIndex}: {inv.raw['name'] || '(No title specified)'}
                            </div>
                            <ul className="mt-1 list-disc list-inside text-rose-700 space-y-0.5">
                              {inv.errors.map((err, errIdx) => (
                                <li key={errIdx}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Valid Product Preview List */}
                {csvSummary.validRows.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Preview Products to Import ({csvSummary.validRows.length})
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/40">
                      {csvSummary.validRows.map((item) => (
                        <div key={item.rowIndex} className="p-2.5 flex items-center justify-between text-xs hover:bg-white transition-colors">
                          <div className="min-w-0 flex-1 pr-3">
                            <p className="font-semibold text-slate-800 truncate">{item.product?.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {item.product?.category} • Stock: {item.product?.stock} • Status: {item.product?.status || 'DRAFT'}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-slate-900">{formatINR(item.product?.price || 0)}</p>
                            <p className="text-[10px] text-slate-400">Cost: {formatINR(item.product?.costPrice || 0)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Active Import Progress */}
            {isImportingCsv && importProgress && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between text-xs text-blue-900 font-semibold">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>Importing into catalog...</span>
                  </span>
                  <span>
                    {importProgress.current} of {importProgress.total}
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-200"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100">
              {importResult ? (
                <>
                  <button
                    type="button"
                    onClick={handleResetCsvState}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                  >
                    Import Another File
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCSVModal(false);
                      handleResetCsvState();
                    }}
                    className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-xs cursor-pointer"
                  >
                    Done
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isImportingCsv}
                    onClick={() => {
                      setShowCSVModal(false);
                      handleResetCsvState();
                    }}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isImportingCsv || isParsingCsv || !csvSummary || csvSummary.validRows.length === 0}
                    onClick={handleConfirmCsvImport}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isImportingCsv && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>
                      {isImportingCsv
                        ? 'Importing Products...'
                        : csvSummary && csvSummary.validRows.length > 0
                        ? `Import ${csvSummary.validRows.length} Product${csvSummary.validRows.length === 1 ? '' : 's'}`
                        : 'Import Products'}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
