"use client";

import { useEffect, useMemo, useState, useCallback, useRef, Children } from "react";
import { createPortal } from "react-dom";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  LogOut, AlertTriangle, Home, Building2, PlusCircle, BarChart3,
  Wallet, Receipt, FileText, Settings as SettingsIcon, Printer,
  ChevronRight, ChevronDown, Loader2, X, CheckCircle2, Users, BedDouble, UserPlus, ArrowLeft, Search,
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
type StaffMember = { id: string; code: string | null; name: string; cnic: string; role: string; monthly_salary: number; is_active: boolean };
type SalaryPayment = {
  id: string; staff_id: string; salary_month: string; amount: number;
  payment_method: string; payment_date: string; notes: string | null; voided: boolean;
};

const money = (n: number) =>
  "PKR " + Math.round(n || 0).toLocaleString("en-PK");

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayStr = () => fmtDate(new Date());
const monthStart = (d = new Date()) => fmtDate(new Date(d.getFullYear(), d.getMonth(), 1));

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
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text-secondary)]">
      <Loader2 className="animate-spin mr-2" size={18} /> {label}
    </div>
  );
}


// ---------------------------------------------------------------------------
// CUSTOM ANIMATED DROPDOWN (drop-in replacement for native <select>, same
// value/onChange/children API — pass <option> children exactly as before)
// ---------------------------------------------------------------------------
function Dropdown({ value, onChange, children, className, placeholder }: any) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; flip: boolean }>({ top: 0, left: 0, width: 0, flip: false });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const options = Children.toArray(children)
    .filter((c: any) => c && c.props)
    .map((c: any) => ({ value: c.props.value, label: c.props.children, disabled: c.props.disabled }));

  const current = options.find((o: any) => o.value === value);

  const computePosition = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const estListHeight = Math.min(options.length * 40 + 12, 256);
    const spaceBelow = window.innerHeight - r.bottom;
    const flip = spaceBelow < estListHeight + 12 && r.top > estListHeight;
    setPos({
      top: flip ? r.top - 8 : r.bottom + 8,
      left: r.left,
      width: r.width,
      flip,
    });
  }, [options.length]);

  const toggle = () => {
    if (!open) computePosition();
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    computePosition();
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScrollOrResize = () => computePosition();
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, computePosition]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`${className} flex items-center justify-between gap-2 cursor-pointer select-none text-left w-full`}
      >
        <span className={current && current.value ? "" : "text-[var(--text-secondary)]"}>
          {current ? current.label : placeholder || "Select..."}
        </span>
        <ChevronDown size={14} className={`text-gold shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: pos.flip ? undefined : pos.top,
            bottom: pos.flip ? window.innerHeight - pos.top : undefined,
            left: pos.left,
            width: pos.width,
          }}
          className="z-[999] glass-strong rounded-xl p-1.5 max-h-64 overflow-y-auto dropdown-pop"
        >
          {options.map((o: any, i: number) => (
            <button
              key={i}
              type="button"
              disabled={o.disabled}
              onClick={() => {
                if (o.disabled) return;
                onChange({ target: { value: o.value } });
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                o.disabled
                  ? "opacity-30 cursor-not-allowed"
                  : o.value === value
                  ? "bg-[var(--gold)]/15 text-champagne"
                  : "text-[var(--text)] hover:bg-white/8"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        , document.body)}
    </>
  );
}

// ---------------------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------------------
const LOGO_URL = "https://kj-website-indol.vercel.app/logo.png";
const HERO_IMAGE = "https://kj-website-indol.vercel.app/project7.jpg"; // Barkat Market Heights

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
    <div className="min-h-screen flex bg-[var(--bg)] relative overflow-hidden">
      <div className="ambient-orb orb-emerald" />
      <div className="ambient-orb orb-gold" />
      {/* Left: brand / building imagery */}
      <div
        className="hidden lg:flex lg:w-1/2 hero-image items-end p-12 relative building-pop"
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
      >
        <div className="relative z-10 fade-up stagger-2">
          <img src={LOGO_URL} alt="K&J Chesti" className="h-14 mb-6 brand-glow" />
          <div className="text-3xl font-semibold text-white leading-tight max-w-md">
            Barkat Market Heights
          </div>
          <div className="text-champagne text-sm mt-2 max-w-md">
            Lahore's premium mixed-use development — managed end-to-end on one platform.
          </div>
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex-1 flex items-center justify-center px-4 relative z-10">
        <div className="w-full max-w-sm fade-up">
          <div className="text-center mb-8 lg:hidden">
            <img src={LOGO_URL} alt="K&J Chesti" className="h-12 mx-auto mb-4 brand-glow" />
          </div>
          <div className="text-center mb-8">
            <div className="text-xs tracking-widest text-gold mb-2 hidden lg:block">KHURRAM &amp; JAMAAL</div>
            <h1 className="text-2xl font-semibold text-white">K&amp;J CHESHTI PROPERTIES</h1>
            <p className="text-[var(--text-secondary)] text-sm mt-1">Property &amp; Financial Management System</p>
          </div>
          <form onSubmit={submit} className="glass-strong shimmer-border rounded-2xl p-7 space-y-4 fade-up stagger-2">
            {err && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>
            )}
            <div>
              <label className="text-xs text-[var(--text-secondary)]">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required
                className="w-full mt-1 glass-input rounded-lg px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-secondary)]">Password</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required
                className="w-full mt-1 glass-input rounded-lg px-3 py-2.5 text-sm" />
            </div>
            <button disabled={busy} type="submit"
              className="w-full btn-gold rounded-lg py-2.5 text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              {busy && <Loader2 className="animate-spin" size={16} />} Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SHARED SHELL
// ---------------------------------------------------------------------------
function Shell({ profile, tabs, active, setActive, children }: any) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-white flex relative overflow-hidden">
      <div className="ambient-orb orb-emerald no-print" />
      <div className="ambient-orb orb-gold no-print" />
      <aside className="w-60 shrink-0 glass-strong hidden md:flex flex-col no-print border-r-0 rounded-none relative z-10">
        <div className="p-5 border-b border-[var(--glass-border)] flex items-center gap-3">
          <img src={LOGO_URL} alt="K&J Chesti" className="h-8 w-8 object-contain" />
          <div>
            <div className="font-semibold text-sm">K&amp;J CHESHTI</div>
            <div className="text-[11px] text-[var(--text-secondary)]">{profile.role === "admin" ? "Administrator" : "Staff"}</div>
          </div>
        </div>
        <nav className="flex-1 py-3">
          {tabs.map((t: any) => (
            <button key={t.key} onClick={() => setActive(t.key)}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left rounded-lg mx-2 mb-0.5 transition-colors ${
                active === t.key ? "nav-active" : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
              }`} style={{ width: "calc(100% - 1rem)" }}>
              <t.icon size={16} className="nav-icon-anim" /> {t.label}
            </button>
          ))}
        </nav>
        <button onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-2 px-5 py-4 text-sm text-[var(--text-secondary)] hover:text-red-400 border-t border-[var(--glass-border)]">
          <LogOut size={16} /> Logout
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <div className="md:hidden flex items-center justify-between px-4 py-3 glass no-print rounded-none border-x-0 border-t-0">
          <span className="font-semibold text-sm text-gold flex items-center gap-2">
            <img src={LOGO_URL} alt="K&J Chesti" className="h-6 w-6 object-contain" /> K&amp;J CHESHTI
          </span>
          <button onClick={() => supabase.auth.signOut()}><LogOut size={18} className="text-[var(--text-secondary)]" /></button>
        </div>
        <div className="md:hidden flex overflow-x-auto glass no-print rounded-none border-x-0 border-t-0">
          {tabs.map((t: any) => (
            <button key={t.key} onClick={() => setActive(t.key)}
              className={`px-4 py-2.5 text-xs whitespace-nowrap ${active === t.key ? "text-gold border-b-2 border-[var(--gold)]" : "text-[var(--text-secondary)]"}`}>
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
  const toneClass = { gold: "text-champagne", green: "text-[var(--success)]", red: "text-[var(--danger)]", gray: "text-gray-300" }[tone];
  return (
    <div className="glass fade-up rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label?: string }) {
  const map: Record<string, string> = {
    PAID: "bg-green-950 text-green-400 border-green-900",
    PENDING: "bg-yellow-950 text-yellow-400 border-yellow-900",
    OVERDUE: "bg-red-950 text-red-400 border-red-900",
    VACANT: "bg-gray-900 text-[var(--text-secondary)] border-gray-800",
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded border ${map[status] || map.VACANT}`}>{label || status}</span>;
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
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const [p, a, u, rt, ic, ec, rs, sm] = await Promise.all([
      supabase.from("properties").select("*").order("name"),
      supabase.from("assets").select("*").order("name"),
      supabase.from("units").select("*").order("name"),
      supabase.from("room_types").select("*").order("monthly_rent"),
      supabase.from("income_categories").select("*").order("name"),
      supabase.from("expense_categories").select("*").order("name"),
      supabase.from("v_current_rent_status").select("*"),
      supabase.from("staff_members").select("*").order("name"),
    ]);
    setProperties(p.data || []);
    setAssets(a.data || []);
    setUnits(u.data || []);
    setRoomTypes(rt.data || []);
    setIncomeCats(ic.data || []);
    setExpenseCats(ec.data || []);
    setRentStatus((rs.data as any) || []);
    setStaffMembers(sm.data || []);
    setReady(true);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { properties, assets, units, roomTypes, incomeCats, expenseCats, rentStatus, staffMembers, ready, reload };
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
    const sinceStr = fmtDate(since);
    const [r, i, e, s] = await Promise.all([
      supabase.from("rent_payments").select("*, units(name)").eq("created_by", profile.id).gte("payment_date", sinceStr).order("created_at", { ascending: false }),
      supabase.from("income_transactions").select("*, assets(name), income_categories(name)").eq("created_by", profile.id).gte("txn_date", sinceStr).order("created_at", { ascending: false }),
      supabase.from("expense_transactions").select("*, assets(name), expense_categories(name)").eq("created_by", profile.id).gte("txn_date", sinceStr).order("created_at", { ascending: false }),
      supabase.from("salary_payments").select("*, staff_members(name)").eq("created_by", profile.id).gte("payment_date", sinceStr).order("created_at", { ascending: false }),
    ]);
    const rows = [
      ...(r.data || []).map((x: any) => ({ kind: "Rental Income", label: x.units?.name, amount: x.amount, date: x.payment_date, created_at: x.created_at })),
      ...(i.data || []).map((x: any) => ({ kind: "Other Income", label: `${x.assets?.name} — ${x.income_categories?.name}`, amount: x.amount, date: x.txn_date, created_at: x.created_at })),
      ...(e.data || []).map((x: any) => ({ kind: "Expense", label: `${x.assets?.name} — ${x.expense_categories?.name}`, amount: x.amount, date: x.txn_date, created_at: x.created_at })),
      ...(s.data || []).map((x: any) => ({ kind: "Staff Salary", label: x.staff_members?.name, amount: x.amount, date: x.payment_date, created_at: x.created_at })),
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
    { key: "salary", label: "Staff Salaries", icon: Users },
    { key: "mine", label: "My Entries", icon: FileText },
  ];

  return (
    <Shell profile={profile} tabs={tabs} active={active} setActive={setActive}>
      <Toast msg={msg} />
      {active === "dashboard" && (
        <div className="space-y-6">
          <h1 className="text-lg font-semibold">Welcome, {profile.full_name || profile.email}</h1>
          {overdue.length > 0 && (
            <div className="glass border-red-500/30 rounded-lg p-4 fade-up">
              <div className="flex items-center gap-2 text-red-400 font-medium text-sm">
                <AlertTriangle size={16} className="pulse-dot" /> RENT PAYMENTS OVERDUE
              </div>
              <div className="text-red-300 text-sm mt-1">{overdue.length} rental payment(s) have passed the 5-day grace period.</div>
              <div className="mt-2 space-y-1 text-xs text-red-300/80">
                {overdue.slice(0, 5).map((r) => <div key={r.unit_id}>{r.property_name} — {r.unit_name}</div>)}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button onClick={() => setActive("rental")} className="glass hover:border-[var(--gold)]/50 rounded-lg p-5 text-left">
              <Wallet className="text-gold mb-2" size={20} /><div className="font-medium text-sm">+ Rental Income</div>
            </button>
            <button onClick={() => setActive("other")} className="glass hover:border-[var(--gold)]/50 rounded-lg p-5 text-left">
              <PlusCircle className="text-gold mb-2" size={20} /><div className="font-medium text-sm">+ Other Income</div>
            </button>
            <button onClick={() => setActive("expense")} className="glass hover:border-[var(--gold)]/50 rounded-lg p-5 text-left">
              <Receipt className="text-gold mb-2" size={20} /><div className="font-medium text-sm">+ Expense</div>
            </button>
            <button onClick={() => setActive("salary")} className="glass hover:border-[var(--gold)]/50 rounded-lg p-5 text-left">
              <Users className="text-gold mb-2" size={20} /><div className="font-medium text-sm">+ Staff Salaries</div>
            </button>
          </div>
          <div>
            <h2 className="text-sm text-[var(--text-secondary)] mb-2">Your recent entries (last 14 days)</h2>
            <EntriesTable rows={myEntries.slice(0, 10)} />
          </div>
        </div>
      )}
      {active === "rental" && <RentalEntryForm core={core} profile={profile} onDone={() => { show("Rental payment recorded."); core.reload(); }} />}
      {active === "other" && <OtherIncomeForm core={core} profile={profile} onDone={() => { show("Other income recorded."); core.reload(); }} />}
      {active === "expense" && <ExpenseForm core={core} profile={profile} onDone={() => { show("Expense recorded."); core.reload(); }} />}
      {active === "salary" && <SalaryForm core={core} profile={profile} onDone={() => { show("Salary marked as paid."); core.reload(); }} />}
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
  if (!rows.length) return <div className="text-sm text-[var(--text-secondary)] glass rounded-lg p-6 text-center">No transactions recorded yet.</div>;
  return (
    <div className="overflow-x-auto glass rounded-lg">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[var(--text-secondary)] text-xs border-b border-white/10">
          <th className="p-3">Type</th><th className="p-3">Detail</th><th className="p-3">Date</th><th className="p-3 text-right">Amount</th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0">
              <td className="p-3 text-[var(--text-secondary)]">{r.kind}</td>
              <td className="p-3">{r.label}</td>
              <td className="p-3 text-[var(--text-secondary)]">{r.date}</td>
              <td className="p-3 text-right text-champagne">{money(r.amount)}</td>
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
  const [payDate, setPayDate] = useState(todayStr());
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
        <Dropdown value={assetId} onChange={(e) => { setAssetId(e.target.value); setFloor(""); setRoom(""); setUnitId(""); }} required className={selectClass}>
          <option value="">Select asset...</option>
          {core.assets.filter((a: Asset) => a.category === "residential" || core.units.some((u: Unit) => u.asset_id === a.id && u.unit_type === "commercial_unit")).map((a: Asset) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Dropdown>
      </Field>

      {isBedAsset && (
        <>
          <Field label="Floor">
            <Dropdown value={floor} onChange={(e) => { setFloor(e.target.value); setRoom(""); setUnitId(""); }} required className={selectClass}>
              <option value="">Select floor...</option>
              {floors.map((f: any) => <option key={f} value={f}>{f}</option>)}
            </Dropdown>
          </Field>
          {floor && (
            <Field label="Room">
              <Dropdown value={room} onChange={(e) => { setRoom(e.target.value); setUnitId(""); }} required className={selectClass}>
                <option value="">Select room...</option>
                {rooms.map((r: any) => <option key={r} value={r}>{r}</option>)}
              </Dropdown>
            </Field>
          )}
          {room && (
            <Field label="Bed">
              <Dropdown value={unitId} onChange={(e) => setUnitId(e.target.value)} required className={selectClass}>
                <option value="">Select bed...</option>
                {beds.map((b: Unit) => {
                  const rt = core.roomTypes.find((rt: RoomType) => rt.id === b.room_type_id);
                  return <option key={b.id} value={b.id} disabled={b.status !== "occupied"}>
                    {b.name} — {rt?.name} ({b.status})
                  </option>;
                })}
              </Dropdown>
            </Field>
          )}
        </>
      )}

      {assetId && !isBedAsset && (
        <Field label="Unit">
          <Dropdown value={unitId} onChange={(e) => setUnitId(e.target.value)} required className={selectClass}>
            <option value="">Select unit...</option>
            {nonBedUnits.map((u: Unit) => <option key={u.id} value={u.id} disabled={u.status !== "occupied"}>{u.name} — {money(u.monthly_rent)} ({u.status})</option>)}
          </Dropdown>
        </Field>
      )}

      {selectedUnit && (
        <div className="text-xs text-[var(--text-secondary)] glass rounded px-3 py-2">
          Configured rent: <span className="text-champagne">{money(selectedUnit.monthly_rent)}</span>{roomType ? ` (${roomType.name})` : ""}
        </div>
      )}

      <Field label="Tenant (optional if already on file)">
        <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} className={inputClass} placeholder="Tenant name" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount Received"><input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" step="0.01" required className={inputClass} /></Field>
        <Field label="Payment Method">
          <Dropdown value={method} onChange={(e) => setMethod(e.target.value)} className={selectClass}>
            <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option>
          </Dropdown>
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
  const [date, setDate] = useState(todayStr());
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
        <Dropdown value={assetId} onChange={(e) => setAssetId(e.target.value)} required className={selectClass}>
          <option value="">Select asset...</option>
          {core.assets.map((a: Asset) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Dropdown>
      </Field>
      <Field label="Income Category">
        <Dropdown value={catId} onChange={(e) => setCatId(e.target.value)} required className={selectClass}>
          <option value="">Select category...</option>
          {core.incomeCats.map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Dropdown>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount"><input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" step="0.01" required className={inputClass} /></Field>
        <Field label="Payment Method">
          <Dropdown value={method} onChange={(e) => setMethod(e.target.value)} className={selectClass}>
            <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option>
          </Dropdown>
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
  const [date, setDate] = useState(todayStr());
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
        <Dropdown value={assetId} onChange={(e) => setAssetId(e.target.value)} required className={selectClass}>
          <option value="">Select asset...</option>
          {core.assets.map((a: Asset) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Dropdown>
      </Field>
      <Field label="Expense Category">
        <Dropdown value={catId} onChange={(e) => setCatId(e.target.value)} required className={selectClass}>
          <option value="">Select category...</option>
          {core.expenseCats.map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Dropdown>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount"><input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" step="0.01" required className={inputClass} /></Field>
        <Field label="Payment Method">
          <Dropdown value={method} onChange={(e) => setMethod(e.target.value)} className={selectClass}>
            <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option>
          </Dropdown>
        </Field>
      </div>
      <Field label="Date"><input value={date} onChange={(e) => setDate(e.target.value)} type="date" required className={inputClass} /></Field>
      <Field label="Paid To / Vendor"><input value={paidTo} onChange={(e) => setPaidTo(e.target.value)} className={inputClass} /></Field>
      <Field label="Description"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} rows={2} /></Field>
      <Field label="Receipt / Invoice (optional)">
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm text-[var(--text-secondary)]" />
      </Field>
      <SubmitBtn busy={busy} label="Record Expense" />
    </form>
  );
}

function SalaryForm({ core, profile, onDone }: any) {
  const [staffId, setStaffId] = useState("");
  const [month, setMonth] = useState(monthStart());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [paidThisMonth, setPaidThisMonth] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const activeStaff = core.staffMembers.filter((s: StaffMember) => s.is_active);
  const selectedStaff = core.staffMembers.find((s: StaffMember) => s.id === staffId);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("salary_payments").select("staff_id").eq("salary_month", month).eq("voided", false);
      const map: Record<string, boolean> = {};
      (data || []).forEach((r: any) => (map[r.staff_id] = true));
      setPaidThisMonth(map);
    })();
  }, [month]);

  useEffect(() => {
    if (selectedStaff) setAmount(String(selectedStaff.monthly_salary));
  }, [staffId]); // eslint-disable-line

  const alreadyPaid = staffId ? !!paidThisMonth[staffId] : false;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!staffId) { setErr("Please select a staff member."); return; }
    if (alreadyPaid) { setErr("This staff member's salary is already marked paid for this month."); return; }
    if (!amount || Number(amount) <= 0) { setErr("Amount must be positive."); return; }
    setBusy(true);
    const { error } = await supabase.from("salary_payments").insert({
      staff_id: staffId, salary_month: month, amount: Number(amount),
      payment_method: method, payment_date: date, notes: notes || null, created_by: profile.id,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setStaffId(""); setAmount(""); setNotes("");
    onDone();
  };

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4">
      <h1 className="text-lg font-semibold mb-2">Staff Salaries</h1>
      {err && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}
      <Field label="Staff Member">
        <Dropdown value={staffId} onChange={(e: any) => setStaffId(e.target.value)} className={selectClass}>
          <option value="">Select staff member...</option>
          {activeStaff.map((s: StaffMember) => (
            <option key={s.id} value={s.id}>{s.name} — {s.role} {paidThisMonth[s.id] ? "(Paid this month)" : ""}</option>
          ))}
        </Dropdown>
      </Field>

      {selectedStaff && (
        <div className="text-xs text-[var(--text-secondary)] glass rounded-lg px-3 py-2 space-y-0.5">
          <div>Role: <span className="text-[var(--text)]">{selectedStaff.role}</span></div>
          <div>CNIC: <span className="text-[var(--text)]">{selectedStaff.cnic}</span></div>
          <div>Gross monthly salary (incl. all allowances): <span className="text-champagne">{money(selectedStaff.monthly_salary)}</span></div>
        </div>
      )}

      {alreadyPaid && (
        <div className="text-yellow-400 text-sm bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
          This staff member is already marked paid for {new Date(month).toLocaleString("en-US", { month: "long", year: "numeric" })}.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Salary Month"><input value={month} onChange={(e) => setMonth(e.target.value)} type="date" required className={inputClass} /></Field>
        <Field label="Amount"><input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" step="0.01" required className={inputClass} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Payment Method">
          <Dropdown value={method} onChange={(e: any) => setMethod(e.target.value)} className={selectClass}>
            <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option>
          </Dropdown>
        </Field>
        <Field label="Payment Date"><input value={date} onChange={(e) => setDate(e.target.value)} type="date" required className={inputClass} /></Field>
      </div>
      <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} rows={2} /></Field>
      <SubmitBtn busy={busy || alreadyPaid} label={alreadyPaid ? "Already Paid This Month" : "Mark Salary Paid"} />
    </form>
  );
}

const inputClass = "w-full glass-input rounded-lg px-3 py-2 text-sm";
const selectClass = inputClass;
function Field({ label, children }: any) {
  return <div><label className="text-xs text-[var(--text-secondary)] block mb-1">{label}</label>{children}</div>;
}
function SubmitBtn({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button disabled={busy} type="submit" className="w-full btn-gold rounded-lg py-2.5 text-sm disabled:opacity-60 flex items-center justify-center gap-2">
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
    { key: "hostel", label: "Hostel Management", icon: BedDouble },
    { key: "rent", label: "Rent Management", icon: Wallet },
    { key: "income", label: "Income", icon: PlusCircle },
    { key: "expenses", label: "Expenses", icon: Receipt },
    { key: "salaries", label: "Salaries", icon: Users },
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
      {active === "hostel" && <HostelManagement core={core} show={show} profile={profile} />}
      {active === "rent" && <RentManagement core={core} />}
      {active === "income" && <IncomeView core={core} />}
      {active === "expenses" && <ExpensesView core={core} />}
      {active === "salaries" && <SalariesView core={core} show={show} profile={profile} />}
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
  const [salaries, setSalaries] = useState(0);
  useEffect(() => {
    (async () => {
      const start = monthStart();
      const [i, e, s] = await Promise.all([
        supabase.from("income_transactions").select("amount").eq("voided", false).gte("txn_date", start),
        supabase.from("expense_transactions").select("amount").eq("voided", false).gte("txn_date", start),
        supabase.from("salary_payments").select("amount").eq("voided", false).eq("salary_month", start),
      ]);
      setIncome((i.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0));
      setExpenses((e.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0));
      setSalaries((s.data || []).reduce((sum: number, r: any) => sum + Number(r.amount), 0));
    })();
  }, []);

  const netProfit = rentReceived + income - expenses - salaries;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Dashboard — {new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}</h1>
      {overdue.length > 0 && (
        <button onClick={() => setActive("rent")} className="w-full text-left glass border-red-500/30 rounded-lg p-4 fade-up hover:border-red-700">
          <div className="flex items-center gap-2 text-red-400 font-medium text-sm"><AlertTriangle size={16} className="pulse-dot" /> RENT PAYMENTS OVERDUE</div>
          <div className="text-red-300 text-sm mt-1">{overdue.length} rental payment(s) have passed the 5-day grace period.</div>
        </button>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Expected Monthly Rent" value={money(expectedRent)} />
        <Card label="Rent Received" value={money(rentReceived)} tone="green" />
        <Card label="Rent Outstanding" value={money(outstanding)} tone="red" />
        <Card label="Other Income" value={money(income)} />
        <Card label="Total Expenses" value={money(expenses)} tone="red" />
        <Card label="Staff Salaries Paid" value={money(salaries)} tone="red" />
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

  const updateStatus = async (unitId: string, status: string) => {
    const { error } = await supabase.from("units").update({ status }).eq("id", unitId);
    if (!error) core.reload();
  };

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">{category === "commercial" ? "Commercial Assets" : "Residential Assets"}</h1>
      <div className="flex gap-2 mb-4 flex-wrap">
        {assets.map((a: Asset) => (
          <button key={a.id} onClick={() => setSelected(a.id)}
            className={`px-3 py-1.5 rounded text-sm border ${selected === a.id ? "border-[var(--gold)] text-champagne" : "border-white/10 text-[var(--text-secondary)]"}`}>
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
      <div className="text-xs text-[var(--text-secondary)] mb-2">Click a unit's status to mark it occupied/vacant — occupied units become selectable in the staff rent entry form.</div>
      <div className="overflow-x-auto glass rounded-lg">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[var(--text-secondary)] text-xs border-b border-white/10">
            <th className="p-3">Unit</th><th className="p-3">Floor / Room</th><th className="p-3">Rent</th><th className="p-3">Status</th>
          </tr></thead>
          <tbody>
            {units.map((u: Unit) => (
              <tr key={u.id} className="border-b border-white/5 last:border-0">
                <td className="p-3">{u.name}</td>
                <td className="p-3 text-[var(--text-secondary)]">{[u.floor, u.room].filter(Boolean).join(" / ") || "—"}</td>
                <td className="p-3 text-champagne">{money(u.monthly_rent)}</td>
                <td className="p-3 w-40">
                  {u.unit_type === "bed" && u.status === "occupied" ? (
                    <span className="text-xs text-[var(--success)]">Occupied (Hostel Mgmt)</span>
                  ) : (
                    <Dropdown value={u.status} onChange={(e: any) => updateStatus(u.id, e.target.value)}
                      className="glass-input rounded-lg px-2 py-1 text-xs">
                      {u.unit_type !== "bed" && <option value="occupied">Occupied</option>}
                      <option value="vacant">Vacant</option>
                      <option value="reserved">Reserved</option>
                      <option value="maintenance">Maintenance</option>
                    </Dropdown>
                  )}
                </td>
              </tr>
            ))}
            {!units.length && <tr><td colSpan={4} className="p-6 text-center text-[var(--text-secondary)]">No units configured yet. Add units in Settings.</td></tr>}
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
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded text-xs border ${filter === f ? "border-[var(--gold)] text-champagne" : "border-white/10 text-[var(--text-secondary)]"}`}>{f}</button>
        ))}
      </div>
      <div className="overflow-x-auto glass rounded-lg">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[var(--text-secondary)] text-xs border-b border-white/10">
            <th className="p-3">Property</th><th className="p-3">Unit</th><th className="p-3">Tenant</th><th className="p-3">Rent</th><th className="p-3">Received</th><th className="p-3">Status</th>
          </tr></thead>
          <tbody>
            {rows.map((r: RentRow) => (
              <tr key={r.unit_id} className="border-b border-white/5 last:border-0">
                <td className="p-3">{r.property_name}</td>
                <td className="p-3">{r.unit_name}</td>
                <td className="p-3 text-[var(--text-secondary)]">{r.tenant_name || "—"}</td>
                <td className="p-3">{money(r.monthly_rent)}</td>
                <td className="p-3 text-green-400">{money(r.amount_received)}</td>
                <td className="p-3"><StatusBadge status={r.rent_status} /></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="p-6 text-center text-[var(--text-secondary)]">No units match this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function useDateRange() {
  const [range, setRange] = useState("month");
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(todayStr());
  useEffect(() => {
    const now = new Date();
    if (range === "today") { const t = fmtDate(now); setStart(t); setEnd(t); }
    else if (range === "week") { const d = new Date(now); d.setDate(d.getDate() - 7); setStart(fmtDate(d)); setEnd(fmtDate(now)); }
    else if (range === "month") { setStart(monthStart()); setEnd(fmtDate(now)); }
    else if (range === "year") { setStart(`${now.getFullYear()}-01-01`); setEnd(fmtDate(now)); }
    else if (range === "all") { setStart("2000-01-01"); setEnd(fmtDate(now)); }
  }, [range]);
  return { range, setRange, start, end, setStart, setEnd };
}

function RangePicker({ dr }: { dr: ReturnType<typeof useDateRange> }) {
  return (
    <div className="flex flex-wrap gap-2 items-center mb-4 no-print">
      {[["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["year", "This Year"], ["all", "All Time"], ["custom", "Custom"]].map(([k, l]) => (
        <button key={k} onClick={() => dr.setRange(k)} className={`px-3 py-1.5 rounded text-xs border ${dr.range === k ? "border-[var(--gold)] text-champagne" : "border-white/10 text-[var(--text-secondary)]"}`}>{l}</button>
      ))}
      {dr.range === "custom" && (
        <>
          <input type="date" value={dr.start} onChange={(e) => dr.setStart(e.target.value)} className={inputClass + " w-auto"} />
          <span className="text-[var(--text-secondary)] text-xs">to</span>
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
      <Dropdown value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)} className={selectClass + " w-auto mb-4 no-print"}>
        <option value="ALL">All Assets</option>
        {core.assets.map((a: Asset) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Dropdown>
      <div className="overflow-x-auto glass rounded-lg">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[var(--text-secondary)] text-xs border-b border-white/10">
            <th className="p-3">Date</th><th className="p-3">Asset</th><th className="p-3">Category</th><th className="p-3">Method</th><th className="p-3 text-right">Amount</th>
          </tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-white/5 last:border-0">
                <td className="p-3 text-[var(--text-secondary)]">{r.txn_date}</td>
                <td className="p-3">{r.assets?.name}</td>
                <td className="p-3">{r.income_categories?.name}</td>
                <td className="p-3 text-[var(--text-secondary)]">{r.payment_method === "cash" ? "Cash" : "Bank Transfer"}</td>
                <td className="p-3 text-right text-champagne">{money(r.amount)}</td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={5} className="p-6 text-center text-[var(--text-secondary)]">No transactions recorded yet.</td></tr>}
          </tbody>
          {filtered.length > 0 && <tfoot><tr className="border-t border-white/10"><td colSpan={4} className="p-3 text-right text-[var(--text-secondary)]">TOTAL</td><td className="p-3 text-right font-semibold text-champagne">{money(total)}</td></tr></tfoot>}
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
      <Dropdown value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)} className={selectClass + " w-auto mb-4 no-print"}>
        <option value="ALL">All Assets</option>
        {core.assets.map((a: Asset) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Dropdown>

      {Object.keys(byCategory).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          <div className="glass rounded-xl p-3 border-[var(--gold)]/50">
            <div className="text-[11px] text-gold font-semibold tracking-wide">TOTAL EXPENSES</div>
            <div className="text-sm text-[var(--danger)] font-semibold mt-1">{money(total)}</div>
          </div>
          {Object.entries(byCategory).map(([name, amt]) => (
            <div key={name} className="glass rounded p-3">
              <div className="text-[11px] text-[var(--text-secondary)]">{name}</div>
              <div className="text-sm text-champagne mt-1">{money(amt)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto glass rounded-lg">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[var(--text-secondary)] text-xs border-b border-white/10">
            <th className="p-3">Date</th><th className="p-3">Asset</th><th className="p-3">Category</th><th className="p-3">Vendor</th><th className="p-3">Method</th><th className="p-3 text-right">Amount</th><th className="p-3 no-print">Receipt</th>
          </tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-white/5 last:border-0">
                <td className="p-3 text-[var(--text-secondary)]">{r.txn_date}</td>
                <td className="p-3">{r.assets?.name}</td>
                <td className="p-3">{r.expense_categories?.name}</td>
                <td className="p-3 text-[var(--text-secondary)]">{r.paid_to || "—"}</td>
                <td className="p-3 text-[var(--text-secondary)]">{r.payment_method === "cash" ? "Cash" : "Bank Transfer"}</td>
                <td className="p-3 text-right text-red-400">{money(r.amount)}</td>
                <td className="p-3 no-print">{r.receipt_path ? <button onClick={() => viewReceipt(r.receipt_path)} className="text-gold text-xs underline">View</button> : "—"}</td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} className="p-6 text-center text-[var(--text-secondary)]">No transactions recorded yet.</td></tr>}
          </tbody>
          {filtered.length > 0 && <tfoot><tr className="border-t border-white/10"><td colSpan={5} className="p-3 text-right text-[var(--text-secondary)]">TOTAL EXPENSES</td><td className="p-3 text-right font-semibold text-red-400">{money(total)}</td><td className="no-print" /></tr></tfoot>}
        </table>
      </div>
    </div>
  );
}

function SalariesView({ core, show, profile }: any) {
  const [monthPaidMap, setMonthPaidMap] = useState<Record<string, any>>({});
  const [name, setName] = useState("");
  const [cnic, setCnic] = useState("");
  const [role, setRole] = useState("");
  const [salary, setSalary] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSalary, setEditSalary] = useState("");
  const [editingPayment, setEditingPayment] = useState<any>(null);

  const month = monthStart();

  const loadPaidStatus = useCallback(async () => {
    const { data } = await supabase.from("salary_payments").select("*, staff_members(name)").eq("salary_month", month).eq("voided", false).order("payment_date", { ascending: false });
    const map: Record<string, any> = {};
    (data || []).forEach((r: any) => (map[r.staff_id] = r));
    setMonthPaidMap(map);
  }, [month]);

  useEffect(() => { loadPaidStatus(); }, [loadPaidStatus, core.staffMembers.length]);

  const totalPayroll = core.staffMembers.filter((s: StaffMember) => s.is_active).reduce((sum: number, s: StaffMember) => sum + Number(s.monthly_salary), 0);
  const totalPaid = Object.values(monthPaidMap).reduce((sum: number, r: any) => sum + Number(r.amount), 0);
  const totalUnpaid = Math.max(0, totalPayroll - totalPaid);

  const addStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim() || !salary || Number(salary) <= 0) return;
    setBusy(true);
    const { error } = await supabase.from("staff_members").insert({
      name: name.trim(), cnic: cnic.trim() || "N/A", role: role.trim(), monthly_salary: Number(salary),
    });
    setBusy(false);
    if (error) { show(error.message, "err"); return; }
    show("Staff member added.");
    setName(""); setCnic(""); setRole(""); setSalary("");
    core.reload();
  };

  const saveSalary = async (staffId: string) => {
    if (!editSalary || Number(editSalary) <= 0) return;
    const { error } = await supabase.from("staff_members").update({ monthly_salary: Number(editSalary) }).eq("id", staffId);
    if (error) { show(error.message, "err"); return; }
    show("Salary updated.");
    setEditingId(null);
    core.reload();
  };

  const toggleActive = async (staffId: string, isActive: boolean) => {
    const { error } = await supabase.from("staff_members").update({ is_active: !isActive }).eq("id", staffId);
    if (!error) { show(isActive ? "Marked inactive." : "Marked active."); core.reload(); }
  };

  const saveEditedPayment = async () => {
    if (!editingPayment) return;
    const { error } = await supabase.from("salary_payments").update({
      amount: Number(editingPayment.amount),
      payment_method: editingPayment.payment_method,
      payment_date: editingPayment.payment_date,
      notes: editingPayment.notes || null,
      updated_by: profile.id,
    }).eq("id", editingPayment.id);
    if (error) { show(error.message, "err"); return; }
    show("Payment updated.");
    setEditingPayment(null);
    loadPaidStatus();
  };

  const voidPayment = async (id: string) => {
    const { error } = await supabase.from("salary_payments").update({ voided: true }).eq("id", id);
    if (error) { show(error.message, "err"); return; }
    show("Payment voided — it no longer counts toward totals.");
    setEditingPayment(null);
    loadPaidStatus();
  };

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Staff Salaries</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <Card label={`Payroll — ${new Date(month).toLocaleString("en-US", { month: "long", year: "numeric" })}`} value={money(totalPayroll)} />
        <Card label="Paid This Month" value={money(totalPaid)} tone="green" />
        <Card label="Unpaid This Month" value={money(totalUnpaid)} tone="red" />
      </div>

      <div className="glass rounded-lg p-4 mb-6 fade-up">
        <div className="text-sm text-[var(--text-secondary)] mb-3">Add a staff member</div>
        <form onSubmit={addStaff} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required className={inputClass} />
          <input value={cnic} onChange={(e) => setCnic(e.target.value)} placeholder="CNIC (or leave blank for N/A)" className={inputClass} />
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role / Designation" required className={inputClass} />
          <input value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="Gross monthly salary" type="number" min="1" required className={inputClass} />
          <div className="col-span-2 md:col-span-4"><SubmitBtn busy={busy} label="Add Staff Member" /></div>
        </form>
      </div>

      <div className="overflow-x-auto glass rounded-lg">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[var(--text-secondary)] text-xs border-b border-white/10">
            <th className="p-3">Name</th><th className="p-3">CNIC</th><th className="p-3">Role</th>
            <th className="p-3">Gross Salary</th><th className="p-3">This Month</th><th className="p-3">Active</th>
          </tr></thead>
          <tbody>
            {core.staffMembers.map((s: StaffMember) => {
              const paidRow = monthPaidMap[s.id];
              return (
                <tr key={s.id} className="border-b border-white/5 last:border-0">
                  <td className="p-3">{s.name}{s.code ? <span className="text-[var(--text-secondary)] text-xs ml-1">({s.code})</span> : null}</td>
                  <td className="p-3 text-[var(--text-secondary)]">{s.cnic}</td>
                  <td className="p-3 text-[var(--text-secondary)]">{s.role}</td>
                  <td className="p-3">
                    {editingId === s.id ? (
                      <div className="flex items-center gap-2">
                        <input value={editSalary} onChange={(e) => setEditSalary(e.target.value)} type="number" className="w-28 glass-input rounded-lg px-2 py-1 text-xs" />
                        <button type="button" onClick={() => saveSalary(s.id)} className="text-xs text-gold underline">Save</button>
                        <button type="button" onClick={() => setEditingId(null)} className="text-xs text-[var(--text-secondary)]">Cancel</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { setEditingId(s.id); setEditSalary(String(s.monthly_salary)); }} className="text-champagne hover:underline">
                        {money(s.monthly_salary)}
                      </button>
                    )}
                  </td>
                  <td className="p-3">
                    {paidRow ? (
                      <button type="button" onClick={() => setEditingPayment({ ...paidRow })} className="hover:opacity-80">
                        <StatusBadge status="PAID" />
                      </button>
                    ) : (
                      <StatusBadge status="OVERDUE" label="UNPAID" />
                    )}
                  </td>
                  <td className="p-3">
                    <button type="button" onClick={() => toggleActive(s.id, s.is_active)}
                      className={`text-xs px-2 py-1 rounded-lg border ${s.is_active ? "border-[var(--success)]/40 text-[var(--success)]" : "border-white/10 text-[var(--text-secondary)]"}`}>
                      {s.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!core.staffMembers.length && <tr><td colSpan={6} className="p-6 text-center text-[var(--text-secondary)]">No staff members added yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-[var(--text-secondary)] mt-3">Click a "PAID" badge above to correct that payment's amount, method, date, or notes — or void it if it was recorded by mistake.</div>

      {editingPayment && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingPayment(null)}>
          <div className="glass-strong rounded-2xl p-6 w-full max-w-sm fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Edit Salary Payment — {editingPayment.staff_members?.name}</h3>
              <button onClick={() => setEditingPayment(null)}><X size={16} className="text-[var(--text-secondary)]" /></button>
            </div>
            <div className="space-y-3">
              <Field label="Amount">
                <input value={editingPayment.amount} onChange={(e) => setEditingPayment({ ...editingPayment, amount: e.target.value })} type="number" className={inputClass} />
              </Field>
              <Field label="Payment Method">
                <Dropdown value={editingPayment.payment_method} onChange={(e: any) => setEditingPayment({ ...editingPayment, payment_method: e.target.value })} className={selectClass}>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </Dropdown>
              </Field>
              <Field label="Payment Date">
                <input value={editingPayment.payment_date} onChange={(e) => setEditingPayment({ ...editingPayment, payment_date: e.target.value })} type="date" className={inputClass} />
              </Field>
              <Field label="Notes">
                <textarea value={editingPayment.notes || ""} onChange={(e) => setEditingPayment({ ...editingPayment, notes: e.target.value })} className={inputClass} rows={2} />
              </Field>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={saveEditedPayment} className="flex-1 btn-gold rounded-lg py-2 text-sm">Save Changes</button>
                <button type="button" onClick={() => voidPayment(editingPayment.id)} className="px-3 rounded-lg border border-red-500/40 text-red-400 text-sm hover:bg-red-500/10">Void</button>
              </div>
            </div>
          </div>
        </div>
      )}
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
      <Dropdown value={selected} onChange={(e) => setSelected(e.target.value)} className={selectClass + " w-auto mb-4 no-print"}>
        <option value="ALL">All Assets (combined)</option>
        {core.assets.map((a: Asset) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Dropdown>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <Card label="Total Income" value={money(totalIncome)} tone="green" />
        <Card label="Total Expenses" value={money(totalExpenses)} tone="red" />
        <Card label="Net Profit" value={money(totalIncome - totalExpenses)} tone={totalIncome - totalExpenses >= 0 ? "green" : "red"} />
        <Card label="Expected Rent" value={money(expectedRent)} />
        <Card label="Rent Received" value={money(rentReceived)} tone="green" />
        <Card label="Rent Outstanding" value={money(Math.max(0, expectedRent - rentReceived))} tone="red" />
      </div>
      <div className="overflow-x-auto glass rounded-lg">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[var(--text-secondary)] text-xs border-b border-white/10">
            <th className="p-3">Asset</th><th className="p-3 text-right">Expected Rent</th><th className="p-3 text-right">Rent Received</th><th className="p-3 text-right">Other Income</th><th className="p-3 text-right">Expenses</th><th className="p-3 text-right">Net Profit</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.asset_id} className="border-b border-white/5 last:border-0">
                <td className="p-3">{r.asset_name}</td>
                <td className="p-3 text-right">{money(r.expected_rent_this_month)}</td>
                <td className="p-3 text-right text-green-400">{money(r.rent_received_this_month)}</td>
                <td className="p-3 text-right">{money(r.total_other_income)}</td>
                <td className="p-3 text-right text-red-400">{money(r.total_expenses)}</td>
                <td className="p-3 text-right text-champagne">{money(r.rent_received_this_month + r.total_other_income - r.total_expenses)}</td>
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
  const [salaries, setSalaries] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const [i, e, s] = await Promise.all([
        supabase.from("income_transactions").select("amount, assets(name)").eq("voided", false).gte("txn_date", dr.start).lte("txn_date", dr.end),
        supabase.from("expense_transactions").select("amount, assets(name)").eq("voided", false).gte("txn_date", dr.start).lte("txn_date", dr.end),
        supabase.from("salary_payments").select("amount").eq("voided", false).gte("payment_date", dr.start).lte("payment_date", dr.end),
      ]);
      setIncome(i.data || []); setExpenses(e.data || []); setSalaries(s.data || []);
    })();
  }, [dr.start, dr.end]);

  const expectedRent = core.rentStatus.filter((r: RentRow) => r.unit_status === "occupied").reduce((s: number, r: RentRow) => s + Number(r.monthly_rent), 0);
  const rentReceived = core.rentStatus.reduce((s: number, r: RentRow) => s + Number(r.amount_received), 0);
  const totalIncome = income.reduce((s, r) => s + Number(r.amount), 0);
  const totalExpenses = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const totalSalaries = salaries.reduce((s, r) => s + Number(r.amount), 0);
  const netProfit = rentReceived + totalIncome - totalExpenses - totalSalaries;
  const collectionRate = expectedRent > 0 ? ((rentReceived / expectedRent) * 100).toFixed(1) : "0";

  return (
    <div className="print-area">
      <div className="flex items-center justify-between mb-4 no-print">
        <h1 className="text-lg font-semibold">Reports</h1>
        <button onClick={() => window.print()} className="flex items-center gap-2 btn-gold text-sm px-3 py-1.5 rounded-lg"><Printer size={14} /> Print</button>
      </div>
      <RangePicker dr={dr} />
      <div className="text-center mb-6 border-b border-white/10 pb-4">
        <div className="text-xs tracking-widest text-gold">K&amp;J CHESHTI PROPERTIES</div>
        <div className="text-sm text-[var(--text-secondary)]">Property &amp; Financial Management System</div>
        <div className="text-xs text-[var(--text-secondary)] mt-1">Financial Report: {dr.start} to {dr.end}</div>
        <div className="text-[11px] text-gray-600">Generated {new Date().toLocaleString()}</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card label="Expected Rent" value={money(expectedRent)} />
        <Card label="Rent Received" value={money(rentReceived)} tone="green" />
        <Card label="Collection Rate" value={collectionRate + "%"} />
        <Card label="Rental + Other Income" value={money(rentReceived + totalIncome)} tone="green" />
        <Card label="Total Expenses" value={money(totalExpenses)} tone="red" />
        <Card label="Staff Salaries Paid" value={money(totalSalaries)} tone="red" />
        <Card label="Net Profit" value={money(netProfit)} tone={netProfit >= 0 ? "green" : "red"} />
      </div>
      <HostelProgress core={core} />
      <div className="text-sm text-[var(--text-secondary)]">Use the Income and Expenses tabs for detailed, filterable transaction lists — this summary is optimized for printing.</div>
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
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded text-xs border ${tab === t ? "border-[var(--gold)] text-champagne" : "border-white/10 text-[var(--text-secondary)]"}`}>
            {t === "categories" ? "Categories" : t === "hostel" ? "Hostel Setup" : "Rent Rules"}
          </button>
        ))}
      </div>

      {tab === "categories" && (
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
          <div>
            <h2 className="text-sm text-[var(--text-secondary)] mb-2">Expense Categories</h2>
            <div className="space-y-1 mb-3">{core.expenseCats.map((c: Category) => <div key={c.id} className="text-sm glass rounded px-3 py-1.5">{c.name}</div>)}</div>
            <div className="flex gap-2">
              <input value={newExpCat} onChange={(e) => setNewExpCat(e.target.value)} className={inputClass} placeholder="New category" />
              <button onClick={() => addCategory("expense_categories", newExpCat, () => setNewExpCat(""))} className="btn-gold text-sm px-3 rounded-lg shrink-0">Add</button>
            </div>
          </div>
          <div>
            <h2 className="text-sm text-[var(--text-secondary)] mb-2">Income Categories</h2>
            <div className="space-y-1 mb-3">{core.incomeCats.map((c: Category) => <div key={c.id} className="text-sm glass rounded px-3 py-1.5">{c.name}</div>)}</div>
            <div className="flex gap-2">
              <input value={newIncCat} onChange={(e) => setNewIncCat(e.target.value)} className={inputClass} placeholder="New category" />
              <button onClick={() => addCategory("income_categories", newIncCat, () => setNewIncCat(""))} className="btn-gold text-sm px-3 rounded-lg shrink-0">Add</button>
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
          <button onClick={() => { saveSetting("rent_due_day", dueDay); saveSetting("grace_period_days", gracePeriod); }} className="btn-gold text-sm px-4 py-2 rounded-lg">Save</button>
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

  const updateBedStatus = async (bedId: string, status: string) => {
    const { error } = await supabase.from("units").update({ status }).eq("id", bedId);
    if (!error) core.reload();
  };

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
      <div className="text-sm text-[var(--text-secondary)] mb-3">
        Barkat Market Heights Boys Hostel: 3 floors, 15 rooms per floor (101–115, 201–215, 301–315). Beds are named A, B, C… per room and start as vacant — beds only become occupied when a student is enrolled in the Hostel Management tab. Use this form only if you ever need to add an extra bed.
      </div>
      <form onSubmit={addBed} className="grid grid-cols-2 gap-3 glass rounded-lg p-4 mb-6">
        <Field label="Floor"><input value={floor} onChange={(e) => setFloor(e.target.value)} className={inputClass} placeholder="e.g. 3rd Floor" required /></Field>
        <Field label="Room"><input value={room} onChange={(e) => setRoom(e.target.value)} className={inputClass} placeholder="e.g. 301" required /></Field>
        <Field label="Bed Label"><input value={bedLabel} onChange={(e) => setBedLabel(e.target.value)} className={inputClass} placeholder="e.g. Bed 2" required /></Field>
        <Field label="Room Type">
          <Dropdown value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)} className={selectClass} required>
            <option value="">Select...</option>
            {core.roomTypes.map((rt: RoomType) => <option key={rt.id} value={rt.id}>{rt.name} — {money(rt.monthly_rent)}</option>)}
          </Dropdown>
        </Field>
        <div className="col-span-2"><SubmitBtn busy={busy} label="Add Bed" /></div>
      </form>
      <div className="text-sm text-[var(--text-secondary)] mb-2">{beds.length} beds configured</div>
      <div className="overflow-x-auto glass rounded-lg">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[var(--text-secondary)] text-xs border-b border-white/10"><th className="p-3">Floor</th><th className="p-3">Room</th><th className="p-3">Bed</th><th className="p-3">Type</th><th className="p-3">Rent</th><th className="p-3">Status</th></tr></thead>
          <tbody>
            {beds.map((b: Unit) => {
              const rt = core.roomTypes.find((r: RoomType) => r.id === b.room_type_id);
              return (
                <tr key={b.id} className="border-b border-white/5 last:border-0">
                  <td className="p-3">{b.floor}</td><td className="p-3">{b.room}</td><td className="p-3">{b.name.split("— ")[1]}</td>
                  <td className="p-3">{rt?.name}</td><td className="p-3">{money(b.monthly_rent)}</td>
                  <td className="p-3 w-40">
                    {b.status === "occupied" ? (
                      <span className="text-xs text-[var(--success)]">Occupied (Hostel Mgmt)</span>
                    ) : (
                      <Dropdown value={b.status} onChange={(e: any) => updateBedStatus(b.id, e.target.value)}
                        className="glass-input rounded-lg px-2 py-1 text-xs">
                        <option value="vacant">Vacant</option>
                        <option value="reserved">Reserved</option>
                        <option value="maintenance">Maintenance</option>
                      </Dropdown>
                    )}
                  </td>
                </tr>
              );
            })}
            {!beds.length && <tr><td colSpan={6} className="p-6 text-center text-[var(--text-secondary)]">No beds configured yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// REPORTS: HOSTEL PROGRESS (actual vs ideal 70% occupancy target)
// ---------------------------------------------------------------------------
const IDEAL_OCCUPANCY = 0.7;
const IDEAL_DUE_INDEX = 2027 * 12 + 2; // March 2027

function HostelProgress({ core }: any) {
  const hostel = core.assets.find((a: Asset) => a.name.includes("Boys Hostel"));
  const beds: Unit[] = core.units.filter((u: Unit) => u.asset_id === hostel?.id && u.unit_type === "bed");
  if (!beds.length) return null;

  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b) => b.status === "occupied");
  const actualRent = occupiedBeds.reduce((sum, b) => sum + Number(b.monthly_rent), 0);
  const potentialRent = beds.reduce((sum, b) => {
    const rt = core.roomTypes.find((r: RoomType) => r.id === b.room_type_id);
    return sum + Number(rt ? rt.monthly_rent : b.monthly_rent);
  }, 0);
  const actualPct = (occupiedBeds.length / totalBeds) * 100;
  const idealBeds = Math.ceil(totalBeds * IDEAL_OCCUPANCY);
  const idealRent = Math.round(potentialRent * IDEAL_OCCUPANCY);
  const monthsLeft = IDEAL_DUE_INDEX - nowMonthIndex();
  const bedsToGo = Math.max(0, idealBeds - occupiedBeds.length);
  const rentToGo = Math.max(0, idealRent - actualRent);
  const perMonth = monthsLeft > 0 ? Math.ceil(bedsToGo / monthsLeft) : bedsToGo;
  const progressPct = Math.min(100, (occupiedBeds.length / idealBeds) * 100);

  return (
    <div className="mb-6">
      <div className="text-xs tracking-widest text-gold mb-3">HOSTEL PROGRESS — BARKAT MARKET HEIGHTS BOYS HOSTEL</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5">
          <div className="text-sm font-semibold text-champagne mb-4">ACTUAL</div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">Bed occupancy</div>
          <div className="text-2xl font-semibold mt-1">{occupiedBeds.length} <span className="text-base text-[var(--text-secondary)]">out of {totalBeds} beds</span></div>
          <div className="text-sm text-champagne mt-0.5">{actualPct.toFixed(1)}% occupied</div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)] mt-5">Monthly rent from occupied beds</div>
          <div className="text-xl font-semibold mt-1 text-[var(--success)]">{money(actualRent)}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">out of {money(potentialRent)} if all {totalBeds} beds are occupied</div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-sm font-semibold text-champagne mb-4">IDEAL — {Math.round(IDEAL_OCCUPANCY * 100)}% OCCUPANCY</div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">Ideal bed occupancy</div>
          <div className="text-2xl font-semibold mt-1">{idealBeds} <span className="text-base text-[var(--text-secondary)]">out of {totalBeds} beds</span></div>
          <div className="text-sm text-champagne mt-0.5">{Math.round(IDEAL_OCCUPANCY * 100)}% occupied</div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)] mt-5">Ideal monthly rent at {Math.round(IDEAL_OCCUPANCY * 100)}% occupancy</div>
          <div className="text-xl font-semibold mt-1 text-champagne">{money(idealRent)}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Due date: <span className="text-white font-medium">March 2027</span></div>
        </div>
      </div>
      <div className="glass rounded-xl p-4 mt-4">
        <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-2">
          <span>Progress toward ideal occupancy</span><span>{progressPct.toFixed(0)}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full btn-gold" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="text-xs text-[var(--text-secondary)] mt-3">
          {bedsToGo > 0
            ? `${bedsToGo} more bed${bedsToGo === 1 ? "" : "s"} (${money(rentToGo)}/month more rent) needed to reach the ideal. ${
                monthsLeft > 0 ? `${monthsLeft} month${monthsLeft === 1 ? "" : "s"} left — about ${perMonth} admission${perMonth === 1 ? "" : "s"} per month required.` : "The March 2027 due date has passed."
              }`
            : "The ideal occupancy target has been reached."}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// HOSTEL MANAGEMENT SYSTEM
// ===========================================================================
type HostelStudent = {
  id: string; student_code: string; name: string; unit_id: string | null; join_date: string;
  guardian_name: string | null; guardian_phone: string | null; student_phone: string | null; cnic: string | null;
  monthly_rent: number; security_deposit: number; contract_signed: boolean; police_verification: boolean;
  notes: string | null; status: "active" | "left"; left_date: string | null; created_at: string;
};

const ymIndex = (d: string) => {
  const [y, m] = d.slice(0, 10).split("-").map(Number);
  return y * 12 + (m - 1);
};
const monthKeyFromIndex = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`;
const nowMonthIndex = () => { const n = new Date(); return n.getFullYear() * 12 + n.getMonth(); };
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
};
const shortMonthLabel = (i: number) =>
  new Date(Math.floor(i / 12), i % 12, 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
const bedLetter = (u: Unit) => (u.name.includes("Bed ") ? u.name.split("Bed ")[1] : u.name);
const bedFullLabel = (u: Unit) => `${u.floor} · Room ${u.room} · Bed ${bedLetter(u)}`;
const roomSort = (a: string, b: string) => Number(a) - Number(b);

// Month-by-month rent ledger for a student: rent is billed every month from the join month
function buildLedger(s: HostelStudent, pays: any[]) {
  const startIdx = ymIndex(s.join_date);
  const nowIdx = nowMonthIndex();
  const endIdx = s.status === "left" && s.left_date ? Math.min(ymIndex(s.left_date), nowIdx) : nowIdx;
  const mine = pays.filter((p) => p.student_id === s.id && !p.voided);
  const rows: { month: string; due: number; paid: number; balance: number }[] = [];
  for (let i = startIdx; i <= endIdx; i++) {
    const paid = mine.filter((p) => ymIndex(p.rent_month) === i).reduce((t, p) => t + Number(p.amount), 0);
    rows.push({ month: monthKeyFromIndex(i), due: Number(s.monthly_rent), paid, balance: Number(s.monthly_rent) - paid });
  }
  const totalDue = rows.reduce((t, r) => t + r.due, 0);
  const totalPaid = mine.reduce((t, p) => t + Number(p.amount), 0);
  return { rows, totalDue, totalPaid, outstanding: Math.max(0, totalDue - totalPaid) };
}

function Modal({ title, onClose, children, wide = false, lockBackdrop = false }: any) {
  return (
    <div className="fixed inset-0 z-[900] flex items-start sm:items-center justify-center bg-black/70 p-3 overflow-y-auto no-print"
      onMouseDown={() => { if (!lockBackdrop) onClose(); }}>
      <div className={`glass-strong rounded-2xl p-5 sm:p-6 w-full ${wide ? "max-w-3xl" : "max-w-md"} my-4 fade-up`}
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="flex items-center gap-1 text-sm text-[var(--text-secondary)] border border-white/15 rounded-lg px-3 py-1.5 hover:text-white">
            Close <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function HostelManagement({ core, show, profile }: any) {
  const [sub, setSub] = useState<"overview" | "students" | "growth">("overview");
  const [students, setStudents] = useState<HostelStudent[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [presetBed, setPresetBed] = useState("");
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);

  const hostelAsset = core.assets.find((a: Asset) => a.name.includes("Boys Hostel"));
  const beds: Unit[] = useMemo(
    () => core.units.filter((u: Unit) => u.asset_id === hostelAsset?.id && u.unit_type === "bed"),
    [core.units, hostelAsset?.id]
  );

  const loadAll = useCallback(async () => {
    const [s, p] = await Promise.all([
      supabase.from("hostel_students").select("*").order("student_code"),
      supabase.from("rent_payments").select("*").not("student_id", "is", null).order("payment_date", { ascending: false }),
    ]);
    if (s.error) show("Could not load students: " + s.error.message, "err");
    setStudents((s.data as any) || []);
    setPayments(p.data || []);
    setLoaded(true);
  }, []); // eslint-disable-line

  useEffect(() => { loadAll(); }, [loadAll]);

  const refresh = async () => { await Promise.all([loadAll(), core.reload()]); };

  const openAdd = (bedId = "") => { setPresetBed(bedId); setAddOpen(true); };
  const openStudent = students.find((s) => s.id === openStudentId);

  if (!loaded) return <div className="text-[var(--text-secondary)] flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Loading hostel...</div>;

  if (openStudent) {
    return (
      <StudentProfile
        student={openStudent} beds={beds} payments={payments} profile={profile} show={show}
        onBack={() => setOpenStudentId(null)} onChanged={refresh}
      />
    );
  }

  const tabs: [typeof sub, string][] = [
    ["overview", "Dashboard"],
    ["students", `Enrolled Students (${students.filter((s) => s.status === "active").length})`],
    ["growth", "Growth Report"],
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-lg font-semibold">Hostel Management</h1>
        <button type="button" onClick={() => openAdd()} className="btn-gold rounded-lg px-4 py-2 text-sm flex items-center gap-2">
          <UserPlus size={16} /> Add Student
        </button>
      </div>
      <div className="text-xs text-[var(--text-secondary)] mb-4">Barkat Market Heights — Boys Hostel</div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setSub(k)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${sub === k ? "border-[var(--gold)] text-champagne bg-[var(--gold)]/10" : "border-white/10 text-[var(--text-secondary)] hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>

      {!beds.length ? (
        <div className="glass rounded-xl p-6 text-sm text-[var(--text-secondary)]">
          No hostel beds found. Run the hostel SQL update in Supabase first (see UPDATE_GUIDE) — it creates all rooms and beds.
        </div>
      ) : (
        <>
          {sub === "overview" && <HostelOverview beds={beds} students={students} roomTypes={core.roomTypes} onAddBed={openAdd} onOpenStudent={setOpenStudentId} />}
          {sub === "students" && <HostelStudentsList students={students} beds={beds} payments={payments} onOpen={setOpenStudentId} />}
          {sub === "growth" && <HostelGrowth beds={beds} students={students} payments={payments} roomTypes={core.roomTypes} />}
        </>
      )}

      {addOpen && (
        <AddStudentModal
          beds={beds} students={students} presetBedId={presetBed} show={show}
          onClose={() => setAddOpen(false)}
          onDone={async () => { setAddOpen(false); await refresh(); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DASHBOARD: every room with its beds, filterable All / Vacant / Occupied
// ---------------------------------------------------------------------------
function HostelOverview({ beds, students, roomTypes, onAddBed, onOpenStudent }: any) {
  const [filter, setFilter] = useState<"all" | "vacant" | "occupied">("all");

  const activeByUnit: Record<string, HostelStudent> = {};
  students.filter((s: HostelStudent) => s.status === "active" && s.unit_id).forEach((s: HostelStudent) => { activeByUnit[s.unit_id as string] = s; });

  const total = beds.length;
  const occupied = beds.filter((b: Unit) => b.status === "occupied").length;
  const vacant = beds.filter((b: Unit) => b.status === "vacant").length;
  const actualRent = beds.filter((b: Unit) => b.status === "occupied").reduce((t: number, b: Unit) => t + Number(b.monthly_rent), 0);
  const potentialRent = beds.reduce((t: number, b: Unit) => {
    const rt = roomTypes.find((r: RoomType) => r.id === b.room_type_id);
    return t + Number(rt ? rt.monthly_rent : b.monthly_rent);
  }, 0);

  const floors: Record<string, Record<string, Unit[]>> = {};
  beds.forEach((b: Unit) => {
    const f = b.floor || "—"; const r = b.room || "—";
    if (!floors[f]) floors[f] = {};
    if (!floors[f][r]) floors[f][r] = [];
    floors[f][r].push(b);
  });

  const match = (b: Unit) => filter === "all" || (filter === "vacant" ? b.status === "vacant" : b.status === "occupied");

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Card label="Total Beds" value={String(total)} />
        <Card label="Occupied" value={String(occupied)} tone="green" />
        <Card label="Vacant" value={String(vacant)} tone="gray" />
        <Card label="Occupancy" value={total ? ((occupied / total) * 100).toFixed(1) + "%" : "0%"} />
        <Card label="Monthly Rent (Occupied)" value={money(actualRent)} tone="green" />
        <Card label="Rent if Full" value={money(potentialRent)} />
      </div>

      <div className="flex gap-2 mb-5 flex-wrap items-center">
        {([["all", `All beds (${total})`], ["vacant", `Vacant (${vacant})`], ["occupied", `Occupied (${occupied})`]] as [typeof filter, string][]).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${filter === k ? "border-[var(--gold)] text-champagne bg-[var(--gold)]/10" : "border-white/10 text-[var(--text-secondary)]"}`}>
            {label}
          </button>
        ))}
        <span className="text-xs text-[var(--text-secondary)] ml-1">Tap a vacant bed to admit a student · tap an occupied bed to open the student&apos;s profile</span>
      </div>

      {Object.keys(floors).sort().map((floor) => {
        const rooms = floors[floor];
        const floorBeds: Unit[] = Object.values(rooms).flat();
        const floorOcc = floorBeds.filter((b) => b.status === "occupied").length;
        const visibleRooms = Object.keys(rooms).sort(roomSort).filter((r) => rooms[r].some(match));
        return (
          <div key={floor} className="mb-7">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-champagne">{floor}</h2>
              <span className="text-xs text-[var(--text-secondary)]">{floorOcc} / {floorBeds.length} beds occupied</span>
            </div>
            {!visibleRooms.length ? (
              <div className="text-sm text-[var(--text-secondary)] glass rounded-xl p-4">No {filter} beds on this floor.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {visibleRooms.map((room) => {
                  const roomBeds = [...rooms[room]].sort((a, b) => a.name.localeCompare(b.name));
                  const rt = roomTypes.find((r: RoomType) => r.id === roomBeds[0].room_type_id);
                  const occ = roomBeds.filter((b) => b.status === "occupied").length;
                  return (
                    <div key={room} className="glass rounded-xl p-4 fade-up">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-semibold">Room {room}</div>
                        <div className="text-[11px] text-[var(--text-secondary)]">{roomBeds.length} beds · {rt ? `${rt.name} · ${money(rt.monthly_rent)}` : ""}</div>
                      </div>
                      <div className="space-y-1.5">
                        {roomBeds.filter(match).map((b) => {
                          const st = activeByUnit[b.id];
                          const isOcc = b.status === "occupied";
                          const isVac = b.status === "vacant";
                          return (
                            <button key={b.id} type="button"
                              onClick={() => { if (st) onOpenStudent(st.id); else if (isVac) onAddBed(b.id); }}
                              className={`w-full text-left rounded-lg px-3 py-2 text-xs border flex items-center justify-between gap-2 transition-colors ${
                                isOcc ? "border-[var(--success)]/40 bg-[var(--success)]/10 hover:bg-[var(--success)]/15"
                                : isVac ? "border-white/15 bg-white/5 text-[var(--text-secondary)] hover:border-[var(--gold)]/60 hover:text-white"
                                : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300 cursor-default"
                              }`}>
                              <span className="font-medium">Bed {bedLetter(b)}</span>
                              <span className="truncate">
                                {isOcc ? (st ? `${st.name} (${st.student_code})` : "Occupied") : isVac ? "Vacant · + Add student" : b.status}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)] mt-2">{occ} of {roomBeds.length} occupied</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADD STUDENT
// ---------------------------------------------------------------------------
function AddStudentModal({ beds, students, presetBedId, show, onClose, onDone }: any) {
  const vacantBeds: Unit[] = beds
    .filter((b: Unit) => b.status === "vacant")
    .sort((a: Unit, b: Unit) => Number(a.room) - Number(b.room) || a.name.localeCompare(b.name));

  const presetBed = vacantBeds.find((b) => b.id === presetBedId);
  const [name, setName] = useState("");
  const [bedId, setBedId] = useState(presetBed ? presetBed.id : "");
  const [joinDate, setJoinDate] = useState(todayStr());
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [cnic, setCnic] = useState("");
  const [rent, setRent] = useState(presetBed ? String(presetBed.monthly_rent) : "25000");
  const [deposit, setDeposit] = useState("2000");
  const [contract, setContract] = useState("no");
  const [police, setPolice] = useState("no");
  const [notes, setNotes] = useState("");
  const [recordRent, setRecordRent] = useState(true);
  const [method, setMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const maxCode = students.reduce((m: number, s: HostelStudent) => Math.max(m, parseInt((s.student_code || "").replace(/\D/g, ""), 10) || 0), 0);
  const nextCode = "BMH" + String(maxCode + 1).padStart(2, "0");

  const pickBed = (id: string) => {
    setBedId(id);
    const b = vacantBeds.find((x) => x.id === id);
    if (b) setRent(String(b.monthly_rent));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) { setErr("Student name is required."); return; }
    if (!bedId) { setErr("Please select a vacant bed."); return; }
    if (!rent || Number(rent) <= 0) { setErr("Monthly rent must be greater than zero."); return; }
    if (!joinDate) { setErr("Please select the join date."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("hostel_enroll_student", {
      p_name: name.trim(), p_unit_id: bedId, p_join_date: joinDate,
      p_guardian_name: guardianName.trim() || null, p_guardian_phone: guardianPhone.trim() || null,
      p_student_phone: studentPhone.trim() || null, p_cnic: cnic.trim() || null,
      p_monthly_rent: Number(rent), p_security_deposit: Number(deposit || 0),
      p_contract_signed: contract === "yes", p_police_verification: police === "yes",
      p_notes: notes.trim() || null, p_record_first_rent: recordRent, p_payment_method: method,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    show(`${name.trim()} enrolled as ${nextCode}.`);
    onDone();
  };

  return (
    <Modal title="New student" onClose={onClose} wide lockBackdrop>
      <form onSubmit={submit} className="space-y-4">
        {err && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}
        <Field label="Student name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoFocus />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Room / bed (vacant only)">
            <Dropdown value={bedId} onChange={(e: any) => pickBed(e.target.value)} className={selectClass}>
              <option value="">— select bed —</option>
              {vacantBeds.map((b) => (
                <option key={b.id} value={b.id}>{bedFullLabel(b)} — {money(b.monthly_rent)}</option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Staying since (join date)">
            <input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Guardian name">
            <input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Guardian phone">
            <input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Student phone">
            <input value={studentPhone} onChange={(e) => setStudentPhone(e.target.value)} className={inputClass} />
          </Field>
          <Field label="CNIC">
            <input value={cnic} onChange={(e) => setCnic(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Monthly rent (Rs)">
            <input type="number" min="1" value={rent} onChange={(e) => setRent(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Security deposit (Rs)">
            <input type="number" min="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Contract signed">
            <Dropdown value={contract} onChange={(e: any) => setContract(e.target.value)} className={selectClass}>
              <option value="no">No</option><option value="yes">Yes</option>
            </Dropdown>
          </Field>
          <Field label="Police verification">
            <Dropdown value={police} onChange={(e: any) => setPolice(e.target.value)} className={selectClass}>
              <option value="no">No</option><option value="yes">Yes</option>
            </Dropdown>
          </Field>
        </div>
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClass} />
        </Field>

        <div className="glass rounded-xl p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={recordRent} onChange={(e) => setRecordRent(e.target.checked)} className="accent-[#d4af37] w-4 h-4" />
            Rent is taken in advance — record the first month&apos;s rent ({monthLabel(joinDate ? joinDate.slice(0, 7) + "-01" : monthStart())}) as received now
          </label>
          {recordRent && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount received">
                <div className={inputClass + " opacity-80"}>{money(Number(rent || 0))}</div>
              </Field>
              <Field label="Payment method">
                <Dropdown value={method} onChange={(e: any) => setMethod(e.target.value)} className={selectClass}>
                  <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option>
                </Dropdown>
              </Field>
            </div>
          )}
        </div>

        <div className="text-xs text-[var(--text-secondary)]">
          Student ID will be {nextCode}. Rent is billed every month from the join month. The security deposit is stored on the student&apos;s record and is not counted as income.
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="border border-white/15 rounded-lg px-5 py-2 text-sm text-[var(--text-secondary)] hover:text-white">Cancel</button>
          <button type="submit" disabled={busy} className="btn-gold rounded-lg px-6 py-2 text-sm disabled:opacity-60 flex items-center gap-2">
            {busy && <Loader2 className="animate-spin" size={16} />} Save student
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ENROLLED STUDENTS LIST
// ---------------------------------------------------------------------------
function HostelStudentsList({ students, beds, payments, onOpen }: any) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"active" | "left" | "all">("active");
  const bedById: Record<string, Unit> = {};
  beds.forEach((b: Unit) => { bedById[b.id] = b; });

  const rows = students.filter((s: HostelStudent) => {
    if (view !== "all" && s.status !== view) return false;
    const hay = `${s.name} ${s.student_code} ${s.student_phone || ""} ${s.guardian_name || ""} ${s.cnic || ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, phone, CNIC..." className={inputClass + " pl-9"} />
        </div>
        {(["active", "left", "all"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setView(k)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${view === k ? "border-[var(--gold)] text-champagne bg-[var(--gold)]/10" : "border-white/10 text-[var(--text-secondary)]"}`}>
            {k === "active" ? "Currently staying" : k === "left" ? "Checked out" : "All"}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto glass rounded-lg">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[var(--text-secondary)] text-xs border-b border-white/10">
            <th className="p-3">ID</th><th className="p-3">Student</th><th className="p-3">Room / Bed</th><th className="p-3">Joined</th>
            <th className="p-3 text-right">Monthly rent</th><th className="p-3 text-right">Outstanding</th><th className="p-3">Status</th>
          </tr></thead>
          <tbody>
            {rows.map((s: HostelStudent) => {
              const b = s.unit_id ? bedById[s.unit_id] : undefined;
              const out = buildLedger(s, payments).outstanding;
              return (
                <tr key={s.id} onClick={() => onOpen(s.id)} className="border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/5">
                  <td className="p-3 text-champagne">{s.student_code}</td>
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3 text-[var(--text-secondary)]">{b ? `Room ${b.room} · Bed ${bedLetter(b)}` : "—"}</td>
                  <td className="p-3 text-[var(--text-secondary)]">{s.join_date}</td>
                  <td className="p-3 text-right">{money(s.monthly_rent)}</td>
                  <td className={`p-3 text-right ${out > 0 ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>{out > 0 ? money(out) : "Clear"}</td>
                  <td className="p-3"><StatusBadge status={s.status === "active" ? "PAID" : "VACANT"} label={s.status === "active" ? "STAYING" : "LEFT"} /></td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td colSpan={7} className="p-8 text-center text-[var(--text-secondary)]">
                {students.length ? "No students match this filter." : "No students enrolled yet. Use “Add Student” to admit the first student."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STUDENT PROFILE (+ printable student details report)
// ---------------------------------------------------------------------------
function StudentProfile({ student, beds, payments, profile, show, onBack, onChanged }: any) {
  const bed: Unit | undefined = beds.find((b: Unit) => b.id === student.unit_id);
  const ledger = buildLedger(student, payments);
  const history = payments.filter((p: any) => p.student_id === student.id);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [outOpen, setOutOpen] = useState(false);

  const voidPayment = async (id: string) => {
    if (!window.confirm("Void this payment? It will stop counting toward totals (kept in the audit trail).")) return;
    const { error } = await supabase.from("rent_payments").update({ voided: true, updated_by: profile.id }).eq("id", id);
    if (error) { show(error.message, "err"); return; }
    show("Payment voided.");
    onChanged();
  };

  const detail = (label: string, value: any) => (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</div>
      <div className="text-sm mt-0.5">{value || "—"}</div>
    </div>
  );

  return (
    <div className="print-area">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 no-print">
        <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-white">
          <ArrowLeft size={16} /> Back to hostel
        </button>
        <div className="flex gap-2 flex-wrap">
          {student.status === "active" && (
            <button type="button" onClick={() => setPayOpen(true)} className="btn-gold rounded-lg px-3 py-1.5 text-sm">Record payment</button>
          )}
          <button type="button" onClick={() => setEditOpen(true)} className="border border-white/15 rounded-lg px-3 py-1.5 text-sm hover:border-[var(--gold)]/60">Edit details</button>
          {student.status === "active" && (
            <button type="button" onClick={() => setOutOpen(true)} className="border border-red-500/40 text-red-400 rounded-lg px-3 py-1.5 text-sm hover:bg-red-500/10">Check out</button>
          )}
          <button type="button" onClick={() => window.print()} className="flex items-center gap-2 border border-white/15 rounded-lg px-3 py-1.5 text-sm hover:border-[var(--gold)]/60">
            <Printer size={14} /> Print report
          </button>
        </div>
      </div>

      <div className="text-center mb-5 border-b border-white/10 pb-4">
        <div className="text-xs tracking-widest text-gold">K&amp;J CHESHTI PROPERTIES</div>
        <div className="text-sm text-[var(--text-secondary)]">Barkat Market Heights — Boys Hostel</div>
        <div className="text-xs text-[var(--text-secondary)] mt-1">Student Details Report · Generated {new Date().toLocaleString()}</div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-xl font-semibold">{student.name}</h1>
        <span className="text-champagne text-sm">{student.student_code}</span>
        <StatusBadge status={student.status === "active" ? "PAID" : "VACANT"} label={student.status === "active" ? "CURRENTLY STAYING" : "CHECKED OUT"} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card label="Total billed" value={money(ledger.totalDue)} />
        <Card label="Total paid" value={money(ledger.totalPaid)} tone="green" />
        <Card label="Outstanding" value={money(ledger.outstanding)} tone={ledger.outstanding > 0 ? "red" : "green"} />
        <Card label="Months billed" value={String(ledger.rows.length)} tone="gray" />
      </div>

      <div className="glass rounded-xl p-5 mb-6">
        <div className="text-sm font-semibold text-champagne mb-4">Student details</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {detail("Room / bed", bed ? bedFullLabel(bed) : null)}
          {detail("Moved in (join date)", student.join_date)}
          {detail("Monthly rent", money(student.monthly_rent))}
          {detail("Security deposit", money(student.security_deposit))}
          {detail("Guardian name", student.guardian_name)}
          {detail("Guardian phone", student.guardian_phone)}
          {detail("Student phone", student.student_phone)}
          {detail("CNIC", student.cnic)}
          {detail("Contract signed", student.contract_signed ? "Yes" : "No")}
          {detail("Police verification", student.police_verification ? "Yes" : "No")}
          {detail("Status", student.status === "active" ? "Currently staying" : `Checked out${student.left_date ? " on " + student.left_date : ""}`)}
          {detail("Notes", student.notes)}
        </div>
      </div>

      <div className="mb-6">
        <div className="text-sm font-semibold text-champagne mb-3">Monthly rent ledger</div>
        <div className="overflow-x-auto glass rounded-lg">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[var(--text-secondary)] text-xs border-b border-white/10">
              <th className="p-3">Month</th><th className="p-3 text-right">Rent due</th><th className="p-3 text-right">Paid</th><th className="p-3 text-right">Balance</th><th className="p-3">Status</th>
            </tr></thead>
            <tbody>
              {ledger.rows.map((r) => (
                <tr key={r.month} className="border-b border-white/5 last:border-0">
                  <td className="p-3">{monthLabel(r.month)}</td>
                  <td className="p-3 text-right">{money(r.due)}</td>
                  <td className="p-3 text-right text-[var(--success)]">{money(r.paid)}</td>
                  <td className="p-3 text-right">{r.balance > 0 ? money(r.balance) : "—"}</td>
                  <td className="p-3">
                    {r.balance <= 0 ? <StatusBadge status="PAID" /> : r.paid > 0 ? <StatusBadge status="PENDING" label="PARTIAL" /> : <StatusBadge status="OVERDUE" label="DUE" />}
                  </td>
                </tr>
              ))}
              {!ledger.rows.length && <tr><td colSpan={5} className="p-6 text-center text-[var(--text-secondary)]">Billing starts from the join month.</td></tr>}
            </tbody>
            {ledger.rows.length > 0 && (
              <tfoot><tr className="border-t border-white/10 font-semibold">
                <td className="p-3">Total</td><td className="p-3 text-right">{money(ledger.totalDue)}</td>
                <td className="p-3 text-right text-[var(--success)]">{money(ledger.totalPaid)}</td>
                <td className="p-3 text-right">{money(ledger.outstanding)}</td><td />
              </tr></tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="mb-6">
        <div className="text-sm font-semibold text-champagne mb-3">Payment history</div>
        <div className="overflow-x-auto glass rounded-lg">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[var(--text-secondary)] text-xs border-b border-white/10">
              <th className="p-3">Date received</th><th className="p-3">For month</th><th className="p-3">Method</th><th className="p-3 text-right">Amount</th><th className="p-3">Notes</th><th className="p-3 no-print" />
            </tr></thead>
            <tbody>
              {history.map((p: any) => (
                <tr key={p.id} className={`border-b border-white/5 last:border-0 ${p.voided ? "opacity-40 line-through" : ""}`}>
                  <td className="p-3">{p.payment_date}</td>
                  <td className="p-3">{monthLabel(p.rent_month)}</td>
                  <td className="p-3 text-[var(--text-secondary)]">{p.payment_method === "cash" ? "Cash" : "Bank Transfer"}</td>
                  <td className="p-3 text-right text-[var(--success)]">{money(p.amount)}</td>
                  <td className="p-3 text-[var(--text-secondary)]">{p.voided ? "VOIDED" : p.notes || "—"}</td>
                  <td className="p-3 no-print">
                    {!p.voided && <button type="button" onClick={() => voidPayment(p.id)} className="text-xs text-red-400 hover:underline">Void</button>}
                  </td>
                </tr>
              ))}
              {!history.length && <tr><td colSpan={6} className="p-6 text-center text-[var(--text-secondary)]">No payments recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {payOpen && <RecordPaymentModal student={student} ledger={ledger} profile={profile} show={show} onClose={() => setPayOpen(false)} onDone={() => { setPayOpen(false); onChanged(); }} />}
      {editOpen && <EditStudentModal student={student} show={show} onClose={() => setEditOpen(false)} onDone={() => { setEditOpen(false); onChanged(); }} />}
      {outOpen && <CheckoutModal student={student} show={show} onClose={() => setOutOpen(false)} onDone={() => { setOutOpen(false); onChanged(); }} />}
    </div>
  );
}

function RecordPaymentModal({ student, ledger, profile, show, onClose, onDone }: any) {
  const firstUnpaid = ledger.rows.find((r: any) => r.balance > 0);
  const [month, setMonth] = useState((firstUnpaid ? firstUnpaid.month : monthStart()).slice(0, 7));
  const [amount, setAmount] = useState(String(firstUnpaid ? firstUnpaid.balance : student.monthly_rent));
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!student.unit_id) { setErr("This student has no bed assigned."); return; }
    if (!amount || Number(amount) <= 0) { setErr("Amount must be greater than zero."); return; }
    setBusy(true);
    const { error } = await supabase.from("rent_payments").insert({
      unit_id: student.unit_id, student_id: student.id, rent_month: month + "-01", amount: Number(amount),
      payment_method: method, payment_date: date, notes: notes.trim() || null, created_by: profile.id,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    show("Payment recorded.");
    onDone();
  };

  return (
    <Modal title={`Record payment — ${student.name}`} onClose={onClose} lockBackdrop>
      <form onSubmit={submit} className="space-y-3">
        {err && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rent for month"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} required /></Field>
          <Field label="Amount (Rs)"><input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} required /></Field>
          <Field label="Payment method">
            <Dropdown value={method} onChange={(e: any) => setMethod(e.target.value)} className={selectClass}>
              <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option>
            </Dropdown>
          </Field>
          <Field label="Date received"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required /></Field>
        </div>
        <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} /></Field>
        <SubmitBtn busy={busy} label="Save payment" />
      </form>
    </Modal>
  );
}

function EditStudentModal({ student, show, onClose, onDone }: any) {
  const [name, setName] = useState(student.name);
  const [guardianName, setGuardianName] = useState(student.guardian_name || "");
  const [guardianPhone, setGuardianPhone] = useState(student.guardian_phone || "");
  const [studentPhone, setStudentPhone] = useState(student.student_phone || "");
  const [cnic, setCnic] = useState(student.cnic || "");
  const [rent, setRent] = useState(String(student.monthly_rent));
  const [deposit, setDeposit] = useState(String(student.security_deposit));
  const [contract, setContract] = useState(student.contract_signed ? "yes" : "no");
  const [police, setPolice] = useState(student.police_verification ? "yes" : "no");
  const [notes, setNotes] = useState(student.notes || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) { setErr("Name is required."); return; }
    if (!rent || Number(rent) <= 0) { setErr("Monthly rent must be greater than zero."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("hostel_update_student", {
      p_id: student.id, p_name: name.trim(), p_guardian_name: guardianName.trim() || null,
      p_guardian_phone: guardianPhone.trim() || null, p_student_phone: studentPhone.trim() || null,
      p_cnic: cnic.trim() || null, p_monthly_rent: Number(rent), p_security_deposit: Number(deposit || 0),
      p_contract_signed: contract === "yes", p_police_verification: police === "yes", p_notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    show("Student details updated.");
    onDone();
  };

  return (
    <Modal title={`Edit — ${student.name}`} onClose={onClose} wide lockBackdrop>
      <form onSubmit={submit} className="space-y-4">
        {err && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}
        <Field label="Student name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Guardian name"><input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} className={inputClass} /></Field>
          <Field label="Guardian phone"><input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} className={inputClass} /></Field>
          <Field label="Student phone"><input value={studentPhone} onChange={(e) => setStudentPhone(e.target.value)} className={inputClass} /></Field>
          <Field label="CNIC"><input value={cnic} onChange={(e) => setCnic(e.target.value)} className={inputClass} /></Field>
          <Field label="Monthly rent (Rs)"><input type="number" min="1" value={rent} onChange={(e) => setRent(e.target.value)} className={inputClass} /></Field>
          <Field label="Security deposit (Rs)"><input type="number" min="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} className={inputClass} /></Field>
          <Field label="Contract signed">
            <Dropdown value={contract} onChange={(e: any) => setContract(e.target.value)} className={selectClass}>
              <option value="no">No</option><option value="yes">Yes</option>
            </Dropdown>
          </Field>
          <Field label="Police verification">
            <Dropdown value={police} onChange={(e: any) => setPolice(e.target.value)} className={selectClass}>
              <option value="no">No</option><option value="yes">Yes</option>
            </Dropdown>
          </Field>
        </div>
        <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClass} /></Field>
        <div className="text-xs text-[var(--text-secondary)]">Changing the monthly rent applies to the student&apos;s whole ledger and to the hostel&apos;s expected income from now on.</div>
        <SubmitBtn busy={busy} label="Save changes" />
      </form>
    </Modal>
  );
}

function CheckoutModal({ student, show, onClose, onDone }: any) {
  const [date, setDate] = useState(todayStr());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    const { error } = await supabase.rpc("hostel_checkout_student", { p_id: student.id, p_left_date: date });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    show(`${student.name} checked out — bed is vacant again.`);
    onDone();
  };

  return (
    <Modal title={`Check out — ${student.name}`} onClose={onClose} lockBackdrop>
      <form onSubmit={submit} className="space-y-4">
        {err && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}
        <div className="text-sm text-[var(--text-secondary)]">
          The bed becomes vacant and rent stops being billed after the check-out month. Payment history is kept.
          Any outstanding balance stays visible on the student&apos;s profile.
        </div>
        <Field label="Check-out date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required /></Field>
        <SubmitBtn busy={busy} label="Confirm check-out" />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// GROWTH REPORT — rooms & beds
// ---------------------------------------------------------------------------
function HostelGrowth({ beds, students, payments, roomTypes }: any) {
  const total = beds.length;
  const occupiedNow = beds.filter((b: Unit) => b.status === "occupied").length;
  const rooms: Record<string, Unit[]> = {};
  beds.forEach((b: Unit) => { const r = b.room || "—"; if (!rooms[r]) rooms[r] = []; rooms[r].push(b); });
  const roomKeys = Object.keys(rooms).sort(roomSort);

  const floorMap: Record<string, { beds: number; occ: number; rooms: number }> = {};
  roomKeys.forEach((r) => {
    const f = rooms[r][0].floor || "—";
    if (!floorMap[f]) floorMap[f] = { beds: 0, occ: 0, rooms: 0 };
    floorMap[f].rooms += 1;
    floorMap[f].beds += rooms[r].length;
    floorMap[f].occ += rooms[r].filter((b) => b.status === "occupied").length;
  });

  const potentialRent = beds.reduce((t: number, b: Unit) => {
    const rt = roomTypes.find((r: RoomType) => r.id === b.room_type_id);
    return t + Number(rt ? rt.monthly_rent : b.monthly_rent);
  }, 0);
  const actualRent = beds.filter((b: Unit) => b.status === "occupied").reduce((t: number, b: Unit) => t + Number(b.monthly_rent), 0);

  // month-by-month series from first admission to now
  const nowIdx = nowMonthIndex();
  const startIdx = students.length ? Math.min(...students.map((s: HostelStudent) => ymIndex(s.join_date))) : nowIdx;
  const series: any[] = [];
  for (let i = Math.max(startIdx, nowIdx - 23); i <= nowIdx; i++) {
    const inHostel = students.filter((s: HostelStudent) => ymIndex(s.join_date) <= i && (!s.left_date || ymIndex(s.left_date) > i));
    series.push({
      idx: i,
      occupied: inHostel.length,
      pct: total ? (inHostel.length / total) * 100 : 0,
      admissions: students.filter((s: HostelStudent) => ymIndex(s.join_date) === i).length,
      checkouts: students.filter((s: HostelStudent) => s.left_date && ymIndex(s.left_date) === i).length,
      rentRoll: inHostel.reduce((t: number, s: HostelStudent) => t + Number(s.monthly_rent), 0),
      collected: payments.filter((p: any) => !p.voided && ymIndex(p.rent_month) === i).reduce((t: number, p: any) => t + Number(p.amount), 0),
    });
  }

  const idealBeds = Math.ceil(total * IDEAL_OCCUPANCY);

  return (
    <div className="print-area">
      <div className="flex items-center justify-between mb-4 no-print">
        <h2 className="font-semibold">Rooms &amp; Beds — Growth Report</h2>
        <button type="button" onClick={() => window.print()} className="flex items-center gap-2 btn-gold text-sm px-3 py-1.5 rounded-lg"><Printer size={14} /> Print</button>
      </div>
      <div className="text-center mb-5 border-b border-white/10 pb-3">
        <div className="text-xs tracking-widest text-gold">K&amp;J CHESHTI PROPERTIES</div>
        <div className="text-sm text-[var(--text-secondary)]">Barkat Market Heights — Boys Hostel · Growth Report</div>
        <div className="text-[11px] text-[var(--text-secondary)]">Generated {new Date().toLocaleString()}</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card label="Rooms" value={String(roomKeys.length)} tone="gray" />
        <Card label="Total beds" value={String(total)} />
        <Card label="Occupied beds" value={`${occupiedNow} (${total ? ((occupiedNow / total) * 100).toFixed(1) : 0}%)`} tone="green" />
        <Card label="Target (70%)" value={`${idealBeds} beds by Mar 2027`} />
        <Card label="Rent now" value={money(actualRent)} tone="green" />
        <Card label="Rent if full" value={money(potentialRent)} />
        <Card label="Ideal rent (70%)" value={money(Math.round(potentialRent * IDEAL_OCCUPANCY))} />
        <Card label="Beds still vacant" value={String(beds.filter((b: Unit) => b.status === "vacant").length)} tone="gray" />
      </div>

      <div className="glass rounded-xl p-5 mb-6">
        <div className="text-sm font-semibold text-champagne mb-1">Occupancy growth by month</div>
        <div className="text-xs text-[var(--text-secondary)] mb-4">Gold line = 70% target</div>
        {!students.length ? (
          <div className="text-sm text-[var(--text-secondary)] py-6 text-center">No admissions recorded yet — growth will appear here as students are enrolled.</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="relative h-44 flex items-end gap-2 min-w-[320px] border-b border-white/10 pr-2">
              <div className="absolute left-0 right-0 border-t border-dashed border-[var(--gold)]/70" style={{ bottom: `${IDEAL_OCCUPANCY * 100}%` }} />
              {series.map((m) => (
                <div key={m.idx} className="flex-1 min-w-[34px] h-full flex flex-col justify-end items-center">
                  <div className="text-[10px] text-[var(--text-secondary)] mb-1">{m.occupied}</div>
                  <div className="w-full max-w-[38px] rounded-t-md btn-gold" style={{ height: `${Math.max(2, m.pct)}%`, boxShadow: "none" }} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 min-w-[320px] pr-2 mt-1">
              {series.map((m) => <div key={m.idx} className="flex-1 min-w-[34px] text-center text-[10px] text-[var(--text-secondary)]">{shortMonthLabel(m.idx)}</div>)}
            </div>
          </div>
        )}
      </div>

      {students.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-semibold text-champagne mb-3">Monthly growth table</div>
          <div className="overflow-x-auto glass rounded-lg">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[var(--text-secondary)] text-xs border-b border-white/10">
                <th className="p-3">Month</th><th className="p-3 text-right">New admissions</th><th className="p-3 text-right">Check-outs</th>
                <th className="p-3 text-right">Beds occupied</th><th className="p-3 text-right">Occupancy</th><th className="p-3 text-right">Rent roll</th><th className="p-3 text-right">Rent collected</th>
              </tr></thead>
              <tbody>
                {[...series].reverse().map((m) => (
                  <tr key={m.idx} className="border-b border-white/5 last:border-0">
                    <td className="p-3">{shortMonthLabel(m.idx)}</td>
                    <td className="p-3 text-right">{m.admissions}</td><td className="p-3 text-right">{m.checkouts}</td>
                    <td className="p-3 text-right">{m.occupied} / {total}</td><td className="p-3 text-right">{m.pct.toFixed(1)}%</td>
                    <td className="p-3 text-right">{money(m.rentRoll)}</td><td className="p-3 text-right text-[var(--success)]">{money(m.collected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="text-sm font-semibold text-champagne mb-3">By floor</div>
        <div className="overflow-x-auto glass rounded-lg">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[var(--text-secondary)] text-xs border-b border-white/10">
              <th className="p-3">Floor</th><th className="p-3 text-right">Rooms</th><th className="p-3 text-right">Beds</th><th className="p-3 text-right">Occupied</th><th className="p-3 text-right">Vacant</th><th className="p-3 text-right">Occupancy</th>
            </tr></thead>
            <tbody>
              {Object.keys(floorMap).sort().map((f) => (
                <tr key={f} className="border-b border-white/5 last:border-0">
                  <td className="p-3">{f}</td><td className="p-3 text-right">{floorMap[f].rooms}</td><td className="p-3 text-right">{floorMap[f].beds}</td>
                  <td className="p-3 text-right text-[var(--success)]">{floorMap[f].occ}</td><td className="p-3 text-right">{floorMap[f].beds - floorMap[f].occ}</td>
                  <td className="p-3 text-right">{floorMap[f].beds ? ((floorMap[f].occ / floorMap[f].beds) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-champagne mb-3">By room</div>
        <div className="overflow-x-auto glass rounded-lg">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[var(--text-secondary)] text-xs border-b border-white/10">
              <th className="p-3">Room</th><th className="p-3">Floor</th><th className="p-3 text-right">Beds</th><th className="p-3 text-right">Rent / bed</th>
              <th className="p-3 text-right">Occupied</th><th className="p-3 text-right">Vacant</th><th className="p-3 text-right">Occupancy</th>
            </tr></thead>
            <tbody>
              {roomKeys.map((r) => {
                const rb = rooms[r];
                const occ = rb.filter((b) => b.status === "occupied").length;
                const rt = roomTypes.find((x: RoomType) => x.id === rb[0].room_type_id);
                return (
                  <tr key={r} className="border-b border-white/5 last:border-0">
                    <td className="p-3 font-medium">{r}</td><td className="p-3 text-[var(--text-secondary)]">{rb[0].floor}</td>
                    <td className="p-3 text-right">{rb.length}</td><td className="p-3 text-right">{money(rt ? rt.monthly_rent : rb[0].monthly_rent)}</td>
                    <td className="p-3 text-right text-[var(--success)]">{occ}</td><td className="p-3 text-right">{rb.length - occ}</td>
                    <td className="p-3 text-right">{((occ / rb.length) * 100).toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
