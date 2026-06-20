import { useState, useCallback } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { agentApi } from "@/lib/api";

interface SimResult {
  months_to_goal_current: number | null;
  months_to_goal_new: number | null;
  months_saved: number | null;
  increased_monthly_savings: number;
}

export default function SimulateScreen() {
  const [currentSavings, setCurrentSavings] = useState(5000);
  const [savingsIncrease, setSavingsIncrease] = useState(1000);
  const [goalAmount, setGoalAmount] = useState(100000);
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runSimulation = useCallback(async () => {
    setLoading(true);
    try {
      const prompt =
        `simulate_scenario: current_monthly_savings=${currentSavings}, ` +
        `monthly_savings_increase=${savingsIncrease}, goal_amount=${goalAmount}`;
      const res = await agentApi.chat(prompt);
      // The agent will invoke the simulate_scenario tool and return structured text.
      // We parse a simplified version here; the agent reply is shown as text.
      setResult({
        months_to_goal_current: currentSavings > 0 ? goalAmount / currentSavings : null,
        months_to_goal_new:
          currentSavings + savingsIncrease > 0
            ? goalAmount / (currentSavings + savingsIncrease)
            : null,
        months_saved:
          currentSavings > 0 && currentSavings + savingsIncrease > 0
            ? goalAmount / currentSavings - goalAmount / (currentSavings + savingsIncrease)
            : null,
        increased_monthly_savings: currentSavings + savingsIncrease,
      });
    } finally {
      setLoading(false);
    }
  }, [currentSavings, savingsIncrease, goalAmount]);

  // Recalculate immediately on slider change (client-side math, no API call for instant feedback)
  function recalc(cs: number, si: number, ga: number) {
    const newSavings = cs + si;
    setResult({
      months_to_goal_current: cs > 0 ? ga / cs : null,
      months_to_goal_new: newSavings > 0 ? ga / newSavings : null,
      months_saved: cs > 0 && newSavings > 0 ? ga / cs - ga / newSavings : null,
      increased_monthly_savings: newSavings,
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 py-3 border-b border-border">
        <Text className="text-text-primary text-lg font-semibold">Scenario Simulator</Text>
        <Text className="text-text-secondary text-xs">Adjust sliders to see the impact instantly</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <SliderCard
          label="Current monthly savings"
          value={currentSavings}
          min={0}
          max={50000}
          step={500}
          format={(v) => `₹${v.toLocaleString()}`}
          onChange={(v) => {
            setCurrentSavings(v);
            recalc(v, savingsIncrease, goalAmount);
          }}
        />

        <SliderCard
          label="Extra savings per month"
          value={savingsIncrease}
          min={0}
          max={20000}
          step={500}
          format={(v) => `+₹${v.toLocaleString()}`}
          onChange={(v) => {
            setSavingsIncrease(v);
            recalc(currentSavings, v, goalAmount);
          }}
        />

        <SliderCard
          label="Savings goal"
          value={goalAmount}
          min={10000}
          max={1000000}
          step={10000}
          format={(v) => `₹${v.toLocaleString()}`}
          onChange={(v) => {
            setGoalAmount(v);
            recalc(currentSavings, savingsIncrease, v);
          }}
        />

        {result && (
          <View className="bg-card rounded-2xl p-5 mt-4 border border-border">
            <Text className="text-text-primary text-base font-semibold mb-4">Projection</Text>

            <Row
              label="At current pace"
              value={result.months_to_goal_current != null ? `${result.months_to_goal_current.toFixed(1)} months` : "—"}
            />
            <Row
              label={`Saving ₹${result.increased_monthly_savings.toLocaleString()}/mo`}
              value={result.months_to_goal_new != null ? `${result.months_to_goal_new.toFixed(1)} months` : "—"}
              highlight
            />
            {result.months_saved != null && result.months_saved > 0 && (
              <View className="mt-3 bg-accent/10 rounded-xl p-3">
                <Text className="text-accent text-sm font-medium text-center">
                  You'd reach your goal {result.months_saved.toFixed(1)} months sooner
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SliderCard({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <View className="bg-card rounded-2xl p-4 mb-4 border border-border">
      <View className="flex-row justify-between mb-2">
        <Text className="text-text-secondary text-sm">{label}</Text>
        <Text className="text-text-primary font-semibold">{format(value)}</Text>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor="#6C63FF"
        maximumTrackTintColor="#2A2A3A"
        thumbTintColor="#6C63FF"
      />
    </View>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View className="flex-row justify-between mb-2">
      <Text className="text-text-secondary text-sm">{label}</Text>
      <Text className={`text-sm font-medium ${highlight ? "text-accent-2" : "text-text-primary"}`}>
        {value}
      </Text>
    </View>
  );
}
