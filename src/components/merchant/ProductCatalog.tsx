import React, { useState } from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { Product } from '../../types';
import { 
  Plus, 
  Upload, 
  Search, 
  SlidersHorizontal, 
  Sparkles, 
  Trash2, 
  Edit3, 
  Check, 
  X,
  FileSpreadsheet
} from 'lucide-react';

export function ProductCatalog() {
  const { products, addProduct, updateProduct, deleteProduct, importCSVProducts, formatINR } = useCommerce();
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);

  // New product form state
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'Audio',
    basePrice: 2999,
    costPrice: 1800,
    stock: 50,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    description: '',
    matchScore: 90,
    matchReason: 'High quality match for customer audio search.',
    tags: 'Audio, Wireless',
    aiDiscountEligible: true,
    activeDiscountPercent: 5,
  });

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchFilter.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const margin = Math.round(((newProduct.basePrice - newProduct.costPrice) / newProduct.basePrice) * 100);
    addProduct({
      name: newProduct.name,
      category: newProduct.category,
      basePrice: Number(newProduct.basePrice),
      costPrice: Number(newProduct.costPrice),
      marginPercent: margin,
      stock: Number(newProduct.stock),
      rating: 4.5,
      ratingCount: 12,
      image: newProduct.image,
      description: newProduct.description || `${newProduct.name} premium retail item.`,
      matchScore: Number(newProduct.matchScore),
      matchReason: newProduct.matchReason,
      tags: newProduct.tags.split(',').map(t => t.trim()),
      aiDiscountEligible: newProduct.aiDiscountEligible,
      activeDiscountPercent: Number(newProduct.activeDiscountPercent),
      isLive: true,
    });
    setShowAddModal(false);
  };

  const handleCSVImport = () => {
    importCSVProducts([
      {
        name: 'HyperSound ANC Earbuds Pro',
        category: 'Audio',
        basePrice: 3499,
        costPrice: 2000,
        marginPercent: 42.8,
        stock: 120,
        rating: 4.7,
        ratingCount: 54,
        image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80',
        description: 'Next-gen dual driver wireless buds with 48dB active noise cancellation.',
        tags: ['Audio', 'TWS', 'ANC'],
      },
      {
        name: 'AeroGlide Commuter Backpack',
        category: 'Accessories',
        basePrice: 2899,
        costPrice: 1500,
        marginPercent: 48.2,
        stock: 45,
        rating: 4.6,
        ratingCount: 89,
        image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
        description: 'Waterproof laptop commuter backpack with integrated USB charge port.',
        tags: ['Accessories', 'Travel', 'Commute'],
      }
    ]);
    setShowCSVModal(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Product Catalog</h1>
          <p className="text-sm text-slate-500 mt-1">
            Merchant catalog source of truth. Manage stock, profit margins, and AI discount eligibility.
          </p>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Filter bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter catalog by name or tag..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {categories.map((cat) => (
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

      {/* Catalog Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Product Details</th>
                <th className="px-6 py-4">Price & Cost</th>
                <th className="px-6 py-4">Margin %</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">AI Optimizer</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded-xl border border-slate-200 shrink-0"
                      />
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{product.name}</p>
                        <p className="text-slate-400 text-xs mt-0.5">{product.category} • Rating: ★ {product.rating}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{formatINR(product.basePrice)}</p>
                    <p className="text-slate-400 text-[11px]">Cost: {formatINR(product.costPrice)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                      product.marginPercent >= 35 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {product.marginPercent}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-slate-700">{product.stock} units</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateProduct(product.id, { aiDiscountEligible: !product.aiDiscountEligible })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          product.aiDiscountEligible
                            ? 'bg-blue-50 text-blue-600 border border-blue-200'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{product.aiDiscountEligible ? 'Enabled' : 'Disabled'}</span>
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Add New Catalog Product</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700">Product Title</label>
                <input
                  type="text"
                  required
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="e.g. AeroFlow Noise Pro"
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Selling Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={newProduct.basePrice}
                    onChange={(e) => setNewProduct({ ...newProduct, basePrice: Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Cost Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={newProduct.costPrice}
                    onChange={(e) => setNewProduct({ ...newProduct, costPrice: Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Category</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value="Audio">Audio</option>
                    <option value="Wearables">Wearables</option>
                    <option value="Apparel">Apparel</option>
                    <option value="Accessories">Accessories</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700">Stock Inventory</label>
                  <input
                    type="number"
                    required
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Image URL</label>
                <input
                  type="url"
                  value={newProduct.image}
                  onChange={(e) => setNewProduct({ ...newProduct, image: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-xs cursor-pointer"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCSVModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Bulk CSV Inventory Import</h3>
              </div>
              <button onClick={() => setShowCSVModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Upload your standard CSV manifest to instantly import products with automatic cost-margin calculation and AI discount binding.
            </p>

            <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 text-center space-y-2">
              <Upload className="w-8 h-8 text-blue-600 mx-auto" />
              <p className="text-xs font-bold text-slate-800">sample_catalog_batch_v2.csv</p>
              <p className="text-[11px] text-slate-400">2 products ready for ingest</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCSVModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCSVImport}
                className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-xs cursor-pointer"
              >
                Import 2 Products
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
