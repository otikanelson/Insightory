import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { useTheme } from "../../context/ThemeContext";

export default function TabsLayout() {
  const { theme, isDark } = useTheme();

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
            height: 68,
            paddingBottom: 10,
            paddingTop: 8,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "700",
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
            tabBarStyle: { display: "none" },
            title: "Scan",
            tabBarIcon: ({ color, focused }) => (
              <View style={{
                backgroundColor: theme.primary,
                borderRadius: 16,
                padding: 8,
                marginBottom: 4,
                shadowColor: theme.primary,
                shadowOffset: { width: 4, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 6,
              }}>
                <Ionicons name="qr-code" size={22} color="#FFF" />
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
      </Tabs>
    </View>
  );
}
