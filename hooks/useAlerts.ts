import axios from "axios";
import { useCallback, useEffect, useState } from "react";

export interface AlertAction {
  type: string;
  label: string;
  description: string;
  icon: string;
  urgent: boolean;
}

export interface Alert {
  alertId: string;
  productId: string;
  productName: string;
  category?: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string | null;
  daysUntilExpiry: number | null;
  alertLevel?: "expired" | "critical" | "high" | "early" | "normal" | "slow-moving";
  level?: "expired" | "critical" | "high" | "early" | "normal" | "slow-moving";
  priority: number;
  color: string;
  actions: AlertAction[];
  imageUrl?: string;
  barcode?: string;
  // Slow-moving product metadata
  velocity?: string;
  daysInStock?: number;
  salesLast30Days?: number;
}

export interface AlertSummary {
  total: number;
  expired: number;
  critical: number;
  high: number;
  early: number;
  slowMoving: number;
  totalValue: number;
  urgentActions: number;
}

export interface AlertThresholds {
  critical: number;
  highUrgency: number;
  earlyWarning: number;
}

export interface AlertSettings {
  thresholds: AlertThresholds;
  categoryThresholds?: Record<string, AlertThresholds> | Map<string, AlertThresholds>;
  notificationPreferences?: {
    enablePush: boolean;
    enableEmail: boolean;
    dailySummary: boolean;
    summaryTime: string;
  };
}

export const useAlerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/alerts`;

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      // Use shorter timeout for alerts
      const response = await axios.get(API_URL, { timeout: 8000 });

      // The backend returns { success: true, data: { alerts: [], summary: {}, thresholds: {} } }
      const backendData = response.data.data;
      const rawAlerts = backendData.alerts || [];

      const processed = rawAlerts.map((item: any) => ({
        ...item,
        // BACKEND MAPPING:
        // Backend uses 'level', frontend uses 'alertLevel'
        alertLevel: item.level || "normal",
        // Backend uses 'daysLeft', frontend uses 'daysUntilExpiry'
        daysUntilExpiry: item.daysLeft !== undefined ? item.daysLeft : null,
        // Ensure alertId exists
        alertId: item.alertId || item._id,
      }));

      setAlerts(processed);
      setSummary(backendData.summary);
    } catch (err: any) {
      console.error("Fetch Alerts Error:", err);
      // Handle different types of errors gracefully
      if (err.response?.status === 401) {
        setError("Authentication required. Please log in.");
      } else if (err.response?.status === 500) {
        setError("Server error. Please try again later.");
      } else if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK') {
        setError("Unable to reach server. Check your connection.");
      } else {
        setError("Failed to fetch alerts");
      }
      setAlerts([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  const fetchSettings = useCallback(async () => {
    try {
      // Use shorter timeout and fail silently
      const response = await axios.get(`${API_URL}/settings`, { timeout: 5000 });
      if (response.data.success) {
        setSettings(response.data.data);
      }
    } catch (err) {
      // Silently fail - settings are not critical for initial load
      console.error("Settings Fetch Error:", err);
    }
  }, [API_URL]);

  const updateSettings = async (newSettings: Partial<AlertSettings>) => {
    try {
      const response = await axios.put(`${API_URL}/settings`, newSettings);
      if (response.data.success) {
        setSettings(response.data.data);
        // Refresh alerts immediately so new thresholds take effect
        await fetchAlerts();
        return { success: true };
      }
      return { success: false };
    } catch (err) {
      console.error("Update Settings Error:", err);
      return { success: false };
    }
  };

  const acknowledgeAlert = async (alertId: string, action: string) => {
    try {
      const response = await axios.post(`${API_URL}/acknowledge`, {
        alertId,
        action,
      });
      if (response.data.success) {
        setAlerts((prev) => prev.filter((a) => a.alertId !== alertId));
        return { success: true };
      }
      return { success: false };
    } catch (err) {
      return { success: false };
    }
  };

  useEffect(() => {
    fetchAlerts();
    fetchSettings();
  }, [fetchAlerts, fetchSettings]);

  return {
    alerts,
    summary,
    settings,
    loading,
    error,
    refresh: fetchAlerts,
    updateSettings,
    acknowledgeAlert,
  };
};
