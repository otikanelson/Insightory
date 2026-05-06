import { Ionicons } from "@expo/vector-icons";
import {
    Dimensions,
    FlatList,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    TextInput,
    View
} from "react-native";
import { ThemedText } from '../components/ThemedText';
import { useTheme } from "../context/ThemeContext";
import { useState } from "react";

const { width } = Dimensions.get("window");

interface Product {
  _id: string;
  name: string;
  category?: string;
  imageUrl?: string;
  totalQuantity: number;
  barcode?: string;
}

interface AddProductModalProps {
  visible: boolean;
  products: Product[];
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
  emptyMessage?: string;
}

export const AddProductModal = ({
  visible,
  products,
  onClose,
  onSelectProduct,
  emptyMessage = "No products available"
}: AddProductModalProps) => {
  const { theme } = useTheme();
  const [query, setQuery] = useState("");

  const filtered = products
    .filter(p => p.totalQuantity > 0)
    .filter(p => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.category?.toLowerCase().includes(q)) ||
        (p.barcode?.toLowerCase().includes(q))
      );
    });

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  const handleSelect = (product: Product) => {
    setQuery("");
    onSelectProduct(product);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View>
              <ThemedText style={[styles.title, { color: theme.text }]}>
                Select Product
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: theme.subtext }]}>
                {products.filter(p => p.totalQuantity > 0).length} products available
              </ThemedText>
            </View>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={theme.text} />
            </Pressable>
          </View>

          {/* Search Bar */}
          <View style={[styles.searchWrapper, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
            <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="search-outline" size={18} color={theme.subtext} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search by name, category or barcode…"
                placeholderTextColor={theme.subtext}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={theme.subtext} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Product List */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={[styles.productItem, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => handleSelect(item)}
              >
                {/* Product Image */}
                <View style={[styles.productImage, { backgroundColor: theme.surface }]}>
                  {item.imageUrl && item.imageUrl !== "cube" ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.image} />
                  ) : (
                    <Ionicons name="cube-outline" size={32} color={theme.subtext} />
                  )}
                </View>

                {/* Product Info */}
                <View style={styles.productInfo}>
                  <ThemedText style={[styles.productName, { color: theme.text }]} numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                  <ThemedText style={[styles.productDetails, { color: theme.subtext }]}>
                    {item.category || "Uncategorized"} · Stock: {item.totalQuantity}
                  </ThemedText>
                  {item.barcode && (
                    <ThemedText style={[styles.productBarcode, { color: theme.subtext }]}>
                      {item.barcode}
                    </ThemedText>
                  )}
                </View>

                {/* Add Icon */}
                <Ionicons name="add-circle" size={28} color={theme.primary} />
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons
                  name={query ? "search-outline" : "cube-outline"}
                  size={56}
                  color={theme.subtext + "40"}
                />
                <ThemedText style={[styles.emptyText, { color: theme.subtext }]}>
                  {query ? `No results for "${query}"` : emptyMessage}
                </ThemedText>
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery("")} style={[styles.clearBtn, { borderColor: theme.border }]}>
                    <ThemedText style={[styles.clearBtnText, { color: theme.primary }]}>Clear search</ThemedText>
                  </Pressable>
                )}
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: "80%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 22,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  listContent: {
    padding: 16,
  },
  productItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 16,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  productDetails: {
    fontSize: 13,
    marginBottom: 2,
  },
  productBarcode: {
    fontSize: 11,
    fontFamily: "monospace",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 4,
    textAlign: "center",
  },
  clearBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
});

