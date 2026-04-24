// Goal: Create a custom React Hook to manage product inventory with TypeScript support.
// Features:
// - Registry Sync: Fetch all products from the backend and maintain global inventory state.
// - Type Safety: Define strict TypeScript interfaces for Product and Batch entities.
// - Batch Tracking: Support nested arrays for multiple batches (batch number, qty, expiry) per product.
// - Auto-Aggregation: Sum individual batch quantities to show total product stock.
// - Internal Coding: Handle the hasBarcode flag to distinguish between UPC and system-generated IDs.
// - Detail Fetching: Provide a method to retrieve a single product's full history for the View page.
// - State Management: Export loading, error, and manual refresh functions for UI control.

import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";

/** Types & Interfaces **/
export interface Batch {
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  price?: number;
}

export interface Product {
  _id: string;
  name: string;
  category?: string;
  totalQuantity: number;
  imageUrl?: string;
  isPerishable: boolean;
  batches: Batch[];
  barcode: string;
  hasBarcode: boolean;
  updatedAt: string;
  genericPrice?: number | null;
}

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [recentlySold, setRecentlySold] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/products`;
  const ANALYTICS_URL = `${process.env.EXPO_PUBLIC_API_URL}/analytics`;

  /** Fetch & Transform Data **/
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      
      // Use shorter timeout for product list (10 seconds)
      const response = await axios.get(API_URL, { timeout: 10000 });
      
      // Handle different response structures
      let rawData = [];
      if (response.data.status === 'success' && response.data.data?.products) {
        rawData = response.data.data.products;
      } else if (Array.isArray(response.data)) {
        rawData = response.data;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        rawData = response.data.data;
      }

      // Ensure rawData is an array
      if (!Array.isArray(rawData)) {
        rawData = [];
      }

      // Transform: Use totalQuantity from backend (calculated via pre-save hook)
      const formattedData = rawData.map((p: any) => ({
        ...p,
        name: p.productName || p.name, // Map productName to name for consistency
        // Backend already calculates totalQuantity, but ensure it exists
        totalQuantity:
          p.totalQuantity ??
          p.Insightoryuantity ??
          p.batches?.reduce((acc: number, b: Batch) => acc + b.quantity, 0) ??
          0,
        // Ensure batches is always an array
        batches: Array.isArray(p.batches) ? p.batches : [],
      }));

      setProducts(formattedData);
      setError(null);
    } catch (err: any) {
      // Handle different types of errors gracefully
      if (err.response?.status === 401) {
        setError("Authentication required. Please log in.");
      } else if (err.response?.status === 500) {
        setError("Database connection issue. Please check backend.");
      } else if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK') {
        setError("Unable to reach server. Check your connection.");
      } else {
        setError("Unable to load products. Please try again.");
      }
      setProducts([]); // Set empty array so app doesn't crash
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  /** Fetch Recently Sold Products **/
  const fetchRecentlySold = useCallback(async () => {
    try {
      // Use shorter timeout and don't block on failure
      const response = await axios.get(`${ANALYTICS_URL}/recently-sold?limit=10`, { 
        timeout: 5000 
      });
      
      if (response.data.success) {
        const data = response.data.data || [];
        setRecentlySold(data);
      } else {
        setRecentlySold([]);
      }
    } catch (err: any) {
      // Silently fail - recently sold is not critical
      setRecentlySold([]);
    }
  }, [ANALYTICS_URL]);

  /** Real-Time Analytics (Memoized for performance) **/
  const inventoryStats = useMemo(() => {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    return {
      totalSkus: products.length,
      totalUnits: products.reduce((acc, p) => acc + p.totalQuantity, 0),
      lowStockCount: products.filter(
        (p) => p.totalQuantity > 0 && p.totalQuantity < 10,
      ).length,
      expiringSoonCount: products.filter((p) =>
        Array.isArray(p.batches) && p.batches.some((b) => {
          const exp = new Date(b.expiryDate);
          return exp > now && exp <= thirtyDaysFromNow;
        }),
      ).length,
      outOfStockCount: products.filter((p) => p.totalQuantity === 0).length,
    };
  }, [products]);

  /** Unified Detail Fetcher (ID or Barcode) **/
  const getProductById = async (
    identifier: string,
  ): Promise<Product | null> => {
    try {
      // Use shorter timeout for single product fetch
      const response = await axios.get(`${API_URL}/${identifier}`, { 
        timeout: 8000 
      });
      
      // Handle different response structures
      let item = null;
      if (response.data.status === 'success' && response.data.data?.product) {
        item = response.data.data.product;
      } else if (response.data.data) {
        item = response.data.data;
      } else {
        item = response.data;
      }

      if (!item) {
        return null;
      }

      return {
        ...item,
        name: item.productName || item.name,
        // Ensure totalQuantity is present
        totalQuantity:
          item.totalQuantity ??
          item.batches?.reduce(
            (acc: number, b: Batch) => acc + b.quantity,
            0,
          ) ??
          0,
        // Ensure batches is always an array
        batches: Array.isArray(item.batches) ? item.batches : [],
      };
    } catch (err: any) {
      // Don't log 404 errors as they're expected when product is not in inventory
      if (err.response?.status !== 404) {
        console.error(`Detail Fetch Error for [${identifier}]:`, err);
      }
      return null;
    }
  };

  /** Local Filtering (Search) **/
  const filterProducts = (query: string) => {
    if (!query) return products;
    const lowerQuery = query.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.barcode.includes(query) ||
        p.category?.toLowerCase().includes(lowerQuery),
    );
  };

  /** Initial Synchronization **/
  useEffect(() => {
    fetchProducts();
    fetchRecentlySold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  /** Refresh function that updates both products and recently sold **/
  const refresh = useCallback(async () => {
    await Promise.all([fetchProducts(), fetchRecentlySold()]);
  }, [fetchProducts, fetchRecentlySold]);

  return {
    products,
    recentlySold,
    inventoryStats,
    loading,
    error,
    refresh,
    getProductById,
    filterProducts,
  };
};
