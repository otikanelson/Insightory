/**
 * API Configuration
 * Centralized API URL configuration for the entire app
 */

// Read from environment variable
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://inventory-application-xjc5.onrender.com/api';

// WebSocket URL (derived from API_URL)
export const WS_URL = API_URL.replace('/api', '').replace('http', 'ws');
