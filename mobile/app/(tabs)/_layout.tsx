import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ color: focused ? "#6C63FF" : "#8888A0", fontSize: 10, marginTop: 2 }}>
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#13131A",
          borderTopColor: "#2A2A3A",
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: "#6C63FF",
        tabBarInactiveTintColor: "#8888A0",
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ focused }) => <TabIcon label="💬" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ focused }) => <TabIcon label="💳" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: "Budgets",
          tabBarIcon: ({ focused }) => <TabIcon label="📊" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="simulate"
        options={{
          title: "Simulate",
          tabBarIcon: ({ focused }) => <TabIcon label="🎯" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ focused }) => <TabIcon label="💡" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
