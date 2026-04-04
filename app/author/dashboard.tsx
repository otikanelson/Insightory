import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import Toast from 'react-native-toast-message';
import { useTheme } from '../../context/ThemeContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';

interface Store {
  _id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  isActive: boolean;
  adminCount?: number;
  staffCount?: number;
  productCount?: number;
}

export default function AuthorDashboard() {
  const { theme, isDark } = useTheme();

    const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalStores: 0,
    totalAdmins: 0,
    totalStaff: 0,
    totalProducts: 0,
  });
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!hasLoaded) {
      loadStores();
      setHasLoaded(true);
    }
  }, [hasLoaded]);

  const loadStores = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem('auth_session_token');
      
      if (!sessionToken) {
        Toast.show({
          type: 'error',
          text1: 'Not Authenticated',
          text2: 'Please log in again',
        });
        router.replace('/auth/login' as any);
        return;
      }

      const response = await axios.get(`${API_URL}/author/stores`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.success) {
        const storesData = response.data.data;
        setStores(storesData);

        // Calculate stats
        const totalStores = storesData.length;
        const totalAdmins = storesData.reduce((sum: number, store: Store) => sum + (store.adminCount || 0), 0);
        const totalStaff = storesData.reduce((sum: number, store: Store) => sum + (store.staffCount || 0), 0);
        const totalProducts = storesData.reduce((sum: number, store: Store) => sum + (store.productCount || 0), 0);

        setStats({
          totalStores,
          totalAdmins,
          totalStaff,
          totalProducts,
        });
      }
    } catch (error: any) {
      console.error('Load stores error:', error);
      Toast.show({
        type: 'error',
        text1: 'Load Failed',
        text2: error.response?.data?.error || 'Could not load stores',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadStores();
  };

  const handleLogout = async () => {
    try {
      // Navigate immediately to prevent API calls
      router.replace('/auth/login' as any);
      
      // Clear auth data after navigation
      await AsyncStorage.multiRemove([
        'auth_session_token',
        'auth_user_role',
        'auth_user_id',
        'auth_user_name',
        'auth_last_login',
        'auth_is_author',
      ]);

      // Show toast after navigation
      setTimeout(() => {
        Toast.show({
          type: 'success',
          text1: 'Logged Out',
          text2: 'Author session ended',
        });
      }, 100);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading stores...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerSub, { color: theme.primary }]}>AUTHOR_DASHBOARD</Text>
            <Text style={[styles.headerTitle, { color: theme.text }]}>System Overview</Text>
          </View>
          <Pressable style={[styles.logoutBtn, { backgroundColor: theme.surface }]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={theme.primary} />
          </Pressable>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.statIcon, { backgroundColor: '#5856D6' + '20' }]}>
              <Ionicons name="storefront" size={24} color="#5856D6" />
            </View>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.totalStores}</Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>Stores</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.statIcon, { backgroundColor: '#FF9500' + '20' }]}>
              <Ionicons name="shield-checkmark" size={24} color="#FF9500" />
            </View>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.totalAdmins}</Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>Admins</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.statIcon, { backgroundColor: '#34C759' + '20' }]}>
              <Ionicons name="people" size={24} color="#34C759" />
            </View>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.totalStaff}</Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>Staff</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.statIcon, { backgroundColor: '#AF52DE' + '20' }]}>
              <Ionicons name="cube" size={24} color="#AF52DE" />
            </View>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.totalProducts}</Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>Products</Text>
          </View>
        </View>

        {/* Stores List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>ALL STORES</Text>
            <View style={[styles.countBadge, { backgroundColor: theme.primary + '20' }]}>
              <Text style={[styles.countBadgeText, { color: theme.primary }]}>{stores.length}</Text>
            </View>
          </View>

          {stores.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="storefront-outline" size={48} color={theme.subtext} />
              <Text style={[styles.emptyText, { color: theme.text }]}>No Stores Yet</Text>
              <Text style={[styles.emptyDesc, { color: theme.subtext }]}>
                Stores will appear here when admins create accounts
              </Text>
            </View>
          ) : (
            <View style={styles.storesList}>
              {stores.map((store) => (
                <Pressable
                  key={store._id}
                  style={[styles.storeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => {
                    console.log('Navigating to store:', store._id);
                    router.push(`/author/store/${store._id}` as any);
                  }}
                >
                  <View style={styles.storeHeader}>
                    <View style={[styles.storeIcon, { backgroundColor: theme.primary + '20' }]}>
                      <Ionicons name="storefront" size={28} color={theme.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.storeName, { color: theme.text }]} numberOfLines={1}>
                        {store.name}
                      </Text>
                      <Text style={[styles.storeDate, { color: theme.subtext }]}>
                        Created {new Date(store.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: store.isActive ? '#34C759' + '20' : '#FF3B30' + '20',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: store.isActive ? '#34C759' : '#FF3B30' },
                        ]}
                      >
                        {store.isActive ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.divider, { backgroundColor: theme.border }]} />

                  <View style={styles.storeStats}>
                    <View style={styles.storeStat}>
                      <View style={[styles.statIconSmall, { backgroundColor: '#FF9500' + '15' }]}>
                        <Ionicons name="shield-checkmark" size={14} color="#FF9500" />
                      </View>
                      <Text style={[styles.storeStatText, { color: theme.text }]}>
                        {store.adminCount || 0}
                      </Text>
                      <Text style={[styles.storeStatLabel, { color: theme.subtext }]}>
                        admin{(store.adminCount || 0) !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={styles.storeStat}>
                      <View style={[styles.statIconSmall, { backgroundColor: '#34C759' + '15' }]}>
                        <Ionicons name="people" size={14} color="#34C759" />
                      </View>
                      <Text style={[styles.storeStatText, { color: theme.text }]}>
                        {store.staffCount || 0}
                      </Text>
                      <Text style={[styles.storeStatLabel, { color: theme.subtext }]}>staff</Text>
                    </View>
                    <View style={styles.storeStat}>
                      <View style={[styles.statIconSmall, { backgroundColor: '#AF52DE' + '15' }]}>
                        <Ionicons name="cube" size={14} color="#AF52DE" />
                      </View>
                      <Text style={[styles.storeStatText, { color: theme.text }]}>
                        {store.productCount || 0}
                      </Text>
                      <Text style={[styles.storeStatLabel, { color: theme.subtext }]}>products</Text>
                    </View>
                  </View>

                  <View style={[styles.divider, { backgroundColor: theme.border }]} />

                  <View style={styles.storeFooter}>
                    <Text style={[styles.viewDetails, { color: theme.primary }]}>View Details</Text>
                    <Ionicons name="arrow-forward" size={18} color={theme.primary} />
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 70,
    marginBottom: 30,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 30,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  emptyState: {
    padding: 50,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },
  storesList: {
    gap: 15,
  },
  storeCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 16,
  },
  storeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  storeDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    marginBottom: 16,
  },
  storeStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  storeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statIconSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeStatText: {
    fontSize: 16,
    fontWeight: '800',
  },
  storeStatLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  storeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  viewDetails: {
    fontSize: 14,
    fontWeight: '700',
  },
});
