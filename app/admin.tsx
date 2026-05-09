import {
  View, Text, Pressable, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Platform, RefreshControl,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";

const ADMIN_ID = "admin-juanjose-klonengine-2025";
const BG = "#080808";
const SURFACE = "#111111";
const SURFACE2 = "#181818";
const ACCENT = "#4AEDC4";
const ACCENT_DIM = "rgba(74,237,196,0.12)";
const GOLD = "#E8C547";
const GOLD_DIM = "rgba(232,197,71,0.12)";
const RED = "#FF4444";
const RED_DIM = "rgba(255,68,68,0.12)";
const TEXT = "#FFFFFF";
const TEXT2 = "rgba(255,255,255,0.55)";
const TEXT3 = "rgba(255,255,255,0.25)";
const BORDER = "rgba(255,255,255,0.07)";

type Plan = "monthly" | "quarterly" | "annual" | "lifetime";
type SubStatus = "active" | "cancelled" | "expired" | "paused";

interface Subscription {
  id: string;
  userId: string;
  plan: Plan;
  status: SubStatus;
  currentPeriodEnd: string;
  createdAt: string;
  lemonSqueezyId: string;
}

interface SolanaSession {
  id: string;
  userId: string;
  plan: string;
  token: string;
  amountUsdc: string;
  status: string;
  createdAt: string;
}

interface Stats {
  activeTotal: number;
  byPlan: Record<string, number>;
  mrr: number;
  solanaConfirmed: number;
}

interface Dashboard {
  stats: Stats;
  recentSubs: Subscription[];
  recentSolana: SolanaSession[];
}

const PLAN_COLORS: Record<string, string> = {
  monthly: "#4AEDC4",
  quarterly: "#9945FF",
  annual: "#4AEDC4",
  lifetime: "#E8C547",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#4AEDC4",
  cancelled: "#FF4444",
  expired: "rgba(255,255,255,0.3)",
  paused: "#E8C547",
  confirmed: "#4AEDC4",
  pending: "#E8C547",
};

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-HN", { day: "2-digit", month: "short", year: "2-digit" });
  } catch { return "—"; }
}

function fmtMRR(n: number) {
  return `$${n.toFixed(2)}`;
}

function shortId(id: string) {
  if (!id) return "—";
  const parts = id.split("-");
  if (parts.length >= 3) return parts.slice(0, 3).join("-").substring(0, 18) + "…";
  return id.substring(0, 18) + "…";
}

type Tab = "subs" | "solana" | "grant";

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("subs");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [grantUserId, setGrantUserId] = useState("");
  const [grantPlan, setGrantPlan] = useState<Plan>("annual");
  const [granting, setGranting] = useState(false);
  const [grantResult, setGrantResult] = useState<string | null>(null);

  async function fetchDashboard() {
    try {
      const base = getApiUrl();
      const url = new URL("/api/admin/dashboard", base);
      const res = await fetch(url.toString(), {
        headers: { "x-admin-id": ADMIN_ID },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as Dashboard;
      setDashboard(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Error de conexión");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { fetchDashboard(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboard();
  }, []);

  async function handleGrant() {
    if (!grantUserId.trim()) {
      setGrantResult("❌ Ingresa un userId");
      return;
    }
    setGranting(true);
    setGrantResult(null);
    try {
      const base = getApiUrl();
      const url = new URL("/api/admin/grant-premium", base);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-id": ADMIN_ID,
        },
        body: JSON.stringify({ userId: grantUserId.trim(), plan: grantPlan }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (data.success) {
        setGrantResult(`✅ Premium ${grantPlan} otorgado`);
        setGrantUserId("");
        fetchDashboard();
      } else {
        setGrantResult(`❌ ${data.error ?? "Error"}`);
      }
    } catch (e: any) {
      setGrantResult(`❌ ${e?.message ?? "Error de red"}`);
    } finally {
      setGranting(false);
    }
  }

  const stats = dashboard?.stats;

  return (
    <View style={[styles.root, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.shieldIcon}>
            <Ionicons name="shield-checkmark" size={18} color={ACCENT} />
          </View>
          <View>
            <Text style={styles.headerTitle}>KlonOS Admin</Text>
            <Text style={styles.headerSub}>GuitarTune Pro · Panel de Control</Text>
          </View>
        </View>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={TEXT2} />
        </Pressable>
      </View>

      {loading && !dashboard ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} size="large" />
          <Text style={styles.loadingText}>Cargando dashboard…</Text>
        </View>
      ) : error && !dashboard ? (
        <View style={styles.center}>
          <Ionicons name="warning" size={32} color={RED} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchDashboard}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
          }
        >
          {/* STATS */}
          <View style={styles.statsGrid}>
            <StatCard
              label="Activos"
              value={String(stats?.activeTotal ?? 0)}
              icon="people"
              color={ACCENT}
            />
            <StatCard
              label="MRR"
              value={fmtMRR(stats?.mrr ?? 0)}
              icon="trending-up"
              color={GOLD}
            />
            <StatCard
              label="Solana"
              value={String(stats?.solanaConfirmed ?? 0)}
              icon="diamond"
              color="#9945FF"
            />
          </View>

          {/* PLAN BREAKDOWN */}
          {stats && (
            <View style={styles.planBreakdown}>
              {["monthly", "quarterly", "annual", "lifetime"].map((p) => (
                <View key={p} style={styles.planRow}>
                  <View style={[styles.planDot, { backgroundColor: PLAN_COLORS[p] ?? ACCENT }]} />
                  <Text style={styles.planLabel}>{p.toUpperCase()}</Text>
                  <Text style={[styles.planCount, { color: PLAN_COLORS[p] ?? ACCENT }]}>
                    {stats.byPlan[p] ?? 0}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* TABS */}
          <View style={styles.tabs}>
            {(["subs", "solana", "grant"] as Tab[]).map((t) => (
              <Pressable
                key={t}
                style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === "subs" ? "Suscripciones" : t === "solana" ? "Solana" : "Otorgar"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* SUBS TAB */}
          {tab === "subs" && (
            <View style={styles.listSection}>
              {(dashboard?.recentSubs ?? []).length === 0 ? (
                <Text style={styles.emptyText}>Sin suscripciones registradas</Text>
              ) : (
                (dashboard?.recentSubs ?? []).map((sub) => (
                  <SubRow key={sub.id} sub={sub} />
                ))
              )}
            </View>
          )}

          {/* SOLANA TAB */}
          {tab === "solana" && (
            <View style={styles.listSection}>
              {(dashboard?.recentSolana ?? []).length === 0 ? (
                <Text style={styles.emptyText}>Sin sesiones Solana</Text>
              ) : (
                (dashboard?.recentSolana ?? []).map((s) => (
                  <SolanaRow key={s.id} session={s} />
                ))
              )}
            </View>
          )}

          {/* GRANT TAB */}
          {tab === "grant" && (
            <View style={styles.grantSection}>
              <Text style={styles.grantTitle}>Otorgar Premium Manualmente</Text>
              <Text style={styles.grantSub}>
                Ingresa el userId del usuario (de AsyncStorage del dispositivo)
              </Text>

              <TextInput
                style={styles.input}
                value={grantUserId}
                onChangeText={setGrantUserId}
                placeholder="userId del usuario…"
                placeholderTextColor={TEXT3}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.planSelector}>
                {(["monthly", "quarterly", "annual", "lifetime"] as Plan[]).map((p) => (
                  <Pressable
                    key={p}
                    style={[
                      styles.planChip,
                      grantPlan === p && {
                        backgroundColor: PLAN_COLORS[p] + "22",
                        borderColor: PLAN_COLORS[p],
                      },
                    ]}
                    onPress={() => setGrantPlan(p)}
                  >
                    <Text style={[
                      styles.planChipText,
                      grantPlan === p && { color: PLAN_COLORS[p] },
                    ]}>
                      {p}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={[styles.grantBtn, granting && styles.grantBtnDisabled]}
                onPress={handleGrant}
                disabled={granting}
              >
                {granting ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={16} color="#000" />
                    <Text style={styles.grantBtnText}>Otorgar Premium</Text>
                  </>
                )}
              </Pressable>

              {grantResult && (
                <View style={[
                  styles.grantResult,
                  { backgroundColor: grantResult.startsWith("✅") ? ACCENT_DIM : RED_DIM },
                ]}>
                  <Text style={[
                    styles.grantResultText,
                    { color: grantResult.startsWith("✅") ? ACCENT : RED },
                  ]}>
                    {grantResult}
                  </Text>
                </View>
              )}

              <View style={styles.testBlock}>
                <Text style={styles.testTitle}>Para test de RevenueCat:</Text>
                <Text style={styles.testBody}>
                  Tu userId admin es:{"\n"}
                  <Text style={styles.testId}>{ADMIN_ID}</Text>
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function StatCard({ label, value, icon, color }: {
  label: string; value: string; icon: any; color: string;
}) {
  return (
    <View style={[styles.statCard, { borderColor: color + "33" }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SubRow({ sub }: { sub: Subscription }) {
  const statusColor = STATUS_COLORS[sub.status] ?? TEXT3;
  const planColor = PLAN_COLORS[sub.plan] ?? ACCENT;
  const isGrant = sub.lemonSqueezyId?.startsWith("admin-grant");
  const isSolana = sub.lemonSqueezyId?.startsWith("solana-");
  const isRC = sub.lemonSqueezyId?.startsWith("rc-");

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.rowTopLine}>
          <Text style={[styles.rowPlan, { color: planColor }]}>{sub.plan.toUpperCase()}</Text>
          {isGrant && <View style={styles.badge}><Text style={styles.badgeText}>ADMIN</Text></View>}
          {isSolana && <View style={[styles.badge, { borderColor: "#9945FF44", backgroundColor: "#9945FF11" }]}><Text style={[styles.badgeText, { color: "#9945FF" }]}>SOL</Text></View>}
          {isRC && <View style={[styles.badge, { borderColor: ACCENT + "44", backgroundColor: ACCENT_DIM }]}><Text style={[styles.badgeText, { color: ACCENT }]}>RC</Text></View>}
        </View>
        <Text style={styles.rowUserId} numberOfLines={1}>{shortId(sub.userId)}</Text>
        <Text style={styles.rowDate}>
          Creado {fmtDate(sub.createdAt)} · Expira {fmtDate(sub.currentPeriodEnd)}
        </Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: statusColor + "18", borderColor: statusColor + "44" }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>{sub.status}</Text>
      </View>
    </View>
  );
}

function SolanaRow({ session }: { session: SolanaSession }) {
  const statusColor = STATUS_COLORS[session.status] ?? TEXT3;
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.rowTopLine}>
          <Text style={[styles.rowPlan, { color: "#9945FF" }]}>{session.plan.toUpperCase()}</Text>
          <Text style={styles.rowToken}>{session.token.toUpperCase()}</Text>
        </View>
        <Text style={styles.rowUserId} numberOfLines={1}>{shortId(session.userId)}</Text>
        <Text style={styles.rowDate}>
          {fmtDate(session.createdAt)} · {session.amountUsdc} USDC
        </Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: statusColor + "18", borderColor: statusColor + "44" }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>{session.status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  shieldIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: ACCENT_DIM, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: ACCENT + "33",
  },
  headerTitle: { color: TEXT, fontSize: 17, fontWeight: "700" },
  headerSub: { color: TEXT3, fontSize: 11, marginTop: 1 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: SURFACE, alignItems: "center", justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: TEXT2, fontSize: 14 },
  errorText: { color: RED, fontSize: 14, textAlign: "center", marginHorizontal: 32 },
  retryBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: SURFACE, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  retryText: { color: ACCENT, fontSize: 14, fontWeight: "600" },
  scroll: { padding: 16, gap: 16 },
  statsGrid: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1, backgroundColor: SURFACE, borderRadius: 14,
    padding: 14, alignItems: "center", gap: 6,
    borderWidth: 1,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { color: TEXT3, fontSize: 11 },
  planBreakdown: {
    backgroundColor: SURFACE, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: BORDER, gap: 8,
  },
  planRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planDot: { width: 8, height: 8, borderRadius: 4 },
  planLabel: { flex: 1, color: TEXT2, fontSize: 12, fontWeight: "600" },
  planCount: { fontSize: 16, fontWeight: "700" },
  tabs: {
    flexDirection: "row", backgroundColor: SURFACE,
    borderRadius: 12, padding: 4, gap: 4,
    borderWidth: 1, borderColor: BORDER,
  },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
  tabBtnActive: { backgroundColor: ACCENT_DIM },
  tabText: { color: TEXT3, fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: ACCENT },
  listSection: { gap: 8 },
  emptyText: { color: TEXT3, fontSize: 13, textAlign: "center", paddingVertical: 24 },
  row: {
    backgroundColor: SURFACE, borderRadius: 12, padding: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: BORDER, gap: 12,
  },
  rowLeft: { flex: 1, gap: 3 },
  rowTopLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowPlan: { fontSize: 13, fontWeight: "700" },
  rowToken: { color: "#9945FF", fontSize: 11, fontWeight: "600" },
  badge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
    borderWidth: 1, borderColor: ACCENT + "44", backgroundColor: ACCENT_DIM,
  },
  badgeText: { color: ACCENT, fontSize: 9, fontWeight: "700" },
  rowUserId: { color: TEXT3, fontSize: 11, fontFamily: "monospace" },
  rowDate: { color: TEXT3, fontSize: 10 },
  statusPill: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: "700" },
  grantSection: { gap: 14 },
  grantTitle: { color: TEXT, fontSize: 16, fontWeight: "700" },
  grantSub: { color: TEXT2, fontSize: 12, lineHeight: 18 },
  input: {
    backgroundColor: SURFACE2, borderRadius: 12, padding: 14,
    color: TEXT, fontSize: 14, borderWidth: 1, borderColor: BORDER,
  },
  planSelector: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  planChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
  },
  planChipText: { color: TEXT2, fontSize: 12, fontWeight: "600" },
  grantBtn: {
    backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  grantBtnDisabled: { opacity: 0.5 },
  grantBtnText: { color: "#000", fontSize: 15, fontWeight: "700" },
  grantResult: { padding: 12, borderRadius: 10 },
  grantResultText: { fontSize: 13, fontWeight: "600" },
  testBlock: {
    backgroundColor: SURFACE, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: BORDER, gap: 6,
    marginTop: 8,
  },
  testTitle: { color: TEXT2, fontSize: 12, fontWeight: "600" },
  testBody: { color: TEXT3, fontSize: 11, lineHeight: 18 },
  testId: { color: ACCENT, fontFamily: "monospace", fontSize: 11 },
});
