import { useState, useCallback } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { T, F, fmtINR } from "@/lib/design";

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
  const [result, setResult] = useState<SimResult>(() => calcResult(5000, 1000, 100000));

  function calcResult(cs: number, si: number, ga: number): SimResult {
    const newSavings = cs + si;
    return {
      months_to_goal_current: cs > 0 ? ga / cs : null,
      months_to_goal_new: newSavings > 0 ? ga / newSavings : null,
      months_saved: cs > 0 && newSavings > 0 ? ga / cs - ga / newSavings : null,
      increased_monthly_savings: newSavings,
    };
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border }}>
        <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim }}>
          SIMULATE
        </Text>
        <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: T.textSecondary, marginTop: 4 }}>
          Adjust sliders to see the impact instantly
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <SliderCard
          label="CURRENT MONTHLY SAVINGS"
          value={currentSavings}
          displayValue={fmtINR(currentSavings)}
          min={0}
          max={50000}
          step={500}
          onChange={(v) => {
            setCurrentSavings(v);
            setResult(calcResult(v, savingsIncrease, goalAmount));
          }}
        />

        <SliderCard
          label="EXTRA SAVINGS PER MONTH"
          value={savingsIncrease}
          displayValue={"+" + fmtINR(savingsIncrease)}
          min={0}
          max={20000}
          step={500}
          onChange={(v) => {
            setSavingsIncrease(v);
            setResult(calcResult(currentSavings, v, goalAmount));
          }}
        />

        <SliderCard
          label="SAVINGS GOAL"
          value={goalAmount}
          displayValue={fmtINR(goalAmount)}
          min={10000}
          max={1000000}
          step={10000}
          onChange={(v) => {
            setGoalAmount(v);
            setResult(calcResult(currentSavings, savingsIncrease, v));
          }}
        />

        {/* Projection card */}
        <View style={{ backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 4, padding: 20, marginTop: 8 }}>
          <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary, marginBottom: 20 }}>
            PROJECTION
          </Text>

          <ProjectionRow
            label="At current pace"
            value={result.months_to_goal_current != null
              ? `${result.months_to_goal_current.toFixed(1)} mo`
              : "—"}
          />
          <ProjectionRow
            label={`Saving ${fmtINR(result.increased_monthly_savings)}/mo`}
            value={result.months_to_goal_new != null
              ? `${result.months_to_goal_new.toFixed(1)} mo`
              : "—"}
            accent
          />

          {result.months_saved != null && result.months_saved > 0 && (
            <View style={{ marginTop: 16, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 4, padding: 12 }}>
              <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.emerald, textAlign: "center" }}>
                REACH YOUR GOAL {result.months_saved.toFixed(1)} MONTHS SOONER
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SliderCard({
  label,
  value,
  displayValue,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={{ backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 4, padding: 16, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary }}>
          {label}
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 16, lineHeight: 22, color: T.textPrimary }}>
          {displayValue}
        </Text>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={T.emerald}
        maximumTrackTintColor={T.border}
        thumbTintColor={T.emerald}
      />
    </View>
  );
}

function ProjectionRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: T.textSecondary }}>
        {label}
      </Text>
      <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: accent ? T.emerald : T.textPrimary }}>
        {value}
      </Text>
    </View>
  );
}
