import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";

export default function TabsLayout() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.subtext,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: theme.tabSurface,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            height: 68 + insets.bottom,
            paddingBottom: 10 + insets.bottom,
            paddingTop: 8,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            letterSpacing: 0.3,
          },
          tabBarItemStyle: {
            borderRadius: 12,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? {
                backgroundColor: theme.primaryLight,
                borderRadius: 10,
                padding: 4,
              } : { padding: 4 }}>
                <Ionicons name={focused ? "grid" : "grid-outline"} size={20} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: "Inventory",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? {
                backgroundColor: theme.primaryLight,
                borderRadius: 10,
                padding: 4,
              } : { padding: 4 }}>
                <Ionicons name={focused ? "cube" : "cube-outline"} size={20} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: "Scan",
            tabBarIcon: ({ color, focused }) => (
              <View style={{
                backgroundColor: theme.primary,
                borderRadius: 18,
                padding: 10,
                marginBottom: 4,
                shadowColor: theme.primary,
                shadowOffset: { width: 4, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 6,
                width: 36,
                height: 36,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Ionicons name="scan" size={18} color="#FFF" />
              </View>
            ),
            tabBarLabel: () => null,
          }}
        />
        <Tabs.Screen
          name="add-products"
          options={{
            title: "Add",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? {
                backgroundColor: theme.primaryLight,
                borderRadius: 10,
                padding: 4,
              } : { padding: 4 }}>
                <Ionicons name={focused ? "add-circle" : "add-circle-outline"} size={20} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="FEFO"
          options={{
            title: "FEFO",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? {
                backgroundColor: theme.primaryLight,
                borderRadius: 10,
                padding: 4,
              } : { padding: 4 }}>
                <Ionicons name={focused ? "hourglass" : "hourglass-outline"} size={20} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="product-stats/[id]"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </View>
  );
}
