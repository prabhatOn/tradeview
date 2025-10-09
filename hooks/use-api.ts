import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiResponse } from '@/lib/types';

// Generic API hook for data fetching with caching and error handling
export function useApi<T = any>(
  apiCall: () => Promise<ApiResponse<T>>,
  dependencies: any[] = [],
  options: {
    immediate?: boolean;
    cacheKey?: string;
    cacheDuration?: number; // in milliseconds
  } = {}
) {
  const { immediate = true, cacheKey, cacheDuration = 300000 } = options; // 5 minutes default cache
  
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  
  const abortControllerRef = useRef<AbortController>();
  const cacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());

  const fetchData = useCallback(async () => {
    // Check cache first
    if (cacheKey) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheDuration) {
        setData(cached.data);
        setLastFetch(new Date(cached.timestamp));
        return cached.data;
      }
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiCall();
      
      if (response.success && response.data !== undefined) {
        setData(response.data);
        setLastFetch(new Date());
        
        // Cache the result
        if (cacheKey) {
          cacheRef.current.set(cacheKey, {
            data: response.data,
            timestamp: Date.now(),
          });
        }
        
        return response.data;
      } else {
        throw new Error(response.error?.message || 'Request failed');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'An error occurred');
        console.error('API call failed:', err);
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [apiCall, cacheKey, cacheDuration, ...dependencies]);

  const refetch = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  const clearCache = useCallback(() => {
    if (cacheKey) {
      cacheRef.current.delete(cacheKey);
    }
  }, [cacheKey]);

  useEffect(() => {
    if (immediate) {
      fetchData();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, dependencies);

  return {
    data,
    isLoading,
    error,
    refetch,
    clearCache,
    lastFetch,
  };
}

// Hook for debounced API calls (useful for search)
export function useDebouncedApi<T = any>(
  apiCall: (query: string) => Promise<ApiResponse<T>>,
  delay: number = 300
) {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  const search = useCallback((searchQuery: string) => {
    setQuery(searchQuery);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!searchQuery.trim()) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    timeoutRef.current = setTimeout(async () => {
      abortControllerRef.current = new AbortController();
      
      try {
        const response = await apiCall(searchQuery);
        
        if (response.success && response.data !== undefined) {
          setData(response.data);
        } else {
          throw new Error(response.error?.message || 'Search failed');
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Search failed');
        }
      } finally {
        setIsLoading(false);
      }
    }, delay);
  }, [apiCall, delay]);

  const clear = useCallback(() => {
    setQuery('');
    setData(null);
    setError(null);
    setIsLoading(false);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    query,
    data,
    isLoading,
    error,
    search,
    clear,
  };
}

// Hook for paginated data
export function usePagination<T = any>(
  apiCall: (page: number, limit: number) => Promise<ApiResponse<{ data: T[]; pagination: any }>>,
  initialLimit: number = 20
) {
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: initialLimit,
    total: 0,
    pages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (page: number, limit: number = pagination.limit) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiCall(page, limit);
      
      if (response.success && response.data) {
        setData(response.data.data);
        setPagination({
          page,
          limit,
          total: response.data.pagination.total,
          pages: response.data.pagination.pages,
        });
      } else {
        throw new Error(response.error?.message || 'Failed to fetch data');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [apiCall, pagination.limit]);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= pagination.pages) {
      fetchPage(page);
    }
  }, [fetchPage, pagination.pages]);

  const nextPage = useCallback(() => {
    if (pagination.page < pagination.pages) {
      fetchPage(pagination.page + 1);
    }
  }, [fetchPage, pagination.page, pagination.pages]);

  const prevPage = useCallback(() => {
    if (pagination.page > 1) {
      fetchPage(pagination.page - 1);
    }
  }, [fetchPage, pagination.page]);

  const changeLimit = useCallback((newLimit: number) => {
    fetchPage(1, newLimit);
  }, [fetchPage]);

  const refresh = useCallback(() => {
    fetchPage(pagination.page);
  }, [fetchPage, pagination.page]);

  // Load first page on mount
  useEffect(() => {
    fetchPage(1);
  }, []);

  return {
    data,
    pagination,
    isLoading,
    error,
    goToPage,
    nextPage,
    prevPage,
    changeLimit,
    refresh,
    hasNextPage: pagination.page < pagination.pages,
    hasPrevPage: pagination.page > 1,
  };
}

// Hook for optimistic updates
export function useOptimisticUpdate<T = any>() {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optimisticAdd = useCallback(async (
    newItem: T,
    apiCall: () => Promise<ApiResponse<T>>,
    getId: (item: T) => string | number
  ) => {
    // Add optimistically
    setData(prev => [...prev, newItem]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiCall();
      
      if (response.success && response.data) {
        // Replace optimistic item with real data
        setData(prev => prev.map(item => 
          getId(item) === getId(newItem) ? response.data! : item
        ));
      } else {
        // Revert on failure
        setData(prev => prev.filter(item => getId(item) !== getId(newItem)));
        throw new Error(response.error?.message || 'Failed to add item');
      }
    } catch (err: any) {
      // Revert on error
      setData(prev => prev.filter(item => getId(item) !== getId(newItem)));
      setError(err.message || 'Failed to add item');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const optimisticUpdate = useCallback(async (
    updatedItem: T,
    apiCall: () => Promise<ApiResponse<T>>,
    getId: (item: T) => string | number
  ) => {
    const originalData = [...data];
    
    // Update optimistically
    setData(prev => prev.map(item => 
      getId(item) === getId(updatedItem) ? updatedItem : item
    ));
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiCall();
      
      if (response.success && response.data) {
        // Update with real data
        setData(prev => prev.map(item => 
          getId(item) === getId(updatedItem) ? response.data! : item
        ));
      } else {
        // Revert on failure
        setData(originalData);
        throw new Error(response.error?.message || 'Failed to update item');
      }
    } catch (err: any) {
      // Revert on error
      setData(originalData);
      setError(err.message || 'Failed to update item');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [data]);

  const optimisticRemove = useCallback(async (
    itemId: string | number,
    apiCall: () => Promise<ApiResponse<void>>,
    getId: (item: T) => string | number
  ) => {
    const originalData = [...data];
    
    // Remove optimistically
    setData(prev => prev.filter(item => getId(item) !== itemId));
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiCall();
      
      if (!response.success) {
        // Revert on failure
        setData(originalData);
        throw new Error(response.error?.message || 'Failed to remove item');
      }
    } catch (err: any) {
      // Revert on error
      setData(originalData);
      setError(err.message || 'Failed to remove item');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [data]);

  const setInitialData = useCallback((initialData: T[]) => {
    setData(initialData);
  }, []);

  return {
    data,
    isLoading,
    error,
    optimisticAdd,
    optimisticUpdate,
    optimisticRemove,
    setInitialData,
  };
}