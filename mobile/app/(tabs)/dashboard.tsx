import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Canvas, Path, Skia, LinearGradient, vec } from "@shopify/react-native-skia";
import { transactionApi, budgetApi } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tx {
  id: number;
  amount: number;
  category: string;
  merchant: string | null;
  transaction_date: string;
  type: "debit" | "credit";
  note: string | null;
}

interface BudgetStatus {
  budget: { id: number; category: string; limit_amount: number };
  spent: number;
  remaining: number;
  pace_percent: number;
  projected_spend: number;
  is_over_budget: boolean;
}

// ── Design tokens (inline — avoids NativeWind font+style crash on Android) ───

const T = {
  bg: "#0e1511",
  card: "#161d19",
  surface: "#1a211d",
  border: "#2f3632",
  textPrimary: "#dde4dd",
  textSecondary: "#bbcac0",
  textDim: "#85948b",
  emerald: "#5af0b3",
  gold: "#dcc66e",
  coral: "#ffb4ab",
} as const;

const F = {
  serif: "PlayfairDisplay_400Regular",
  serifMedium: "PlayfairDisplay_500Medium",
  sans: "Geist_300Light",
  sansMedium: "Geist_500Medium",
  mono: "Geist_400Regular",
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(n: number): string {
  const abs = Math.round(Math.abs(n));
  const s = String(abs);
  if (s.length <= 3) return "₹" + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return "₹" + grouped + "," + last3;
}

function toUIType(raw: string): "debit" | "credit" {
  return raw === "income" || raw === "credit" ? "credit" : "debit";
}

function monthLabel(): string {
  const d = new Date();
  const months = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE",
    "JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
  return months[d.getMonth()] + " " + d.getFullYear();
}

const CAT_COLORS = [T.emerald, T.gold, T.coral, T.textSecondary];

const CHART_H = 80;
const PAD = { t: 8, r: 4, b: 4, l: 4 };

// ── Cash-flow Skia chart ──────────────────────────────────────────────────────

function CashFlowChart({ dailyRunning, width }: { dailyRunning: number[]; width: number }) {
  const { linePath, fillPath, isEmpty } = useMemo(() => {
    if (dailyRunning.length < 2) return { linePath: null, fillPath: null, isEmpty: true };

    const W = width - PAD.l - PAD.r;
    const H = CHART_H - PAD.t - PAD.b;
    const minV = Math.min(...dailyRunning, 0);
    const maxV = Math.max(...dailyRunning, 0);
    const range = maxV - minV || 1;

    const toX = (i: number) => PAD.l + (i / (dailyRunning.length - 1)) * W;
    const toY = (v: number) => PAD.t + (1 - (v - minV) / range) * H;

    const pts = dailyRunning.map((v, i) => ({ x: toX(i), y: toY(v) }));
    const zY = toY(0);

    const lp = Skia.Path.Make();
    lp.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      lp.quadTo(pts[i].x, pts[i].y, xc, yc);
    }
    lp.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

    const fp = lp.copy();
    fp.lineTo(pts[pts.length - 1].x, Math.max(zY, PAD.t));
    fp.lineTo(pts[0].x, Math.max(zY, PAD.t));
    fp.close();

    return { linePath: lp, fillPath: fp, isEmpty: false };
  }, [dailyRunning, width]);

  return (
    <Canvas style={{ width, height: CHART_H }}>
      {!isEmpty && fillPath && (
        <Path path={fillPath} style="fill">
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, CHART_H)}
            colors={["#5af0b330", "#5af0b300"]}
          />
        </Path>
      )}
      {!isEmpty && linePath && (
        <Path
          path={linePath}
          style="stroke"
          strokeWidth={1.5}
          color={T.emerald}
          strokeCap="round"
          strokeJoin="round"
        />
      )}
    </Canvas>
  );
}

// ── Budget row ────────────────────────────────────────────────────────────────

function BudgetRow({ status }: { status: BudgetStatus }) {
  const pct = Math.min(status.pace_percent, 100);
  const barColor = status.is_over_budget ? T.coral : status.pace_percent > 80 ? T.gold : T.emerald;

  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary }}>
          {status.budget.category.toUpperCase()}
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: T.textDim }}>
          {fmtINR(status.remaining)} left
        </Text>
      </View>
      <View style={{ height: 1, backgroundColor: T.border }}>
        <View style={{ width: `${pct}%`, backgroundColor: barColor, height: 1 }} />
      </View>
    </View>
  );
}

// ── Transaction row ───────────────────────────────────────────────────────────

function TxRow({ tx }: { tx: Tx }) {
  const isDebit = tx.type === "debit";
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border }}>
      <View style={{ flex: 1, marginRight: 16 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: T.textPrimary }} numberOfLines={1}>
          {tx.merchant ?? tx.category}
        </Text>
        <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim, marginTop: 2 }}>
          {tx.category.toUpperCase()} · {tx.transaction_date.slice(5)}
        </Text>
      </View>
      <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: isDebit ? T.coral : T.emerald }}>
        {isDebit ? "−" : "+"}{fmtINR(tx.amount)}
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 40;

  const [txns, setTxns] = useState<Tx[]>([]);
  const [lastTxns, setLastTxns] = useState<Tx[]>([]);
  const [budgetStatuses, setBudgetStatuses] = useState<BudgetStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        setLoading(true);
        try {
          const now = new Date();
          const yr = now.getFullYear();
          const mo = now.getMonth() + 1;
          const lastMoDate = new Date(yr, mo - 2, 1);

          const thisStart = `${yr}-${String(mo).padStart(2, "0")}-01`;
          const thisEnd = `${yr}-${String(mo).padStart(2, "0")}-${String(new Date(yr, mo, 0).getDate()).padStart(2, "0")}`;
          const lastStart = `${lastMoDate.getFullYear()}-${String(lastMoDate.getMonth() + 1).padStart(2, "0")}-01`;
          const lastEnd = `${lastMoDate.getFullYear()}-${String(lastMoDate.getMonth() + 1).padStart(2, "0")}-${String(new Date(yr, mo - 1, 0).getDate()).padStart(2, "0")}`;

          const [txRes, lastTxRes, budgetsRes] = await Promise.all([
            transactionApi.list({ start_date: thisStart, end_date: thisEnd }),
            transactionApi.list({ start_date: lastStart, end_date: lastEnd }),
            budgetApi.list(),
          ]);

          const statuses: BudgetStatus[] = await Promise.all(
            budgetsRes.data.map((b: { id: number }) =>
              budgetApi.status(b.id).then((r: { data: BudgetStatus }) => r.data)
            )
          );

          setTxns(txRes.data.map((t: any) => ({ ...t, type: toUIType(t.type), amount: parseFloat(t.amount) })));
          setLastTxns(lastTxRes.data.map((t: any) => ({ ...t, type: toUIType(t.type), amount: parseFloat(t.amount) })));
          setBudgetStatuses(statuses);
        } catch {
          // silently fail — empty state shown
        } finally {
          setLoading(false);
        }
      }
      load();
    }, [])
  );

  const { netFlow, netDelta, dailyRunning, topCategories, recentTxns, alertBudgets } =
    useMemo(() => {
      const income = txns.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
      const expense = txns.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
      const netFlow = income - expense;

      const lastIncome = lastTxns.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
      const lastExpense = lastTxns.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
      const netDelta = netFlow - (lastIncome - lastExpense);

      const now = new Date();
      const daysToday = now.getDate();
      const yr = String(now.getFullYear());
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const dailyRunning: number[] = [];
      let running = 0;
      for (let d = 1; d <= daysToday; d++) {
        const ds = `${yr}-${mo}-${String(d).padStart(2, "0")}`;
        for (const tx of txns) {
          if (tx.transaction_date === ds) {
            running += tx.type === "credit" ? tx.amount : -tx.amount;
          }
        }
        dailyRunning.push(running);
      }

      const catMap: Record<string, number> = {};
      for (const tx of txns) {
        if (tx.type === "debit") {
          catMap[tx.category] = (catMap[tx.category] ?? 0) + tx.amount;
        }
      }
      const topCategories = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([cat, amt]) => ({ cat, amt }));

      const maxAmt = topCategories[0]?.amt ?? 1;

      const recentTxns = [...txns]
        .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
        .slice(0, 5);

      const alertBudgets = [...budgetStatuses]
        .filter((s) => s.pace_percent > 50)
        .sort((a, b) => b.pace_percent - a.pace_percent)
        .slice(0, 4);

      return { netFlow, netDelta, dailyRunning, topCategories, maxAmt, recentTxns, alertBudgets };
    }, [txns, lastTxns, budgetStatuses]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={T.emerald} />
      </SafeAreaView>
    );
  }

  const isPositive = netFlow >= 0;
  const isDeltaPositive = netDelta >= 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }}>
          <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim }}>
            HELM
          </Text>
          <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim }}>
            {monthLabel()}
          </Text>
        </View>

        {/* ── Net flow hero ────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32, borderBottomWidth: 1, borderBottomColor: T.border }}>
          <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary, marginBottom: 12 }}>
            NET FLOW
          </Text>
          <Text style={{ fontFamily: F.serif, fontSize: 36, lineHeight: 43, color: isPositive ? T.textPrimary : T.coral }}>
            {isPositive ? "" : "−"}{fmtINR(netFlow)}
          </Text>
          {lastTxns.length > 0 && (
            <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: isDeltaPositive ? T.emerald : T.coral, marginTop: 8 }}>
              {isDeltaPositive ? "+" : "−"}{fmtINR(Math.abs(netDelta))} vs last month
            </Text>
          )}
        </View>

        {/* ── Cash flow chart ──────────────────────────────────────────── */}
        <View style={{ marginHorizontal: 20, marginTop: 24, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 4, padding: 16 }}>
          <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary, marginBottom: 16 }}>
            CASH FLOW — {new Date().getDate()} DAYS
          </Text>
          {dailyRunning.length >= 2 ? (
            <CashFlowChart dailyRunning={dailyRunning} width={chartWidth - 32} />
          ) : (
            <View style={{ height: CHART_H, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: F.sans, fontSize: 11, lineHeight: 16, color: T.textDim }}>
                No data yet this month
              </Text>
            </View>
          )}
        </View>

        {/* ── Top spend categories ─────────────────────────────────────── */}
        {topCategories.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary, marginBottom: 20 }}>
              WHERE IT WENT
            </Text>
            {topCategories.map(({ cat, amt }, i) => {
              const maxAmt = topCategories[0]?.amt ?? 1;
              const pct = (amt / maxAmt) * 100;
              return (
                <View key={cat} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary }}>
                      {cat.toUpperCase()}
                    </Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: T.textPrimary }}>
                      {fmtINR(amt)}
                    </Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: T.border }}>
                    <View style={{ width: `${pct}%`, backgroundColor: CAT_COLORS[i % CAT_COLORS.length], height: 1 }} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Budget alerts ────────────────────────────────────────────── */}
        {alertBudgets.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary, marginBottom: 20 }}>
              BUDGET PACE
            </Text>
            {alertBudgets.map((s) => (
              <BudgetRow key={s.budget.id} status={s} />
            ))}
          </View>
        )}

        {/* ── Recent transactions ──────────────────────────────────────── */}
        {recentTxns.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary, marginBottom: 4 }}>
              RECENT ACTIVITY
            </Text>
            {recentTxns.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </View>
        )}

        {/* ── Empty state ──────────────────────────────────────────────── */}
        {txns.length === 0 && (
          <View style={{ paddingHorizontal: 20, marginTop: 80, alignItems: "center" }}>
            <Text style={{ fontFamily: F.serif, fontSize: 24, lineHeight: 31, color: T.textPrimary, marginBottom: 12, textAlign: "center" }}>
              No activity yet
            </Text>
            <Text style={{ fontFamily: F.sans, fontSize: 16, lineHeight: 24, color: T.textSecondary, textAlign: "center" }}>
              Add your first transaction or import a bank statement to get started.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
