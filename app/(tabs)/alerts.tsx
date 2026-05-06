import { ModalToast, useModalToast } from "@/components/ModalToast";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HelpTooltip } from "../../components/HelpTooltip";
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from "../../context/ThemeContext";
import { useAdminAuth } from "../../hooks/useAdminAuth";
import { Alert, AlertAction, useAlerts } from "../../hooks/useAlerts";

export default function Alerts() {
  const { theme } = useTheme();
  const modalToast = useModalToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { alerts, summary, loading, refresh, acknowledgeAlert } = useAlerts();
  const { validatePin } = useAdminAuth();

  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [selectedAction, setSelectedAction] = useState<AlertAction | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showInfoCard, setShowInfoCard] = useState(false);

  const filteredAlerts = alerts.filter((alert) => {
    const matchesLevel =
      selectedLevel === "all" || alert.alertLevel === selectedLevel;
    const matchesSearch =
      !searchQuery ||
      alert.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.category?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const handleAction = (alert: Alert, action: AlertAction) => {
    setSelectedAlert(alert);
    setSelectedAction(action);
    
    // Check if action requires admin password
    if (action.type === 'remove' || action.type === 'markdown') {
      setPasswordModalVisible(true);
      setAdminPin("");
      setPasswordError("");
    } else {
      setActionModalVisible(true);
    }
  };

  const verifyPassword = async () => {
    const isValid = await validatePin(adminPin);
    
    if (isValid) {
      setPasswordModalVisible(false);
      setPasswordError("");
      executeAction();
    } else {
      setPasswordError("Incorrect PIN");
    }
  };

  const executeAction = async () => {
    if (!selectedAlert || !selectedAction) return;

    try {
      if (selectedAction.type === 'remove') {
        // Remove only the specific batch, not the entire product
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL}/products/${selectedAlert.productId}/batches/${selectedAlert.batchNumber}`,
          { method: 'DELETE' }
        );
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          modalToast.show({ type: "success", title: "Batch Removed", message: `Batch ${selectedAlert.batchNumber} of ${selectedAlert.productName} has been deleted` });
          await acknowledgeAlert(selectedAlert.alertId, "Removed");
          refresh();
        } else {
          throw new Error(data.message || 'Failed to delete batch');
        }
      } else if (selectedAction.type === 'markdown') {
        // Apply discount based on the label
        let discountPercent = 40; // Default
        
        // Parse discount from label (e.g., "Discount 30-50%" or "Discount 15-25%")
        if (selectedAction.label.includes('30-50')) {
          discountPercent = 40; // Middle of 30-50%
        } else if (selectedAction.label.includes('15-25')) {
          discountPercent = 20; // Middle of 15-25%
        }
        
        console.log('Applying discount:', {
          productId: selectedAlert.productId,
          discountPercent,
          url: `${process.env.EXPO_PUBLIC_API_URL}/products/${selectedAlert.productId}/discount`
        });
        
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL}/products/${selectedAlert.productId}/discount`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discountPercent })
          }
        );
        
        const data = await response.json();
        console.log('Discount response:', { status: response.status, data });
        
        if (response.ok && data.success) {
          modalToast.show({ type: "success", title: "Discount Applied", message: `${discountPercent}% discount applied to ${selectedAlert.productName}` });
          await acknowledgeAlert(selectedAlert.alertId, "Discounted");
          refresh();
        } else {
          throw new Error(data.message || 'Failed to apply discount');
        }
      }
      
      setSelectedAlert(null);
      setSelectedAction(null);
      setAdminPin("");
    } catch (error: any) {
      console.error('Action error:', error);
      modalToast.show({ type: "error", title: "Action Failed", message: error.message || "Please try again" });
    }
  };

  const confirmAction = async () => {
    if (!selectedAlert) return;
    const result = await acknowledgeAlert(selectedAlert.alertId, "Acknowledged");
    if (result.success) {
      modalToast.show({ type: "success", title: "Action Recorded", message: `Applied to ${selectedAlert.productName}` });
      setActionModalVisible(false);
      setSelectedAlert(null);
    } else {
      modalToast.show({ type: "error", title: "Action Failed" });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <ThemedText style={[styles.subtitle, { color: theme.primary }]}>
              NOTIFICATION_CENTER
            </ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ThemedText style={[styles.title, { color: theme.text }]}>
                ALERTS
              </ThemedText>
              <Pressable onPress={() => setShowInfoCard(!showInfoCard)}>
                <Ionicons 
                  name={showInfoCard ? "chevron-up-circle" : "information-circle-outline"} 
                  size={18} 
                  color={theme.primary} 
                />
              </Pressable>
              <HelpTooltip
                title="Alert System"
                content={[
                  "Alerts notify you about products that need attention based on expiry dates, stock levels, and sales velocity.",
                  "Alert Levels: Expired (past expiry), Critical (<7 days), High (7-14 days), Early (14-30 days), Slow-Moving (low sales velocity).",
                  "Slow-Moving: Non-perishable products with velocity < 0.5 units/day for 30+ days. AI analyzes sales patterns to identify these.",
                  "Actions: Each alert suggests actions like discounting, removing, or restocking. Some actions require admin PIN.",
                  "Thresholds: Alert thresholds are configured by admin in Admin Settings. They can set global defaults and category-specific thresholds."
                ]}
                icon="help-circle-outline"
                iconSize={15}
                iconColor={theme.primary}
              />
            </View>
          </View>
          <Pressable
            onPress={() => router.push("/settings")}
            style={[styles.settingsBtn, { backgroundColor: theme.surface }]}
          >
            <Ionicons name="settings-outline" size={20} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.summaryGrid}>
          {[
            { label: "Expired", key: "expired", color: "#8B0000" },
            { label: "Critical", key: "critical", color: "#FF4444" },
            { label: "High", key: "high", color: "#FF9500" },
            { label: "Early", key: "early", color: "#FFD60A" },
            { label: "Slow", key: "slowMoving", color: "#9B59B6" },
          ].map((item) => (
            <View
              key={item.key}
              style={[
                styles.summaryCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: item.color,
                  borderWidth: 1.5,
                },
              ]}
            >
              <ThemedText style={[styles.summaryValue, { color: item.color }]}>
                {summary ? (summary as any)[item.key] || 0 : 0}
              </ThemedText>
              <ThemedText style={[styles.summaryLabel, { color: theme.subtext }]}>
                {item.label}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* Alert Labels Info Card - Toggleable */}
        {showInfoCard && (
          <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
              <ThemedText style={[styles.infoTitle, { color: theme.text }]}>Alert Labels</ThemedText>
            </View>
            <View style={styles.infoContent}>
              <View style={styles.infoRow}>
                <View style={[styles.infoDot, { backgroundColor: '#FF3B30' }]} />
                <ThemedText style={[styles.infoLabel, { color: theme.text }]}>Expired</ThemedText>
                <ThemedText style={[styles.infoDesc, { color: theme.subtext }]}>Past expiry date</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <View style={[styles.infoDot, { backgroundColor: '#FF3B30' }]} />
                <ThemedText style={[styles.infoLabel, { color: theme.text }]}>Critical</ThemedText>
                <ThemedText style={[styles.infoDesc, { color: theme.subtext }]}>≤7 days left</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <View style={[styles.infoDot, { backgroundColor: '#FF9500' }]} />
                <ThemedText style={[styles.infoLabel, { color: theme.text }]}>High</ThemedText>
                <ThemedText style={[styles.infoDesc, { color: theme.subtext }]}>8-14 days left</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <View style={[styles.infoDot, { backgroundColor: '#FFD60A' }]} />
                <ThemedText style={[styles.infoLabel, { color: theme.text }]}>Early</ThemedText>
                <ThemedText style={[styles.infoDesc, { color: theme.subtext }]}>15-30 days left</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <View style={[styles.infoDot, { backgroundColor: '#9B59B6' }]} />
                <ThemedText style={[styles.infoLabel, { color: theme.text }]}>Slow</ThemedText>
                <ThemedText style={[styles.infoDesc, { color: theme.subtext }]}>Low sales velocity</ThemedText>
              </View>
            </View>
          </View>
        )}

        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Ionicons name="search" size={18} color={theme.subtext} />
          <TextInput
            placeholder="Search alerts..."
            placeholderTextColor={theme.subtext}
            style={[styles.searchInput, { color: theme.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
        >
          {["all", "expired", "critical", "high", "early", "slow-moving"].map((level) => (
            <Pressable
              key={level}
              onPress={() => setSelectedLevel(level)}
              style={[
                styles.filterBtn,
                {
                  backgroundColor:
                    selectedLevel === level ? theme.primary : theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.filterText,
                  { color: selectedLevel === level ? "#FFF" : theme.text },
                ]}
              >
                {level === "slow-moving" ? "SLOW" : level.toUpperCase()}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {filteredAlerts.map((alert) => (
          <View
            key={alert.alertId}
            style={[
              styles.alertCard,
              {
                backgroundColor: theme.surface,
                borderColor: alert.color,
                borderLeftWidth: 6,
              },
            ]}
          >
            <Pressable
              onPress={() => router.push(`/product/${alert.productId}`)}>
              <View style={styles.alertHeader}>
                <View style={styles.alertInfo}>
                  <ThemedText style={[styles.alertName, { color: theme.text }]}>
                    {alert.productName}
                  </ThemedText>
                  <ThemedText style={[styles.alertMeta, { color: theme.subtext }]}>
                    Qty: {alert.quantity} • {alert.category}
                    {(alert.level || alert.alertLevel) === 'slow-moving' && (alert as any).velocity && (
                      <ThemedText style={{ color: '#9B59B6', }}>
                        {' '}• {(alert as any).velocity} units/day
                      </ThemedText>
                    )}
                  </ThemedText>
                </View>
                <View style={styles.alertStatus}>
                  <ThemedText style={[styles.daysText, { color: alert.color }]}>
                    {(alert.level || alert.alertLevel) === 'slow-moving' 
                      ? 'SLOW'
                      : alert.daysUntilExpiry !== null && alert.daysUntilExpiry !== undefined
                        ? alert.daysUntilExpiry <= 0
                          ? "EXP"
                          : `${alert.daysUntilExpiry}d`
                        : "N/A"}
                  </ThemedText>
                  <View
                    style={[
                      styles.levelBadge,
                      { backgroundColor: alert.color + "20" },
                    ]}
                  >
                    <ThemedText style={[styles.levelText, { color: alert.color }]}>
                      {(alert.alertLevel || alert.level || "N/A").toUpperCase()}
                    </ThemedText>
                  </View>
                </View>
              </View>
            </Pressable>

            <View style={styles.actionsRow}>
              {alert.actions?.slice(0, 2).map((action: any, idx: number) => (
                <Pressable
                  key={idx}
                  onPress={() => handleAction(alert, action)}
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor:
                        action.urgent ? alert.color + "15" : theme.background,
                      borderColor: action.urgent ? alert.color : theme.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={action.icon as any}
                    size={14}
                    color={action.urgent ? alert.color : theme.text}
                  />
                  <ThemedText
                    style={[
                      styles.actionText,
                      { color: action.urgent ? alert.color : theme.text },
                    ]}
                  >
                    {action.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={actionModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.surface }]}
          >
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
              Resolve Alert
            </ThemedText>
            <ThemedText style={[styles.modalText, { color: theme.subtext }]}>
              Mark {selectedAlert?.productName} as processed?
            </ThemedText>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setActionModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: theme.background }]}
              >
                <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={confirmAction}
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={{ color: "#FFF", }}>
                  Confirm
                </ThemedText>
              </Pressable>
            </View>
          </View>
          <ModalToast toast={modalToast} />
        </View>
      </Modal>

      {/* Admin Password Modal */}
      <Modal visible={passwordModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.surface }]}
          >
            <Ionicons name="lock-closed" size={40} color={theme.primary} style={{ marginBottom: 15 }} />
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
              Admin Authentication
            </ThemedText>
            <ThemedText style={[styles.modalText, { color: theme.subtext, marginBottom: 20 }]}>
              {selectedAction?.type === 'remove' 
                ? `Remove batch ${selectedAlert?.batchNumber} of ${selectedAlert?.productName}?`
                : `Apply ${selectedAction?.label.includes('30-50') ? '40%' : '20%'} discount to ${selectedAlert?.productName}?`
              }
            </ThemedText>
            
            <View style={[styles.passwordInput, { backgroundColor: theme.background, borderColor: passwordError ? '#FF4444' : theme.border }]}>
              <Ionicons name="key-outline" size={18} color={theme.subtext} />
              <TextInput
                placeholder="Enter 4-digit admin PIN"
                placeholderTextColor={theme.subtext}
                style={[styles.passwordField, { color: theme.text }]}
                value={adminPin}
                onChangeText={(text) => {
                  setAdminPin(text);
                  setPasswordError("");
                }}
                secureTextEntry
                keyboardType="numeric"
                maxLength={4}
                autoFocus
                onSubmitEditing={verifyPassword}
              />
            </View>
            
            {passwordError ? (
              <ThemedText style={[styles.errorText, { color: '#FF4444' }]}>
                {passwordError}
              </ThemedText>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setPasswordModalVisible(false);
                  setAdminPin("");
                  setPasswordError("");
                }}
                style={[styles.modalBtn, { backgroundColor: theme.background }]}
              >
                <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={verifyPassword}
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={{ color: "#FFF", }}>
                  Confirm
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 28, letterSpacing: -1 },
  subtitle: { fontSize: 10, marginTop: 4, letterSpacing: 2 },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryGrid: { flexDirection: "row", gap: 8, marginBottom: 20 },
  summaryCard: { 
    flex: 1, 
    minWidth: 0, 
    padding: 5, 
    borderRadius: 16, 
    alignItems: "center" 
  },
  summaryValue: { fontSize: 20, },
  summaryLabel: { fontSize: 9, marginTop: 4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    height: 45,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 15,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14 },
  filterContainer: { marginBottom: 20 },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  filterText: { fontSize: 11, },
  alertCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  alertInfo: { flex: 1 },
  alertName: { fontSize: 16, },
  alertMeta: { fontSize: 12, marginTop: 4 },
  alertStatus: { alignItems: "flex-end" },
  daysText: { fontSize: 18, },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  levelText: { fontSize: 9, },
  actionsRow: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionText: { fontSize: 11, },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    padding: 25,
    borderRadius: 25,
    alignItems: "center",
  },
  modalTitle: { fontSize: 20, marginBottom: 10 },
  modalText: { fontSize: 14, textAlign: "center", marginBottom: 20 },
  modalActions: { flexDirection: "row", gap: 10, width: "100%" },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  passwordInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 10,
    width: '100%',
  },
  passwordField: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 15,
    },
  infoCard: {
    marginTop: 12,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 14,
    letterSpacing: 0.3,
  },
  infoContent: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  infoLabel: {
    fontSize: 13,
    width: 60,
  },
  infoDesc: {
    fontSize: 12,
    flex: 1,
  },
});

