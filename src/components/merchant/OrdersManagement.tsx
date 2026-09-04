import React, { useState, useEffect, useCallback } from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { merchantDashboardService } from '../../services/merchant-dashboard.service';
import { MerchantOrderData, MerchantOrderItemData } from '../../types';
import {
  ShoppingBag,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  CreditCard,
  Package,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';

type StatusFilter = 'ALL' | 'READY_TO_PROCESS' | 'PENDING_PAYMENT' | 'CANCELLED';

export function OrdersManagement() {
  const { store } = useCommerce();

  const [orders, setOrders] = useState<MerchantOrderData[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<MerchantOrderData | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<MerchantOrderData | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    totalOrders: 0,
    totalPages: 1,
  });

  const [counts, setCounts] = useState({
    all: 0,
    readyToProcess: 0,
    pendingPayment: 0,
    cancelled: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load orders from backend
  const fetchOrders = useCallback(async () => {
    if (!store?.id) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await merchantDashboardService.getOrders(store.id, {
        status: statusFilter,
        search: debouncedSearch,
        page: currentPage,
        limit: pageSize,
      });

      setOrders(response.orders || []);
      setPagination(
        response.pagination || {
          page: 1,
          limit: pageSize,
          totalOrders: response.orders?.length || 0,
          totalPages: 1,
        }
      );
      if (response.counts) {
        setCounts(response.counts);
      }
    } catch (err: any) {
      console.error('Failed to fetch merchant orders:', err);
      setError(err.message || 'Failed to load merchant orders');
    } finally {
      setIsLoading(false);
    }
  }, [store?.id, statusFilter, debouncedSearch, currentPage, pageSize]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Handle order cancellation
  const handleConfirmCancel = async () => {
    if (!store?.id || !orderToCancel) return;
    setIsCancelling(true);
    setError(null);
    setActionSuccess(null);

    try {
      const updatedOrder = await merchantDashboardService.cancelOrder(store.id, orderToCancel.id);
      setActionSuccess(`Order #${orderToCancel.id.slice(-8).toUpperCase()} was cancelled and reserved inventory restored.`);
      
      // Update selected order if open
      if (selectedOrder?.id === orderToCancel.id) {
        setSelectedOrder(updatedOrder);
      }

      setIsCancelModalOpen(false);
      setOrderToCancel(null);

      // Refresh list
      await fetchOrders();
    } catch (err: any) {
      console.error('Failed to cancel order:', err);
      setError(err.message || 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  const getAttributionBadge = (source?: string) => {
    switch (source) {
      case 'AI_CHAT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Sparkles className="w-3 h-3 text-purple-600" />
            AI Chat
          </span>
        );
      case 'BUNDLE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Layers className="w-3 h-3 text-indigo-600" />
            Bundle
          </span>
        );
      case 'OFFER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Zap className="w-3 h-3 text-amber-600" />
            Offer
          </span>
        );
      case 'RECOVERY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Recovery
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
            Direct
          </span>
        );
    }
  };

  const renderStatusBadges = (order: MerchantOrderData) => {
    const isReadyToProcess = order.status === 'CONFIRMED' && order.paymentStatus === 'PAID';
    const isPendingPayment = order.status === 'PENDING' && order.paymentStatus === 'CREATED';
    const isCancelled = order.status === 'CANCELLED';

    if (isReadyToProcess) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          PAID • READY TO PROCESS
        </span>
      );
    }

    if (isPendingPayment) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          PAYMENT PENDING
        </span>
      );
    }

    if (isCancelled) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          <XCircle className="w-3.5 h-3.5 text-slate-400" />
          CANCELLED
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
        {order.status} / {order.paymentStatus}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" id="merchant-orders-management">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-blue-600" />
            Orders
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track verified storefront purchases, monitor payment states, and fulfill customer shipments.
          </p>
        </div>

        <button
          onClick={() => fetchOrders()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-700 hover:text-rose-900 font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => {
            setStatusFilter('ALL');
            setCurrentPage(1);
          }}
          className={`bg-white p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'border-blue-500 shadow-sm ring-1 ring-blue-500'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-medium">Total Orders</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{counts.all}</div>
          <div className="text-[11px] text-slate-400 mt-1">All orders in store history</div>
        </div>

        <div
          onClick={() => {
            setStatusFilter('READY_TO_PROCESS');
            setCurrentPage(1);
          }}
          className={`bg-white p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'READY_TO_PROCESS'
              ? 'border-emerald-500 shadow-sm ring-1 ring-emerald-500'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-700 mb-1">
            <span className="font-semibold">Ready to Process</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-900">{counts.readyToProcess}</div>
          <div className="text-[11px] text-emerald-600/80 mt-1">Confirmed & Paid</div>
        </div>

        <div
          onClick={() => {
            setStatusFilter('PENDING_PAYMENT');
            setCurrentPage(1);
          }}
          className={`bg-white p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'PENDING_PAYMENT'
              ? 'border-amber-500 shadow-sm ring-1 ring-amber-500'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-700 mb-1">
            <span className="font-semibold">Pending Payment</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-900">{counts.pendingPayment}</div>
          <div className="text-[11px] text-amber-600/80 mt-1">Awaiting Razorpay confirmation</div>
        </div>

        <div
          onClick={() => {
            setStatusFilter('CANCELLED');
            setCurrentPage(1);
          }}
          className={`bg-white p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'CANCELLED'
              ? 'border-slate-500 shadow-sm ring-1 ring-slate-500'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
            <span className="font-medium">Cancelled</span>
            <XCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-700">{counts.cancelled}</div>
          <div className="text-[11px] text-slate-400 mt-1">Inventory restored</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(
            [
              { id: 'ALL', label: 'All', count: counts.all },
              { id: 'READY_TO_PROCESS', label: 'Ready to Process', count: counts.readyToProcess },
              { id: 'PENDING_PAYMENT', label: 'Pending Payment', count: counts.pendingPayment },
              { id: 'CANCELLED', label: 'Cancelled', count: counts.cancelled },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  statusFilter === tab.id ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Order ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-7 h-7 animate-spin text-blue-600" />
            <p className="text-xs font-medium">Loading store orders...</p>
          </div>
        ) : counts.all === 0 ? (
          /* Step 8 Zero Data State: Newly registered merchant with no orders */
          <div className="py-24 px-6 text-center max-w-md mx-auto">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-4 border border-blue-100 shadow-xs">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No customer orders yet</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Verified purchases from your storefront will appear here. Share your storefront link or test a customer checkout session to see orders flow in.
            </p>
          </div>
        ) : orders.length === 0 ? (
          /* Empty state for search/filters */
          <div className="py-20 px-6 text-center max-w-sm mx-auto">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No matching orders</h3>
            <p className="text-xs text-slate-500 mt-1">
              No orders matched your active filter or search criteria.
            </p>
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setSearchQuery('');
              }}
              className="mt-4 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status & Payment</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Attribution</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => {
                  const itemCount = order.items?.reduce((sum, it) => sum + it.quantity, 0) || 0;
                  const firstItemName = order.items?.[0]?.productName || 'Item';
                  const extraItems = (order.items?.length || 0) - 1;
                  const isReady = order.status === 'CONFIRMED' && order.paymentStatus === 'PAID';
                  const primaryAttribution = order.items?.[0]?.attributionSource || 'DIRECT';

                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isReady ? 'bg-emerald-50/20' : ''
                      }`}
                    >
                      {/* Order ID */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsDetailOpen(true);
                          }}
                          className="hover:text-blue-600 hover:underline text-left cursor-pointer"
                        >
                          #{order.id.slice(-8).toUpperCase()}
                        </button>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        <div>
                          {new Date(order.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(order.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Status Badges */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadges(order)}
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-4 text-slate-700 max-w-xs">
                        <div className="font-medium truncate text-slate-900">
                          {firstItemName}
                          {extraItems > 0 && (
                            <span className="text-slate-500 font-normal ml-1">
                              +{extraItems} more
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {itemCount} {itemCount === 1 ? 'unit' : 'units'}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-900">
                        ₹{order.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        {order.discount > 0 && (
                          <div className="text-[10px] text-emerald-600 font-medium">
                            -₹{order.discount.toFixed(2)} saved
                          </div>
                        )}
                      </td>

                      {/* Attribution */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getAttributionBadge(primaryAttribution)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsDetailOpen(true);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Details
                          </button>

                          {order.status !== 'CANCELLED' && (
                            <button
                              onClick={() => {
                                setOrderToCancel(order);
                                setIsCancelModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-md font-medium text-xs transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing {Math.min((currentPage - 1) * pageSize + 1, pagination.totalOrders)} to{' '}
              {Math.min(currentPage * pageSize, pagination.totalOrders)} of{' '}
              {pagination.totalOrders} orders
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-semibold text-slate-800">
                {currentPage} / {pagination.totalPages}
              </span>
              <button
                disabled={currentPage >= pagination.totalPages}
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Detail Modal / Slide-over */}
      {isDetailOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 font-mono">
                    Order #{selectedOrder.id.slice(-8).toUpperCase()}
                  </h3>
                  {renderStatusBadges(selectedOrder)}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Placed on {new Date(selectedOrder.createdAt).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-600">
              {/* Customer Fulfillment Information */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Customer & Shipping Details
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Customer Name</span>
                    <span className="font-semibold text-slate-900">
                      {selectedOrder.customerName || 'Storefront Guest Customer'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Customer Email</span>
                    <span className="font-mono text-slate-800">
                      {selectedOrder.customerEmail || 'Provided during payment verification'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Customer Phone</span>
                    <span className="font-mono text-slate-800">
                      {selectedOrder.customerPhone || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Shipping Address</span>
                    <span className="text-slate-800">
                      {selectedOrder.shippingAddress || 'Standard Delivery Address Verified at Checkout'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Line Items ({selectedOrder.items?.length || 0})
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">Attribution</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-right">Discount</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.items?.map((item: MerchantOrderItemData) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {item.productName}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {getAttributionBadge(item.attributionSource)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                            ₹{item.unitPrice.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-600 font-medium">
                            {item.discountPercent > 0
                              ? `-${item.discountPercent}% (₹${item.discountAmount.toFixed(2)})`
                              : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                            ₹{item.lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Order Financials & Payment Verification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Payment Gateway Metadata */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                    Payment Verification
                  </div>
                  <div className="space-y-1 text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment Status:</span>
                      <span className="font-bold text-slate-900">{selectedOrder.paymentStatus}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Razorpay Order ID:</span>
                      <span className="font-mono text-slate-800 truncate max-w-[150px]" title={selectedOrder.razorpayOrderId || 'N/A'}>
                        {selectedOrder.razorpayOrderId || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Razorpay Payment ID:</span>
                      <span className="font-mono text-slate-800 truncate max-w-[150px]" title={selectedOrder.razorpayPaymentId || 'N/A'}>
                        {selectedOrder.razorpayPaymentId || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Subtotal / Discount / Total */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Financial Summary
                  </div>
                  <div className="space-y-1.5 text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Subtotal:</span>
                      <span className="font-mono text-slate-900">₹{selectedOrder.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600">
                      <span>Applied Discounts:</span>
                      <span className="font-mono font-semibold">-₹{selectedOrder.discount.toFixed(2)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-extrabold text-slate-900">
                      <span>Grand Total:</span>
                      <span className="font-mono text-base">₹{selectedOrder.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                {selectedOrder.status !== 'CANCELLED' ? (
                  <button
                    onClick={() => {
                      setOrderToCancel(selectedOrder);
                      setIsCancelModalOpen(true);
                    }}
                    className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel Order
                  </button>
                ) : (
                  <span className="text-slate-400 text-xs italic">This order is cancelled</span>
                )}
              </div>

              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Confirmation Modal */}
      {isCancelModalOpen && orderToCancel && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900">Cancel this order?</h3>
            
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Are you sure you want to cancel order <strong className="font-mono">#{orderToCancel.id.slice(-8).toUpperCase()}</strong>?
            </p>

            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] leading-relaxed">
              <strong>Inventory Restoration:</strong> Cancelling will atomically return all reserved items in this order back into available stock.
              {orderToCancel.paymentStatus === 'PAID' && (
                <div className="mt-1 font-medium text-amber-900">
                  Note: This order was PAID via Razorpay. Automatic payment refund is not processed in this phase.
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                disabled={isCancelling}
                onClick={() => {
                  setIsCancelModalOpen(false);
                  setOrderToCancel(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Keep Order
              </button>

              <button
                disabled={isCancelling}
                onClick={handleConfirmCancel}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isCancelling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Confirm & Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
