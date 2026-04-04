import { Ionicons } from "@expo/vector-icons";
import { Href, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { Product } from "../hooks/useProducts";
import { Prediction } from "../types/ai-predictions";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width / 2 - 27;

// --- SKELETON ---
export const ProductCardSkeleton = () => {
  const { theme, isDark } = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const skeletonBg = isDark ? '#ffffff0D' : '#0000000A';

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.topLabels}>
        <Animated.View style={[styles.skeletonPill, { backgroundColor: skeletonBg, opacity: pulse }]} />
        <Animated.View style={[styles.skeletonPill, { backgroundColor: skeletonBg, width: 36, opacity: pulse }]} />
      </View>
      <Animated.View style={[styles.imageWrapper, { backgroundColor: skeletonBg, opacity: pulse }]}>
        <Ionicons name="cube-outline" size={36} color={isDark ? '#ffffff10' : '#00000010'} />
      </Animated.View>
      <View style={styles.footer}>
        <View style={{ flex: 1, gap: 6 }}>
          <Animated.View style={{ height: 9, width: '40%', backgroundColor: skeletonBg, borderRadius: 4, opacity: pulse }} />
          <Animated.View style={{ height: 13, width: '75%', backgroundColor: skeletonBg, borderRadius: 4, opacity: pulse }} />
        </View>
        <Animated.View style={[styles.arrowCircle, { backgroundColor: skeletonBg, opacity: pulse }]} />
      </View>
    </View>
  );
};

// --- MAIN CARD ---
interface ProductCardProps {
  item: Product;
  prediction?: Prediction | null;
  sortField?: 'name' | 'totalQuantity' | 'risk' | 'velocity';
}

const getRiskColor = (score: number) => {
  if (score >= 70) return '#EF4444';
  if (score >= 50) return '#F59E0B';
  if (score >= 30) return '#EAB308';
  return null;
};

const getVelocityIndicator = (v: number) => {
  if (v > 5) return { icon: 'flash' as const, color: '#10B981' };
  if (v < 0.5) return { icon: 'hourglass' as const, color: '#F59E0B' };
  return null;
};

export const ProductCard = React.memo(({ item, prediction, sortField = 'name' }: ProductCardProps) => {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);

  const riskScore = prediction?.metrics?.riskScore || 0;
  const velocity = prediction?.metrics?.velocity || 0;
  const riskColor = getRiskColor(riskScore);
  const velocityIndicator = getVelocityIndicator(velocity);

  return (
    <Pressable
      onPress={() => router.push(`/product/${item._id}` as Href)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.88 : 1 },
      ]}
    >
      {riskColor && riskScore > 0 && (
        <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
      )}

      <View style={styles.topLabels}>
        <View style={[styles.pill, styles.categoryPill, { backgroundColor: isDark ? '#ffffff0D' : '#0000000A' }]}>
          <Ionicons name="pricetag-outline" size={9} color={theme.subtext} />
          <Text style={[styles.pillText, { color: theme.subtext }]} numberOfLines={1}>
            {item.category || 'General'}
          </Text>
        </View>
        <View style={[styles.pill, { backgroundColor: item.isPerishable ? theme.primaryLight : (isDark ? '#ffffff0D' : '#0000000A') }]}>
          <Ionicons
            name={item.isPerishable ? 'hourglass-outline' : 'cube-outline'}
            size={9}
            color={item.isPerishable ? theme.primary : theme.subtext}
          />
          <Text style={[styles.pillText, { color: item.isPerishable ? theme.primary : theme.subtext }]}>
            {item.isPerishable ? 'FEFO' : 'STD'}
          </Text>
        </View>
      </View>

      <View style={[styles.imageWrapper, { backgroundColor: isDark ? '#ffffff08' : '#00000008' }]}>
        {velocityIndicator && (
          <View style={[styles.velocityBadge, { backgroundColor: velocityIndicator.color + '22' }]}>
            <Ionicons name={velocityIndicator.icon} size={9} color={velocityIndicator.color} />
          </View>
        )}
        {!isLoaded && (
          <Ionicons name="cube-outline" size={38} color={isDark ? '#ffffff15' : '#00000012'} />
        )}
        {item.imageUrl && item.imageUrl !== 'cube' && item.imageUrl !== '' && (
          <Image
            source={{ uri: item.imageUrl }}
            style={[styles.image, { opacity: isLoaded ? 1 : 0 }]}
            onLoad={() => setIsLoaded(true)}
            onError={() => setIsLoaded(false)}
            resizeMode="contain"
          />
        )}
      </View>

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          {sortField === 'risk' && prediction ? (
            <>
              <Text style={[styles.quantityLabel, { color: riskColor || theme.subtext }]}>Risk Score</Text>
              <Text style={[styles.name, { color: riskColor || theme.text }]} numberOfLines={1}>
                {Math.round(riskScore)}/100
              </Text>
            </>
          ) : sortField === 'velocity' && prediction ? (
            <>
              <Text style={[styles.quantityLabel, { color: velocityIndicator?.color || theme.subtext }]}>Velocity</Text>
              <Text style={[styles.name, { color: velocityIndicator?.color || theme.text }]} numberOfLines={1}>
                {velocity.toFixed(1)}/day
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.quantityLabel, { color: theme.subtext }]}>{item.totalQuantity} items</Text>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
            </>
          )}
        </View>
        <View style={[styles.arrowCircle, { backgroundColor: theme.primaryLight }]}>
          <Ionicons name="arrow-forward" size={13} color={theme.primary} />
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: 24,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    position: 'relative',
  },
  riskDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 10,
  },
  velocityBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  topLabels: { flexDirection: 'row', gap: 5, marginBottom: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryPill: { flex: 1, minWidth: 0 },
  pillText: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
  imageWrapper: {
    width: '100%',
    height: 130,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  image: { width: '90%', height: '90%', borderRadius: 16 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 2,
  },
  quantityLabel: { fontSize: 11, fontWeight: '500', marginBottom: 2 },
  name: { fontSize: 14, fontWeight: '800' },
  arrowCircle: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonPill: { height: 18, width: 52, borderRadius: 8 },
});
