"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  LogOut, AlertTriangle, Home, Building2, PlusCircle, BarChart3,
  Wallet, Receipt, FileText, Settings as SettingsIcon, Printer,
  ChevronRight, Loader2, X, CheckCircle2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// SUPABASE CLIENT
// These are the project's PUBLIC anon credentials — safe to ship to the
// browser. All real access control is enforced by Supabase Row Level
// Security policies (see supabase-setup.sql), never by this key.
// ---------------------------------------------------------------------------
const SUPABASE_URL = "https://ymnawctbngyfbfgozomu.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltbmF3Y3Ribmd5ZmJmZ296b211Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNTMzOTcsImV4cCI6MjEwMzkyOTM5N30.pdWVE9iL2YVGWC2d2EIbl5KsmBOQYfUa8xKXMn0h2Kw";

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
type Role = "admin" | "staff";
type Profile = { id: string; email: string; full_name: string | null; role: Role };
type Property = { id: string; name: string };
type Asset = { id: string; property_id: string; category: "commercial" | "residential"; name: string };
type RoomType = { id: string; name: string; monthly_rent: number };
type Unit = {
  id: string; asset_id: string; unit_type: "commercial_unit" | "house" | "bed";
  name: string; floor: string | null; room: string | null; room_type_id: string | null;
  monthly_rent: number; status: "occupied" | "vacant" | "reserved" | "maintenance";
};
type Tenant = { id: string; unit_id: string | null; name: string; phone: string | null; is_active: boolean };
type Category = { id: string; name: string };
type RentRow = {
  unit_id: string; unit_name: string; unit_type: string; unit_status: string;
  monthly_rent: number; asset_id: string; asset_name: string; category: string;
  property_name: string; tenant_id: string | null; tenant_name: string | null;
  rent_month: string; amount_received: number; rent_status: "PAID" | "PENDING" | "OVERDUE" | "VACANT";
};

const money = (n: number) =>
  "PKR " + Math.round(n || 0).toLocaleString("en-PK");

const monthStart = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);

function useToast() {
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const show = (text: string, kind: "ok" | "err" = "ok") => {
    setMsg({ text, kind });
    setTimeout(() => setMsg(null), 3500);
  };
  return { msg, show };
}

// ---------------------------------------------------------------------------
// ROOT
// ---------------------------------------------------------------------------
export default function Page() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setProfile(data as Profile);
      setLoading(false);
    })();
  }, [session]);

  if (!session) return <Login />;
  if (loading) return <FullscreenLoader />;
  if (!profile) return <FullscreenLoader label="Setting up your account..." />;

  return profile.role === "admin" ? <AdminApp profile={profile} /> : <StaffApp profile={profile} />;
}

function FullscreenLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-gray-400">
      <Loader2 className="animate-spin mr-2" size={18} /> {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------------------
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-xs tracking-widest text-[var(--gold)] mb-2">KHURRAM &amp; JAMAAL</div>
          <h1 className="text-2xl font-semibold text-white">K&amp;J CHESHTI PROPERTIES</h1>
          <p className="text-gray-400 text-sm mt-1">Property &amp; Financial Management System</p>
        </div>
        <form onSubmit={submit} className="bg-[#111] border border-[#2a2a2a] rounded-lg p-6 space-y-4">
          {err && (
            <div className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded px-3 py-2">{err}</div>
          )}
          <div>
            <label className="text-xs text-gray-400">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required
              className="w-full mt-1 bg-black border border-[#2a2a2a] rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--gold)]" />
          </div>
          <div>
            <label className="text-xs text-gray-400">Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required
              className="w-full mt-1 bg-black border border-[#2a2a2a] rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--gold)]" />
          </div>
          <button disabled={busy} type="submit"
            className="w-full bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black font-medium rounded py-2 text-sm disabled:opacity-60 flex items-center justify-center gap-2">
            {busy && <Loader2 className="animate-spin" size={16} />} Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SHARED SHELL
// ---------------------------------------------------------------------------
function Shell({ profile, tabs, active, setActive, children }: any) {
  return (
    <div className="min-h-screen bg-black text-white flex">
      <aside className="w-56 shrink-0 border-r border-[#1f1f1f] bg-[#0c0c0c] hidden md:flex flex-col no-print">
        <div className="p-5 border-b border-[#1f1f1f]">
          <div className="text-[10px] tracking-widest text-[var(--gold)]">KHURRAM &amp; JAMAAL</div>
          <div className="font-semibold text-sm mt-1">K&amp;J CHESHTI</div>
          <div className="text-[11px] text-gray-500">{profile.role === "admin" ? "Administrator" : "Staff"}</div>
        </div>
        <nav className="flex-1 py-3">
          {tabs.map((t: any) => (
            <button key={t.key} onClick={() => setActive(t.key)}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left ${
                active === t.key ? "bg-[#1a1a1a] text-[var(--gold)] border-r-2 border-[var(--gold)]" : "text-gray-400 hover:text-white hover:bg-[#141414]"
              }`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </nav>
        <button onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-2 px-5 py-4 text-sm text-gray-400 hover:text-red-400 border-t border-[#1f1f1f]">
          <LogOut size={16} /> Logout
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f] no-print">
          <span className="font-semibold text-sm text-[var(--gold)]">K&amp;J CHESHTI</span>
          <button onClick={() => supabase.auth.signOut()}><LogOut size={18} className="text-gray-400" /></button>
        </div>
        <div className="md:hidden flex overflow-x-auto border-b border-[#1f1f1f] no-print">
          {tabs.map((t: any) => (
            <button key={t.key} onClick={() => setActive(t.key)}
              className={`px-4 py-2.5 text-xs whitespace-nowrap ${active === t.key ? "text-[var(--gold)] border-b-2 border-[var(--gold)]" : "text-gray-500"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function Card({ label, value, tone = "gold" }: { label: string; value: string; tone?: "gold" | "green" | "red" | "gray" }) {
  const toneClass = { gold: "text-[var(--gold-bright)]", green: "text-green-400", red: "text-red-400", gray: "text-gray-300" }[tone];
  return (
    <div className="bg-[#111] border border-[#232323] rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: "bg-green-950 text-green-400 border-green-900",
    PENDING: "bg-yellow-950 text-yellow-400 border-yellow-900",
    OVERDUE: "bg-red-950 text-red-400 border-red-900",
    VACANT: "bg-gray-900 text-gray-400 border-gray-800",
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded border ${map[status] || map.VACANT}`}>{status}</span>;
}

function Toast({ msg }: { msg: { text: string; kind: "ok" | "err" } | null }) {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded shadow-lg text-sm flex items-center gap-2 no-print ${
      msg.kind === "ok" ? "bg-green-900 text-green-200 border border-green-700" : "bg-red-900 text-red-200 border border-red-700"
    }`}>
      {msg.kind === "ok" ? <CheckCircle2 size={16} /> : <X size={16} />} {msg.text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SHARED DATA HOOK
// ---------------------------------------------------------------------------
function useCoreData() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [incomeCats, setIncomeCats] = useState<Category[]>([]);
  const [expenseCats, setExpenseCats] = useState<Category[]>([]);
  const [rentStatus, setRentStatus] = useState<RentRow[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const [p, a, u, rt, ic, ec, rs] = await Promise.all([
      supabase.from("properties").select("*").order("name"),
      supabase.from("assets").select("*").order("name"),
      supabase.from("units").select("*").order("name"),
      supabase.from("room_types").select("*").order("monthly_rent"),
      supabase.from("income_categories").select("*").order("name"),
      supabase.from("expense_categories").select("*").order("name"),
      supabase.from("v_current_rent_status").select("*"),
    ]);
    setProperties(p.data || []);
    setAssets(a.data || []);
    setUnits(u.data || []);
    setRoomTypes(rt.data || []);
    setIncomeCats(ic.data || []);
    setExpenseCats(ec.data || []);
    setRentStatus((rs.data as any) || []);
    setReady(true);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { properties, assets, units, roomTypes, incomeCats, expenseCats, rentStatus, ready, reload };
}

// ---------------------------------------------------------------------------
// STAFF APP
// ---------------------------------------------------------------------------
function StaffApp({ profile }: { profile: Profile }) {
  const [active, setActive] = useState("dashboard");
  const core = useCoreData();
  const { msg, show } = useToast();
  const [myEntries, setMyEntries] = useState<any[]>([]);

  const loadMine = useCallback(async () => {
    const since = new Date(); since.setDate(since.getDate() - 14);
    const sinceStr = since.toISOString().slice(0, 10);
    const [r, i, e] = await Promise.all([
      supabase.from("rent_payments").select("*, units(name)").eq("created_by", profile.id).gte("payment_date", sinceStr).order("created_at", { ascending: false }),
      supabase.from("income_transactions").select("*, assets(name), income_categories(name)").eq("created_by", profile.id).gte("txn_date", sinceStr).order("created_at", { ascending: false }),
      supabase.from("expense_transactions").select("*, assets(name), expense_categories(name)").eq("created_by", profile.id).gte("txn_date", sinceStr).order("created_at", { ascending: false }),
    ]);
    const rows = [
      ...(r.data || []).map((x: any) => ({ kind: "Rental Income", label: x.units?.name, amount: x.amount, date: x.payment_date, created_at: x.created_at })),
      ...(i.data || []).map((x: any) => ({ kind: "Other Income", label: `${x.assets?.name} — ${x.income_categories?.name}`, amount: x.amount, date: x.txn_date, created_at: x.created_at })),
      ...(e.data || []).map((x: any) => ({ kind: "Expense", label: `${x.assets?.name} — ${x.expense_categories?.name}`, amount: x.amount, date: x.txn_date, created_at: x.created_at })),
    ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    setMyEntries(rows);
  }, [profile.id]);

  useEffect(() => { loadMine(); }, [loadMine, active]);

  const overdue = core.rentStatus.filter((r) => r.rent_status === "OVERDUE");

  const tabs = [
    { key: "dashboard", label: "Dashboard", icon: Home },
    { key: "rental", label: "Rental Income", icon: Wallet },
    { key: "other", label: "Other Income", icon: PlusCircle },
    { key: "expense", label: "Expense", icon: Receipt },
    { key: "mine", label: "My Entries", icon: FileText },
  ];

  return (
    <Shell profile={profile} tabs={tabs} active={active} setActive={setActive}>
      <Toast msg={msg} />
      {active === "dashboard" && (
        <div className="space-y-6">
          <h1 className="text-lg font-semibold">Welcome, {profile.full_name || profile.email}</h1>
          {overdue.length > 0 && (
            <div className="bg-red-950/50 border border-red-900 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-400 font-medium text-sm">
                <AlertTriangle size={16} /> RENT PAYMENTS OVERDUE
              </div>
              <div className="text-red-300 text-sm mt-1">{overdue.length} rental payment(s) have passed the 5-day grace period.</div>
              <div className="mt-2 space-y-1 text-xs text-red-300/80">
                {overdue.slice(0, 5).map((r) => <div key={r.unit_id}>{r.property_name} — {r.unit_name}</div>)}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button onClick={() => setActive("rental")} className="bg-[#111] border border-[#232323] hover:border-[var(--gold)] rounded-lg p-5 text-left">
              <Wallet className="text-[var(--gold)] mb-2" size={20} /><div className="font-medium text-sm">+ Rental Income</div>
            </button>
            <button onClick={() => setActive("other")} className="bg-[#111] border border-[#232323] hover:border-[var(--gold)] rounded-lg p-5 text-left">
              <PlusCircle className="text-[var(--gold)] mb-2" size={20} /><div className="font-medium text-sm">+ Other Income</div>
            </button>
            <button onClick={() => setActive("expense")} className="bg-[#111] border border-[#232323] hover:border-[var(--gold)] rounded-lg p-5 text-left">
              <Receipt className="text-[var(--gold)] mb-2" size={20} /><div className="font-medium text-sm">+ Expense</div>
            </button>
          </div>
          <div>
            <h2 className="text-sm text-gray-400 mb-2">Your recent entries (last 14 days)</h2>
            <EntriesTable rows={myEntries.slice(0, 10)} />
          </div>
        </div>
      )}
      {active === "rental" && <RentalEntryForm core={core} profile={profile} onDone={() => { show("Rental payment recorded."); core.reload(); }} />}
      {active === "other" && <OtherIncomeForm core={core} profile={profile} onDone={() => { show("Other income recorded."); core.reload(); }} />}
      {active === "expense" && <ExpenseForm core={core} profile={profile} onDone={() => { show("Expense recorded."); core.reload(); }} />}
      {active === "mine" && (
        <div>
          <h1 className="text-lg font-semibold mb-4">My Entries — Last 14 Days</h1>
          <EntriesTable rows={myEntries} />
        </div>
      )}
    </Shell>
  );
}

function EntriesTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <div className="text-sm text-gray-500 bg-[#111] border border-[#232323] rounded-lg p-6 text-center">No transactions recorded yet.</div>;
  return (
    <div className="overflow-x-auto bg-[#111] border border-[#232323] rounded-lg">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-gray-500 text-xs border-b border-[#232323]">
          <th className="p-3">Type</th><th className="p-3">Detail</th><th className="p-3">Date</th><th className="p-3 text-right">Amount</th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[#1a1a1a] last:border-0">
              <td className="p-3 text-gray-400">{r.kind}</td>
              <td className="p-3">{r.label}</td>
              <td className="p-3 text-gray-400">{r.date}</td>
              <td className="p-3 text-right text-[var(--gold-bright)]">{money(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RENTAL ENTRY FORM (cascading dropdowns; supports commercial/house/bed units)
// ---------------------------------------------------------------------------
function RentalEntryForm({ core, profile, onDone }: any) {
  const [assetId, setAssetId] = useState("");
  const [floor, setFloor] = useState("");
  const [room, setRoom] = useState("");
  const [unitId, setUnitId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [month, setMonth] = useState(monthStart());
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const assetUnits = core.units.filter((u: Unit) => u.asset_id === assetId);
  const isBedAsset = assetUnits.some((u: Unit) => u.unit_type === "bed");
  const floors = [...new Set(assetUnits.filter((u: Unit) => u.unit_type === "bed").map((u: Unit) => u.floor))].filter(Boolean);
  const rooms = [...new Set(assetUnits.filter((u: Unit) => u.unit_type === "bed" && u.floor === floor).map((u: Unit) => u.room))].filter(Boolean);
  const beds = assetUnits.filter((u: Unit) => u.unit_type === "bed" && u.floor === floor && u.room === room);
  const nonBedUnits = assetUnits.filter((u: Unit) => u.unit_type !== "bed");

  const selectedUnit: Unit | undefined = core.units.find((u: Unit) => u.id === unitId);
  const roomType = selectedUnit?.room_type_id ? core.roomTypes.find((rt: RoomType) => rt.id === selectedUnit.room_type_id) : null;

  useEffect(() => {
    if (selectedUnit) setAmount(String(selectedUnit.monthly_rent));
  }, [unitId]); // eslint-disable-line

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!unitId) { setErr("Please select a unit."); return; }
    if (!amount || Number(amount) <= 0) { setErr("Amount must be positive."); return; }
    setBusy(true);
    let tenantId: string | null = null;
    if (tenantName.trim()) {
      const { data: existing } = await supabase.from("tenants").select("id").eq("unit_id", unitId).eq("name", tenantName.trim()).maybeSingle();
      if (existing) tenantId = existing.id;
      else {
        const { data: t, error: tErr } = await supabase.from("tenants").insert({ unit_id: unitId, name: tenantName.trim() }).select().single();
        if (tErr) { setErr(tErr.message); setBusy(false); return; }
        tenantId = t.id;
      }
    }
    const { error } = await supabase.from("rent_payments").insert({
      unit_id: unitId, tenant_id: tenantId, rent_month: month, amount: Number(amount),
      payment_method: method, payment_date: payDate, notes: notes || null, created_by: profile.id,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setUnitId(""); setTenantName(""); setAmount(""); setNotes("");
    onDone();
  };

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4">
      <h1 className="text-lg font-semibold mb-2">Rental Income</h1>
      {err && <div className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded px-3 py-2">{err}</div>}
      <Field label="Asset">
        <select value={assetId} onChange={(e) => { setAssetId(e.target.value); setFloor(""); setRoom(""); setUnitId(""); }} required className={selectClass}>
          <option value="">Select asset...</option>
          {core.assets.filter((a: Asset) => a.category === "residential" || core.units.some((u: Unit) => u.asset_id === a.id && u.unit_type === "commercial_unit")).map((a: Asset) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </Field>

      {isBedAsset && (
        <>
          <Field label="Floor">
            <select value={floor} onChange={(e) => { setFloor(e.target.value); setRoom(""); setUnitId(""); }} required className={selectClass}>
              <option value="">Select floor...</option>
              {floors.map((f: any) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          {floor && (
            <Field label="Room">
              <select value={room} onChange={(e) => { setRoom(e.target.value); setUnitId(""); }} required className={selectClass}>
                <option value="">Select room...</option>
                {rooms.map((r: any) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          )}
          {room && (
            <Field label="Bed">
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)} required className={selectClass}>
                <option value="">Select bed...</option>
                {beds.map((b: Unit) => {
                  const rt = core.roomTypes.find((rt: RoomType) => rt.id === b.room_type_id);
                  return <option key={b.id} value={b.id} disabled={b.status !== "occupied"}>
                    {b.name} — {rt?.name} ({b.status})
                  </option>;
                })}
              </select>
            </Field>
          )}
        </>
      )}

      {assetId && !isBedAsset && (
        <Field label="Unit">
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} required className={selectClass}>
            <option value="">Select unit...</option>
            {nonBedUnits.map((u: Unit) => <option key={u.id} value={u.id} disabled={u.status !== "occupied"}>{u.name} — {money(u.monthly_rent)} ({u.status})</option>)}
          </select>
        </Field>
      )}

      {selectedUnit && (
        <div className="text-xs text-gray-400 bg-[#111] border border-[#232323] rounded px-3 py-2">
          Configured rent: <span className="text-[var(--gold-bright)]">{money(selectedUnit.monthly_rent)}</span>{roomType ? ` (${roomType.name})` : ""}
        </div>
      )}

      <Field label="Tenant (optional if already on file)">
        <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} className={inputClass} placeholder="Tenant name" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount Received"><input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" step="0.01" required className={inputClass} /></Field>
        <Field label="Payment Method">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={selectClass}>
            <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rent Month"><input value={month} onChange={(e) => setMonth(e.target.value)} type="date" required className={inputClass} /></Field>
        <Field label="Payment Date"><input value={payDate} onChange={(e) => setPayDate(e.target.value)} type="date" required className={inputClass} /></Field>
      </div>
      <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} rows={2} /></Field>
      <SubmitBtn busy={busy} label="Record Rent Payment" />
    </form>
  );
}

function OtherIncomeForm({ core, profile, onDone }: any) {
  const [assetId, setAssetId] = useState("");
  const [catId, setCatId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!assetId || !catId) { setErr("Asset and category are required."); return; }
    if (!amount || Number(amount) <= 0) { setErr("Amount must be positive."); return; }
    setBusy(true);
    const { error } = await supabase.from("income_transactions").insert({
      asset_id: assetId, category_id: catId, amount: Number(amount), payment_method: method,
      txn_date: date, description: desc || null, created_by: profile.id,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setAssetId(""); setCatId(""); setAmount(""); setDesc("");
    onDone();
  };

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4">
      <h1 className="text-lg font-semibold mb-2">Other Income</h1>
      {err && <div className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded px-3 py-2">{err}</div>}
      <Field label="Asset">
        <select value={assetId} onChange={(e) => setAssetId(e.target.value)} required className={selectClass}>
          <option value="">Select asset...</option>
          {core.assets.map((a: Asset) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="Income Category">
        <select value={catId} onChange={(e) => setCatId(e.target.value)} required className={selectClass}>
          <option value="">Select category...</option>
          {core.incomeCats.map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount"><input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" step="0.01" required className={inputClass} /></Field>
        <Field label="Payment Method">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={selectClass}>
            <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option>
          </select>
        </Field>
      </div>
      <Field label="Date"><input value={date} onChange={(e) => setDate(e.target.value)} type="date" required className={inputClass} /></Field>
      <Field label="Description"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} rows={2} /></Field>
      <SubmitBtn busy={busy} label="Record Other Income" />
    </form>
  );
}

function ExpenseForm({ core, profile, onDone }: any) {
  const [assetId, setAssetId] = useState("");
  const [catId, setCatId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidTo, setPaidTo] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!assetId || !catId) { setErr("Asset and category are required."); return; }
    if (!amount || Number(amount) <= 0) { setErr("Amount must be positive."); return; }
    setBusy(true);
    let receiptPath: string | null = null;
    if (file) {
      const path = `${profile.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, file);
      if (upErr) { setErr("Receipt upload failed: " + upErr.message); setBusy(false); return; }
      receiptPath = path;
    }
    const { error } = await supabase.from("expense_transactions").insert({
      asset_id: assetId, category_id: catId, amount: Number(amount), payment_method: method,
      txn_date: date, paid_to: paidTo || null, description: desc || null,
      receipt_path: receiptPath, created_by: profile.id,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setAssetId(""); setCatId(""); setAmount(""); setPaidTo(""); setDesc(""); setFile(null);
    onDone();
  };

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4">
      <h1 className="text-lg font-semibold mb-2">Expense</h1>
      {err && <div className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded px-3 py-2">{err}</div>}
      <Field label="Asset">
        <select value={assetId} onChange={(e) => setAssetId(e.target.value)} required className={selectClass}>
          <option value="">Select asset...</option>
          {core.assets.map((a: Asset) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="Expense Category">
        <select value={catId} onChange={(e) => setCatId(e.target.value)} required className={selectClass}>
          <option value="">Select category...</option>
          {core.expenseCats.map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount"><input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" step="0.01" required className={inputClass} /></Field>
        <Field label="Payment Method">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={selectClass}>
            <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option>
          </select>
        </Field>
      </div>
      <Field label="Date"><input value={date} onChange={(e) => setDate(e.target.value)} type="date" required className={inputClass} /></Field>
      <Field label="Paid To / Vendor"><input value={paidTo} onChange={(e) => setPaidTo(e.target.value)} className={inputClass} /></Field>
      <Field label="Description"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} rows={2} /></Field>
      <Field label="Receipt / Invoice (optional)">
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm text-gray-400" />
      </Field>
      <SubmitBtn busy={busy} label="Record Expense" />
    </form>
  );
}

const inputClass = "w-full bg-black border border-[#2a2a2a] rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--gold)]";
const selectClass = inputClass;
function Field({ label, children }: any) {
  return <div><label className="text-xs text-gray-400 block mb-1">{label}</label>{children}</div>;
}
function SubmitBtn({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button disabled={busy} type="submit" className="w-full bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-black font-medium rounded py-2.5 text-sm disabled:opacity-60 flex items-center justify-center gap-2">
      {busy && <Loader2 className="animate-spin" size={16} />} {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ADMIN APP
// ---------------------------------------------------------------------------
function AdminApp({ profile }: { profile: Profile }) {
  const [active, setActive] = useState("dashboard");
  const core = useCoreData();
  const { msg, show } = useToast();

  const tabs = [
    { key: "dashboard", label: "Dashboard", icon: Home },
    { key: "residential", label: "Residential", icon: Building2 },
    { key: "commercial", label: "Commercial", icon: Building2 },
    { key: "rent", label: "Rent Management", icon: Wallet },
    { key: "income", label: "Income", icon: PlusCircle },
    { key: "expenses", label: "Expenses", icon: Receipt },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "reports", label: "Reports", icon: FileText },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <Shell profile={profile} tabs={tabs} active={active} setActive={setActive}>
      <Toast msg={msg} />
      {active === "dashboard" && <AdminDashboard core={core} setActive={setActive} />}
      {active === "residential" && <AssetsBrowser core={core} category="residential" />}
      {active === "commercial" && <AssetsBrowser core={core} category="commercial" />}
      {active === "rent" && <RentManagement core={core} />}
      {active === "income" && <IncomeView core={core} />}
      {active === "expenses" && <ExpensesView core={core} />}
      {active === "analytics" && <AnalyticsView core={core} />}
      {active === "reports" && <ReportsView core={core} />}
      {active === "settings" && <SettingsView core={core} show={show} />}
    </Shell>
  );
}

function AdminDashboard({ core, setActive }: any) {
  const overdue = core.rentStatus.filter((r: RentRow) => r.rent_status === "OVERDUE");
  const expectedRent = core.rentStatus.filter((r: RentRow) => r.unit_status === "occupied").reduce((s: number, r: RentRow) => s + Number(r.monthly_rent), 0);
  const rentReceived = core.rentStatus.reduce((s: number, r: RentRow) => s + Number(r.amount_received), 0);
  const outstanding = Math.max(0, expectedRent - rentReceived);

  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  useEffect(() => {
    (async () => {
      const start = monthStart();
      const [i, e] = await Promise.all([
        supabase.from("income_transactions").select("amount").eq("voided", false).gte("txn_date", start),
        supabase.from("expense_transactions").select("amount").eq("voided", false).gte("txn_date", start),
      ]);
      setIncome((i.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0));
      setExpenses((e.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0));
    })();
  }, []);

  const netProfit = rentReceived + income - expenses;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Dashboard — {new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}</h1>
      {overdue.length > 0 && (
        <button onClick={() => setActive("rent")} className="w-full text-left bg-red-950/50 border border-red-900 rounded-lg p-4 hover:border-red-700">
          <div className="flex items-center gap-2 text-red-400 font-medium text-sm"><AlertTriangle size={16} /> RENT PAYMENTS OVERDUE</div>
          <div className="text-red-300 text-sm mt-1">{overdue.length} rental payment(s) have passed the 5-day grace period.</div>
        </button>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card label="Expected Monthly Rent" value={money(expectedRent)} />
        <Card label="Rent Received" value={money(rentReceived)} tone="green" />
        <Card label="Rent Outstanding" value={money(outstanding)} tone="red" />
        <Card label="Other Income" value={money(income)} />
        <Card label="Total Expenses" value={money(expenses)} tone="red" />
        <Card label="Net Profit" value={money(netProfit)} tone={netProfit >= 0 ? "green" : "red"} />
      </div>
    </div>
  );
}

function AssetsBrowser({ core, category }: { core: any; category: "commercial" | "residential" }) {
  const assets = core.assets.filter((a: Asset) => a.category === category);
  const [selected, setSelected] = useState<string>("");
  useEffect(() => { if (assets.length && !selected) setSelected(assets[0].id); }, [assets.length]); // eslint-disable-line

  const units = core.units.filter((u: Unit) => u.asset_id === selected);
  const occupied = units.filter((u: Unit) => u.status === "occupied").length;
  const vacant = units.filter((u: Unit) => u.status !== "occupied").length;

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">{category === "commercial" ? "Commercial Assets" : "Residential Assets"}</h1>
      <div className="flex gap-2 mb-4 flex-wrap">
        {assets.map((a: Asset) => (
          <button key={a.id} onClick={() => setSelected(a.id)}
            className={`px-3 py-1.5 rounded text-sm border ${selected === a.id ? "border-[var(--gold)] text-[var(--gold-bright)]" : "border-[#2a2a2a] text-gray-400"}`}>
            {a.name}
          </button>
        ))}
      </div>
      {units.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <Card label="Total Units" value={String(units.length)} />
          <Card label="Occupied" value={String(occupied)} tone="green" />
          <Card label="Vacant" value={String(vacant)} tone="gray" />
          <Card label="Occupancy" value={units.length ? ((occupied / units.length) * 100).toFixed(1) + "%" : "0%"} />
        </div>
      )}
      <div className="overflow-x-auto bg-[#111] border border-[#232323] rounded-lg">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 text-xs border-b border-[#232323]">
            <th className="p-3">Unit</th><th className="p-3">Floor / Room</th><th className="p-3">Rent</th><th className="p-3">Status</th>
          </tr></thead>
          <tbody>
            {units.map((u: Unit) => (
              <tr key={u.id} className="border-b border-[#1a1a1a] last:border-0">
                <td className="p-3">{u.name}</td>
                <td className="p-3 text-gray-400">{[u.floor, u.room].filter(Boolean).join(" / ") || "—"}</td>
                <td className="p-3 text-[var(--gold-bright)]">{money(u.monthly_rent)}</td>
                <td className="p-3"><StatusBadge status={u.status === "occupied" ? "PAID" : "VACANT"} /></td>
              </tr>
            ))}
            {!units.length && <tr><td colSpan={4} className="p-6 text-center text-gray-500">No units configured yet. Add units in Settings.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RentManagement({ core }: any) {
  const [filter, setFilter] = useState("ALL");
  const rows = core.rentStatus.filter((r: RentRow) => filter === "ALL" || r.rent_status === filter);
  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Rent Management</h1>
      <div className="flex gap-2 mb-4 flex-wrap">
        {["ALL", "PAID", "PENDING", "OVERDUE", "VACANT"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded text-xs border ${filter === f ? "border-[var(--gold)] text-[var(--gold-bright)]" : "border-[#2a2a2a] text-gray-400"}`}>{f}</button>
        ))}
      </div>
      <div className="overflow-x-auto bg-[#111] border border-[#232323] rounded-lg">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 text-xs border-b border-[#232323]">
            <th className="p-3">Property</th><th className="p-3">Unit</th><th className="p-3">Tenant</th><th className="p-3">Rent</th><th className="p-3">Received</th><th className="p-3">Status</th>
          </tr></thead>
          <tbody>
            {rows.map((r: RentRow) => (
              <tr key={r.unit_id} className="border-b border-[#1a1a1a] last:border-0">
                <td className="p-3">{r.property_name}</td>
                <td className="p-3">{r.unit_name}</td>
                <td className="p-3 text-gray-400">{r.tenant_name || "—"}</td>
                <td className="p-3">{money(r.monthly_rent)}</td>
                <td className="p-3 text-green-400">{money(r.amount_received)}</td>
                <td className="p-3"><StatusBadge status={r.rent_status} /></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="p-6 text-center text-gray-500">No units match this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function useDateRange() {
  const [range, setRange] = useState("month");
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  useEffect(() => {
    const now = new Date();
    if (range === "today") { const t = now.toISOString().slice(0, 10); setStart(t); setEnd(t); }
    else if (range === "week") { const d = new Date(now); d.setDate(d.getDate() - 7); setStart(d.toISOString().slice(0, 10)); setEnd(now.toISOString().slice(0, 10)); }
    else if (range === "month") { setStart(monthStart()); setEnd(now.toISOString().slice(0, 10)); }
    else if (range === "year") { setStart(`${now.getFullYear()}-01-01`); setEnd(now.toISOString().slice(0, 10)); }
    else if (range === "all") { setStart("2000-01-01"); setEnd(now.toISOString().slice(0, 10)); }
  }, [range]);
  return { range, setRange, start, end, setStart, setEnd };
}

function RangePicker({ dr }: { dr: ReturnType<typeof useDateRange> }) {
  return (
    <div className="flex flex-wrap gap-2 items-center mb-4 no-print">
      {[["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["year", "This Year"], ["all", "All Time"], ["custom", "Custom"]].map(([k, l]) => (
        <button key={k} onClick={() => dr.setRange(k)} className={`px-3 py-1.5 rounded text-xs border ${dr.range === k ? "border-[var(--gold)] text-[var(--gold-bright)]" : "border-[#2a2a2a] text-gray-400"}`}>{l}</button>
      ))}
      {dr.range === "custom" && (
        <>
          <input type="date" value={dr.start} onChange={(e) => dr.setStart(e.target.value)} className={inputClass + " w-auto"} />
          <span className="text-gray-500 text-xs">to</span>
          <input type="date" value={dr.end} onChange={(e) => dr.setEnd(e.target.value)} className={inputClass + " w-auto"} />
        </>
      )}
    </div>
  );
}

function IncomeView({ core }: any) {
  const dr = useDateRange();
  const [assetFilter, setAssetFilter] = useState("ALL");
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("income_transactions").select("*, assets(name), income_categories(name)")
        .eq("voided", false).gte("txn_date", dr.start).lte("txn_date", dr.end).order("txn_date", { ascending: false });
      setRows(data || []);
    })();
  }, [dr.start, dr.end]);
  const filtered = assetFilter === "ALL" ? rows : rows.filter((r) => r.asset_id === assetFilter);
  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Other Income</h1>
      <RangePicker dr={dr} />
      <select value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)} className={selectClass + " w-auto mb-4 no-print"}>
        <option value="ALL">All Assets</option>
        {core.assets.map((a: Asset) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <div className="overflow-x-auto bg-[#111] border border-[#232323] rounded-lg">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 text-xs border-b border-[#232323]">
            <th className="p-3">Date</th><th className="p-3">Asset</th><th className="p-3">Category</th><th className="p-3">Method</th><th className="p-3 text-right">Amount</th>
          </tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-[#1a1a1a] last:border-0">
                <td className="p-3 text-gray-400">{r.txn_date}</td>
                <td className="p-3">{r.assets?.name}</td>
                <td className="p-3">{r.income_categories?.name}</td>
                <td className="p-3 text-gray-400">{r.payment_method === "cash" ? "Cash" : "Bank Transfer"}</td>
                <td className="p-3 text-right text-[var(--gold-bright)]">{money(r.amount)}</td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={5} className="p-6 text-center text-gray-500">No transactions recorded yet.</td></tr>}
          </tbody>
          {filtered.length > 0 && <tfoot><tr className="border-t border-[#232323]"><td colSpan={4} className="p-3 text-right text-gray-400">TOTAL</td><td className="p-3 text-right font-semibold text-[var(--gold-bright)]">{money(total)}</td></tr></tfoot>}
        </table>
      </div>
    </div>
  );
}

function ExpensesView({ core }: any) {
  const dr = useDateRange();
  const [assetFilter, setAssetFilter] = useState("ALL");
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("expense_transactions").select("*, assets(name), expense_categories(name)")
        .eq("voided", false).gte("txn_date", dr.start).lte("txn_date", dr.end).order("txn_date", { ascending: false });
      setRows(data || []);
    })();
  }, [dr.start, dr.end]);
  const filtered = assetFilter === "ALL" ? rows : rows.filter((r) => r.asset_id === assetFilter);
  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);

  const byCategory: Record<string, number> = {};
  filtered.forEach((r) => { const name = r.expense_categories?.name || "Other"; byCategory[name] = (byCategory[name] || 0) + Number(r.amount); });

  const viewReceipt = async (path: string) => {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Expenses</h1>
      <RangePicker dr={dr} />
      <select value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)} className={selectClass + " w-auto mb-4 no-print"}>
        <option value="ALL">All Assets</option>
        {core.assets.map((a: Asset) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      {Object.keys(byCategory).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          {Object.entries(byCategory).map(([name, amt]) => (
            <div key={name} className="bg-[#111] border border-[#232323] rounded p-3">
              <div className="text-[11px] text-gray-500">{name}</div>
              <div className="text-sm text-[var(--gold-bright)] mt-1">{money(amt)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto bg-[#111] border border-[#232323] rounded-lg">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 text-xs border-b border-[#232323]">
            <th className="p-3">Date</th><th className="p-3">Asset</th><th className="p-3">Category</th><th className="p-3">Vendor</th><th className="p-3">Method</th><th className="p-3 text-right">Amount</th><th className="p-3 no-print">Receipt</th>
          </tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-[#1a1a1a] last:border-0">
                <td className="p-3 text-gray-400">{r.txn_date}</td>
                <td className="p-3">{r.assets?.name}</td>
                <td className="p-3">{r.expense_categories?.name}</td>
                <td className="p-3 text-gray-400">{r.paid_to || "—"}</td>
                <td className="p-3 text-gray-400">{r.payment_method === "cash" ? "Cash" : "Bank Transfer"}</td>
                <td className="p-3 text-right text-red-400">{money(r.amount)}</td>
                <td className="p-3 no-print">{r.receipt_path ? <button onClick={() => viewReceipt(r.receipt_path)} className="text-[var(--gold)] text-xs underline">View</button> : "—"}</td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} className="p-6 text-center text-gray-500">No transactions recorded yet.</td></tr>}
          </tbody>
          {filtered.length > 0 && <tfoot><tr className="border-t border-[#232323]"><td colSpan={5} className="p-3 text-right text-gray-400">TOTAL EXPENSES</td><td className="p-3 text-right font-semibold text-red-400">{money(total)}</td><td className="no-print" /></tr></tfoot>}
        </table>
      </div>
    </div>
  );
}

function AnalyticsView({ core }: any) {
  const [selected, setSelected] = useState("ALL");
  const [fin, setFin] = useState<any[]>([]);
  useEffect(() => { (async () => { const { data } = await supabase.from("v_asset_financials").select("*"); setFin(data || []); })(); }, []);

  const rows = selected === "ALL" ? fin : fin.filter((f) => f.asset_id === selected);
  const totalIncome = rows.reduce((s, r) => s + Number(r.rent_received_this_month) + Number(r.total_other_income), 0);
  const totalExpenses = rows.reduce((s, r) => s + Number(r.total_expenses), 0);
  const expectedRent = rows.reduce((s, r) => s + Number(r.expected_rent_this_month), 0);
  const rentReceived = rows.reduce((s, r) => s + Number(r.rent_received_this_month), 0);

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Analytics</h1>
      <select value={selected} onChange={(e) => setSelected(e.target.value)} className={selectClass + " w-auto mb-4 no-print"}>
        <option value="ALL">All Assets (combined)</option>
        {core.assets.map((a: Asset) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <Card label="Total Income" value={money(totalIncome)} tone="green" />
        <Card label="Total Expenses" value={money(totalExpenses)} tone="red" />
        <Card label="Net Profit" value={money(totalIncome - totalExpenses)} tone={totalIncome - totalExpenses >= 0 ? "green" : "red"} />
        <Card label="Expected Rent" value={money(expectedRent)} />
        <Card label="Rent Received" value={money(rentReceived)} tone="green" />
        <Card label="Rent Outstanding" value={money(Math.max(0, expectedRent - rentReceived))} tone="red" />
      </div>
      <div className="overflow-x-auto bg-[#111] border border-[#232323] rounded-lg">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 text-xs border-b border-[#232323]">
            <th className="p-3">Asset</th><th className="p-3 text-right">Expected Rent</th><th className="p-3 text-right">Rent Received</th><th className="p-3 text-right">Other Income</th><th className="p-3 text-right">Expenses</th><th className="p-3 text-right">Net Profit</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.asset_id} className="border-b border-[#1a1a1a] last:border-0">
                <td className="p-3">{r.asset_name}</td>
                <td className="p-3 text-right">{money(r.expected_rent_this_month)}</td>
                <td className="p-3 text-right text-green-400">{money(r.rent_received_this_month)}</td>
                <td className="p-3 text-right">{money(r.total_other_income)}</td>
                <td className="p-3 text-right text-red-400">{money(r.total_expenses)}</td>
                <td className="p-3 text-right text-[var(--gold-bright)]">{money(r.rent_received_this_month + r.total_other_income - r.total_expenses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsView({ core }: any) {
  const dr = useDateRange();
  const [income, setIncome] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const [i, e] = await Promise.all([
        supabase.from("income_transactions").select("amount, assets(name)").eq("voided", false).gte("txn_date", dr.start).lte("txn_date", dr.end),
        supabase.from("expense_transactions").select("amount, assets(name)").eq("voided", false).gte("txn_date", dr.start).lte("txn_date", dr.end),
      ]);
      setIncome(i.data || []); setExpenses(e.data || []);
    })();
  }, [dr.start, dr.end]);

  const expectedRent = core.rentStatus.filter((r: RentRow) => r.unit_status === "occupied").reduce((s: number, r: RentRow) => s + Number(r.monthly_rent), 0);
  const rentReceived = core.rentStatus.reduce((s: number, r: RentRow) => s + Number(r.amount_received), 0);
  const totalIncome = income.reduce((s, r) => s + Number(r.amount), 0);
  const totalExpenses = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const netProfit = rentReceived + totalIncome - totalExpenses;
  const collectionRate = expectedRent > 0 ? ((rentReceived / expectedRent) * 100).toFixed(1) : "0";

  return (
    <div className="print-area">
      <div className="flex items-center justify-between mb-4 no-print">
        <h1 className="text-lg font-semibold">Reports</h1>
        <button onClick={() => window.print()} className="flex items-center gap-2 bg-[var(--gold)] text-black text-sm px-3 py-1.5 rounded"><Printer size={14} /> Print</button>
      </div>
      <RangePicker dr={dr} />
      <div className="text-center mb-6 border-b border-[#232323] pb-4">
        <div className="text-xs tracking-widest text-[var(--gold)]">K&amp;J CHESHTI PROPERTIES</div>
        <div className="text-sm text-gray-400">Property &amp; Financial Management System</div>
        <div className="text-xs text-gray-500 mt-1">Financial Report: {dr.start} to {dr.end}</div>
        <div className="text-[11px] text-gray-600">Generated {new Date().toLocaleString()}</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <Card label="Expected Rent" value={money(expectedRent)} />
        <Card label="Rent Received" value={money(rentReceived)} tone="green" />
        <Card label="Collection Rate" value={collectionRate + "%"} />
        <Card label="Rental + Other Income" value={money(rentReceived + totalIncome)} tone="green" />
        <Card label="Total Expenses" value={money(totalExpenses)} tone="red" />
        <Card label="Net Profit" value={money(netProfit)} tone={netProfit >= 0 ? "green" : "red"} />
      </div>
      <div className="text-sm text-gray-500">Use the Income and Expenses tabs for detailed, filterable transaction lists — this summary is optimized for printing.</div>
    </div>
  );
}

function SettingsView({ core, show }: any) {
  const [tab, setTab] = useState("categories");
  const [newExpCat, setNewExpCat] = useState("");
  const [newIncCat, setNewIncCat] = useState("");
  const [gracePeriod, setGracePeriod] = useState("5");
  const [dueDay, setDueDay] = useState("1");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("settings").select("*");
      const map: any = {}; (data || []).forEach((s: any) => (map[s.key] = s.value));
      if (map.grace_period_days) setGracePeriod(map.grace_period_days);
      if (map.rent_due_day) setDueDay(map.rent_due_day);
    })();
  }, []);

  const saveSetting = async (key: string, value: string) => {
    const { error } = await supabase.from("settings").upsert({ key, value });
    if (error) show(error.message, "err"); else show("Setting saved.");
  };

  const addCategory = async (table: "expense_categories" | "income_categories", name: string, clear: () => void) => {
    if (!name.trim()) return;
    const { error } = await supabase.from(table).insert({ name: name.trim() });
    if (error) show(error.message, "err"); else { show("Category added."); clear(); core.reload(); }
  };

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Settings</h1>
      <div className="flex gap-2 mb-5 flex-wrap">
        {["categories", "hostel", "grace"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded text-xs border ${tab === t ? "border-[var(--gold)] text-[var(--gold-bright)]" : "border-[#2a2a2a] text-gray-400"}`}>
            {t === "categories" ? "Categories" : t === "hostel" ? "Hostel Setup" : "Rent Rules"}
          </button>
        ))}
      </div>

      {tab === "categories" && (
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
          <div>
            <h2 className="text-sm text-gray-400 mb-2">Expense Categories</h2>
            <div className="space-y-1 mb-3">{core.expenseCats.map((c: Category) => <div key={c.id} className="text-sm bg-[#111] border border-[#232323] rounded px-3 py-1.5">{c.name}</div>)}</div>
            <div className="flex gap-2">
              <input value={newExpCat} onChange={(e) => setNewExpCat(e.target.value)} className={inputClass} placeholder="New category" />
              <button onClick={() => addCategory("expense_categories", newExpCat, () => setNewExpCat(""))} className="bg-[var(--gold)] text-black text-sm px-3 rounded shrink-0">Add</button>
            </div>
          </div>
          <div>
            <h2 className="text-sm text-gray-400 mb-2">Income Categories</h2>
            <div className="space-y-1 mb-3">{core.incomeCats.map((c: Category) => <div key={c.id} className="text-sm bg-[#111] border border-[#232323] rounded px-3 py-1.5">{c.name}</div>)}</div>
            <div className="flex gap-2">
              <input value={newIncCat} onChange={(e) => setNewIncCat(e.target.value)} className={inputClass} placeholder="New category" />
              <button onClick={() => addCategory("income_categories", newIncCat, () => setNewIncCat(""))} className="bg-[var(--gold)] text-black text-sm px-3 rounded shrink-0">Add</button>
            </div>
          </div>
        </div>
      )}

      {tab === "hostel" && <HostelSetup core={core} show={show} />}

      {tab === "grace" && (
        <div className="max-w-sm space-y-4">
          <Field label="Rent Due Day (1-28)">
            <input value={dueDay} onChange={(e) => setDueDay(e.target.value)} type="number" min="1" max="28" className={inputClass} />
          </Field>
          <Field label="Grace Period (days)">
            <input value={gracePeriod} onChange={(e) => setGracePeriod(e.target.value)} type="number" min="0" max="30" className={inputClass} />
          </Field>
          <button onClick={() => { saveSetting("rent_due_day", dueDay); saveSetting("grace_period_days", gracePeriod); }} className="bg-[var(--gold)] text-black text-sm px-4 py-2 rounded">Save</button>
        </div>
      )}
    </div>
  );
}

// Hostel bed configuration: admin assigns floor/room/bed/room-type directly into `units`
function HostelSetup({ core, show }: any) {
  const hostelAsset = core.assets.find((a: Asset) => a.name.includes("Boys Hostel"));
  const [floor, setFloor] = useState("");
  const [room, setRoom] = useState("");
  const [bedLabel, setBedLabel] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [busy, setBusy] = useState(false);

  const beds = core.units.filter((u: Unit) => u.asset_id === hostelAsset?.id);

  const addBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostelAsset || !floor || !room || !bedLabel || !roomTypeId) return;
    setBusy(true);
    const rt = core.roomTypes.find((r: RoomType) => r.id === roomTypeId);
    const { error } = await supabase.from("units").insert({
      asset_id: hostelAsset.id, unit_type: "bed",
      name: `Room ${room} — ${bedLabel}`, floor, room,
      room_type_id: roomTypeId, monthly_rent: rt?.monthly_rent || 0, status: "vacant",
    });
    setBusy(false);
    if (error) show(error.message, "err"); else { show("Bed added."); setBedLabel(""); core.reload(); }
  };

  return (
    <div className="max-w-2xl">
      <div className="text-sm text-gray-400 mb-3">
        Barkat Market Heights Boys Hostel has 125 beds across the top 3 floors. The exact floor/room
        layout wasn't specified up front, so add beds here as you finalize the layout — each bed
        automatically inherits its rent from the selected room type.
      </div>
      <form onSubmit={addBed} className="grid grid-cols-2 gap-3 bg-[#111] border border-[#232323] rounded-lg p-4 mb-6">
        <Field label="Floor"><input value={floor} onChange={(e) => setFloor(e.target.value)} className={inputClass} placeholder="e.g. 3rd Floor" required /></Field>
        <Field label="Room"><input value={room} onChange={(e) => setRoom(e.target.value)} className={inputClass} placeholder="e.g. 301" required /></Field>
        <Field label="Bed Label"><input value={bedLabel} onChange={(e) => setBedLabel(e.target.value)} className={inputClass} placeholder="e.g. Bed 2" required /></Field>
        <Field label="Room Type">
          <select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)} className={selectClass} required>
            <option value="">Select...</option>
            {core.roomTypes.map((rt: RoomType) => <option key={rt.id} value={rt.id}>{rt.name} — {money(rt.monthly_rent)}</option>)}
          </select>
        </Field>
        <div className="col-span-2"><SubmitBtn busy={busy} label="Add Bed" /></div>
      </form>
      <div className="text-sm text-gray-400 mb-2">{beds.length} of 125 beds configured</div>
      <div className="overflow-x-auto bg-[#111] border border-[#232323] rounded-lg">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 text-xs border-b border-[#232323]"><th className="p-3">Floor</th><th className="p-3">Room</th><th className="p-3">Bed</th><th className="p-3">Type</th><th className="p-3">Rent</th><th className="p-3">Status</th></tr></thead>
          <tbody>
            {beds.map((b: Unit) => {
              const rt = core.roomTypes.find((r: RoomType) => r.id === b.room_type_id);
              return (
                <tr key={b.id} className="border-b border-[#1a1a1a] last:border-0">
                  <td className="p-3">{b.floor}</td><td className="p-3">{b.room}</td><td className="p-3">{b.name.split("— ")[1]}</td>
                  <td className="p-3">{rt?.name}</td><td className="p-3">{money(b.monthly_rent)}</td>
                  <td className="p-3"><StatusBadge status={b.status === "occupied" ? "PAID" : "VACANT"} /></td>
                </tr>
              );
            })}
            {!beds.length && <tr><td colSpan={6} className="p-6 text-center text-gray-500">No beds configured yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
