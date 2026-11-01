"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play, Users, Car, Smile, ShoppingBag, CalendarDays, Trophy, Settings, ChevronLeft,
  ChevronRight, Flag, Skull, Zap, Timer, GraduationCap, Wifi, Rocket, Banana, Hand,
  Magnet, ShieldCheck, Snowflake, ChevronsUp, Bird, ArrowLeftRight, Sparkles, Coins,
  Star, Lock, Check, Copy, LogIn, Volume2, VolumeX, MonitorSmartphone, Vibrate, Ruler,
  Crown, Paintbrush, CircleDot, Music2, PartyPopper, RotateCcw, Swords, Target, Flame,
  Gamepad2, Info, Medal, Keyboard, Gauge, MoveHorizontal, Maximize2, Smartphone,
  Gem, Package, Wrench, Cog, Search,
} from "lucide-react";
import {
  MODES, TRACKS, VEHICLES, CHARACTERS, HATS, WHEELS, HORNS, DANCES, DAILIES, ACHIEVEMENTS,
  GP_TRACKS, POWERUPS, PAINTS, CRATES, BUNDLES, GEM_EXCHANGE, RARITY_META, collectionStats,
  vehicleRating, levelFromXp, xpForLevel, fmtTime, UPGRADES, MAX_UPGRADE_LEVEL, upgradeCost,
  getUpgrades, upgradedStats, upgradeTotal, type Rarity,
} from "@/game/data";
import { AudioMan } from "@/game/audio";
import { P2PRoom, type PeerRecord } from "@/game/net";
import { useApp, DEFAULT_KEYS, type Profile, type RaceSummary, type KeyBindings } from "@/lib/store";
import type { Unlocks } from "@/db/schema";
import Preview3D from "@/components/preview3d";
import CarImage from "@/components/car-image";

// ---------------------------------------------------------------------------
export function PowerIcon({ id, size = 22 }: { id: string; size?: number }) {
  switch (id) {
    case "boost": return <Rocket size={size} />;
    case "banana": return <Banana size={size} />;
    case "punch": return <Hand size={size} />;
    case "magnet": return <Magnet size={size} />;
    case "shield": return <ShieldCheck size={size} />;
    case "freeze": return <Snowflake size={size} />;
    case "giant": return <ChevronsUp size={size} />;
    case "chicken": return <Bird size={size} />;
    case "reverse": return <ArrowLeftRight size={size} />;
    case "teleport": return <Sparkles size={size} />;
    default: return <Sparkles size={size} />;
  }
}

const click = () => AudioMan.click();
const hover = () => AudioMan.hoverBlip();

 function Btn({ className = "", onClick, children, disabled, tone = "btn-yellow" }: {
  className?: string; onClick?: () => void; children: React.ReactNode; disabled?: boolean; tone?: string;
}) {
  return (
    <button
      className={`btn ${tone} px-5 py-3 text-base ${className}`}
      onClick={() => { click(); onClick?.(); }}
      onMouseEnter={hover}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Back({ label = "Back" }: { label?: string }) {
  const setScreen = useApp((s) => s.setScreen);
  return (
    <button className="btn btn-dark flex items-center gap-1 px-4 py-2 text-sm" onClick={() => { click(); setScreen("menu"); }} onMouseEnter={hover}>
      <ChevronLeft size={18} /> {label}
    </button>
  );
}

function ScreenTitle({ icon, children, sub }: { icon: React.ReactNode; children: React.ReactNode; sub?: string }) {
  return (
    <div className="anim-fade-up mb-5">
      <h2 className="flex items-center gap-3 text-3xl font-black text-white md:text-4xl">
        <span className="card flex h-12 w-12 items-center justify-center !rounded-2xl">{icon}</span>
        <span className="text-outline">{children}</span>
      </h2>
      {sub && <p className="mt-1 pl-2 text-sm font-bold text-[#ffd0e8]">{sub}</p>}
    </div>
  );
}

function CoinPill({ coins }: { coins: number }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border-[3px] border-[#16181d] bg-[#ffd23f] px-3 py-1 text-sm font-black text-[#4a3800] shadow-[0_3px_0_#16181d]">
      <Coins size={15} /> {coins.toLocaleString()}
    </span>
  );
}

function GemPill({ gems }: { gems: number }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border-[3px] border-[#16181d] bg-[#c8a2f5] px-3 py-1 text-sm font-black text-[#2d1b4e] shadow-[0_3px_0_#16181d]">
      <Gem size={14} /> {gems.toLocaleString()}
    </span>
  );
}

/** Coins + gems wallet shown on shop-ish screens. */
function Wallet() {
  const profile = useApp((s) => s.profile);
  return (
    <span className="flex items-center gap-2">
      <CoinPill coins={profile?.coins ?? 0} />
      <GemPill gems={profile?.gems ?? 0} />
    </span>
  );
}

// ===========================================================================
// TOP BAR
// ===========================================================================
export function TopBar() {
  const profile = useApp((s) => s.profile);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const [showLogin, setShowLogin] = useState(false);
  const lvl = profile ? levelFromXp(profile.xp) : 1;
  return (
    <div className="pointer-events-auto sticky top-0 z-30 flex items-center justify-between gap-2 px-3 py-2 md:px-6">
      <div className="flex items-center gap-2">
        {profile ? (
          <div className="card flex items-center gap-2 !rounded-2xl px-3 py-1.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#16181d] bg-gradient-to-br from-[#2dd4c8] to-[#8b5cf6] font-black text-white">
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="leading-tight">
              <div className="text-sm font-black">{profile.name}</div>
              <div className="text-[11px] font-bold text-[#8b5cf6]">Level {lvl} Racer</div>
            </div>
            <CoinPill coins={profile.coins} />
            <GemPill gems={profile.gems} />
          </div>
        ) : (
          <Btn tone="btn-teal" onClick={() => setShowLogin(true)}>
            <span className="flex items-center gap-2"><LogIn size={16} /> Sign in to race &amp; save</span>
          </Btn>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="btn btn-white p-2.5"
          onClick={() => { click(); const on = !settings.music; setSettings({ music: on }); AudioMan.ensure(); AudioMan.setMusicOn(on); }}
          title="Toggle music"
        >
          {settings.music ? <Music2 size={18} /> : <VolumeX size={18} />}
        </button>
        <button
          className="btn btn-white p-2.5"
          onClick={() => { click(); const on = !settings.sfx; setSettings({ sfx: on }); AudioMan.setSfxOn(on); }}
          title="Toggle sound effects"
        >
          {settings.sfx ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}

function LoginModal({ onClose }: { onClose: () => void }) {
  const login = useApp((s) => s.login);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const m = await login(name.trim());
    setBusy(false);
    if (m === null) onClose();
    else setMsg(m);
    if (m === null) AudioMan.go();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card anim-pop w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-2xl font-black">Racer License</h3>
        <p className="mt-1 text-sm font-bold text-[#6b5a8e]">
          Pick a racer name — your progress, coins and leaderboard times are saved to it. No passwords. Names are first-come, first-served.
        </p>
        <input
          className="mt-4 w-full rounded-2xl border-[3px] border-[#16181d] bg-white px-4 py-3 text-lg font-black outline-none focus:border-[#8b5cf6]"
          placeholder="e.g. TurboTina"
          maxLength={16}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        {msg && <p className="mt-2 text-sm font-bold text-[#ff4d6d]">{msg}</p>}
        <div className="mt-5 flex gap-3">
          <Btn tone="btn-green" className="flex-1" onClick={submit}>
            {busy ? "Checking..." : "Get my license!"}
          </Btn>
          <Btn tone="btn-white" onClick={onClose}>Later</Btn>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// HOME
// ===========================================================================
function Home() {
  const setScreen = useApp((s) => s.setScreen);
  const profile = useApp((s) => s.profile);
  const nav = [
    { s: "modes", icon: <Play size={30} />, label: "Play", tone: "btn-yellow", desc: "Race now!" },
    { s: "garage", icon: <Car size={26} />, label: "Collection", tone: "btn-teal", desc: "20 cars to collect" },
    { s: "characters", icon: <Smile size={26} />, label: "Characters", tone: "btn-pink", desc: "8 oddballs" },
    { s: "shop", icon: <ShoppingBag size={26} />, label: "Dealership", tone: "btn-purple", desc: "Crates & bundles" },
    { s: "events", icon: <CalendarDays size={26} />, label: "Events", tone: "btn-green", desc: "Daily loot" },
    { s: "ranks", icon: <Trophy size={26} />, label: "Leaderboards", tone: "btn-yellow", desc: "Fastest laps" },
    { s: "friends", icon: <Wifi size={26} />, label: "Friends Room", tone: "btn-pink", desc: "Online P2P" },
    { s: "howto", icon: <Gamepad2 size={26} />, label: "How to Play", tone: "btn-white", desc: "Controls & tips" },
    { s: "settings", icon: <Settings size={26} />, label: "Settings", tone: "btn-dark", desc: "Tune it up" },
  ] as const;
  return (
    <div className="relative mx-auto flex min-h-[calc(100dvh-64px)] max-w-6xl flex-col items-center justify-center px-4 pb-16 pt-4">
      {/* floating decorations */}
      <Sparkles className="anim-float-slow pointer-events-none absolute left-[6%] top-[10%] text-[#ffd23f]" size={44} />
      <Flag className="anim-float-slow pointer-events-none absolute right-[8%] top-[16%] text-[#2dd4c8]" size={44} style={{ animationDelay: "1s" }} />
      <Rocket className="anim-float-slow pointer-events-none absolute bottom-[18%] left-[10%] text-[#ff5ca8]" size={40} style={{ animationDelay: "2s" }} />
      <Banana className="anim-float-slow pointer-events-none absolute bottom-[12%] right-[12%] text-[#ffd23f]" size={40} style={{ animationDelay: "3s" }} />

      <div className="anim-pop text-center">
        <div className="checker-strip anim-scroll mx-auto mb-4 max-w-lg rounded-full border-[3px] border-[#16181d]" />
        <h1 className="text-outline text-6xl font-black leading-[0.95] text-[#ffd23f] md:text-8xl">
          WACKY
          <span className="bg-clip-title block">RACING</span>
        </h1>
        <p className="mt-2 text-xl font-black tracking-[0.3em] text-[#2dd4c8] md:text-2xl" style={{ textShadow: "0 3px 0 #16181d" }}>
          ULTIMATE KART CHAOS
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm font-bold text-[#e8dcff]">
          Bathtubs! Turbo chickens! Teleports! Ten ridiculous vehicles on eight ridiculous tracks.
          Easy to learn, silly to master.
        </p>
      </div>

      <div className="anim-fade-up mt-8 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
        {nav.map((n, i) => (
          <button
            key={n.s}
            className={`btn ${n.tone} group flex flex-col items-start gap-1 px-5 py-4 text-left ${n.s === "modes" ? "col-span-2 sm:col-span-1" : ""}`}
            style={{ animationDelay: `${i * 40}ms` }}
            onClick={() => { click(); setScreen(n.s); }}
            onMouseEnter={hover}
          >
            <span className="flex items-center gap-2 text-lg font-black">{n.icon} {n.label}</span>
            <span className="text-xs font-bold opacity-75">{n.desc}</span>
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {profile ? (
          <>
            <CoinPill coins={profile.coins} />
            <span className="hud-panel flex items-center gap-1.5 px-3 py-1.5 text-sm font-black">
              <Star size={15} className="text-[#ffd23f]" /> {profile.xp.toLocaleString()} XP
            </span>
            <span className="hud-panel flex items-center gap-1.5 px-3 py-1.5 text-sm font-black">
              <Medal size={15} className="text-[#3ddc84]" /> {profile.stats.wins} wins / {profile.stats.races} races
            </span>
          </>
        ) : (
          <p className="text-sm font-bold text-[#a08fd0]">Playing as guest — sign in from the top-left to save progress &amp; post lap times.</p>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0">
        <div className="checker-strip" />
      </div>
    </div>
  );
}

// ===========================================================================
// MODES
// ===========================================================================
const MODE_ICONS: Record<string, React.ReactNode> = {
  quick: <Flag size={26} />, grandprix: <Trophy size={26} />, elimination: <Skull size={26} />,
  team: <Users size={26} />, chaos: <Zap size={26} />, "time-trial": <Timer size={26} />,
  practice: <GraduationCap size={26} />, multiplayer: <Wifi size={26} />,
};

function Modes() {
  const setScreen = useApp((s) => s.setScreen);
  const setSetup = useApp((s) => s.setSetup);
  const startRace = useStartRace();
  const profile = useApp((s) => s.profile);
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20">
      <div className="flex items-center justify-between py-4"><Back /><Wallet /></div>
      <ScreenTitle icon={<Play size={24} />} sub="Pick your flavor of chaos.">Game Modes</ScreenTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map((m, i) => (
          <button
            key={m.id}
            className="card-dark anim-fade-up group p-5 text-left transition-transform hover:-translate-y-1"
            style={{ animationDelay: `${i * 50}ms` }}
            onMouseEnter={hover}
            onClick={() => {
              click();
              if (m.id === "multiplayer") { setSetup({ mode: "multiplayer" }); setScreen("friends"); return; }
              if (m.id === "grandprix") { startRace({ mode: "grandprix", track: GP_TRACKS[0], gpRace: 0, gpScores: {} }); return; }
              setSetup({ mode: m.id });
              setScreen("tracks");
            }}
          >
            <div className="flex items-center justify-between">
              <span className="card flex h-12 w-12 items-center justify-center !rounded-2xl text-[#16181d]">{MODE_ICONS[m.id]}</span>
              <span className="rounded-full border-2 border-[#16181d] bg-[#ffd23f] px-2 py-0.5 text-[10px] font-black text-[#16181d]">{m.tagline}</span>
            </div>
            <div className="mt-3 text-xl font-black">{m.name}</div>
            <p className="mt-1 text-xs font-bold leading-snug text-[#cbbdf3]">{m.desc}</p>
            <div className="mt-3 text-[11px] font-black text-[#2dd4c8]">
              {m.id === "time-trial" || m.id === "practice" ? "Solo" : `${m.racers} racers`} · {m.laps === "track" ? "Track laps" : m.laps === 0 ? "No laps" : `${m.laps} laps`}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// TRACKS
// ===========================================================================
/** Horizontal car picker so you can swap rides right before a race. */
function QuickPickCars() {
  const garage = useApp((s) => s.garage);
  const setGarage = useApp((s) => s.setGarage);
  const profile = useApp((s) => s.profile);
  const favorites = useApp((s) => s.favorites);
  const setScreen = useApp((s) => s.setScreen);
  const ownedIds = useMemo(
    () => profile?.unlocked.vehicles ?? ["shopping-cart", "chicken-bike", "pizza-scooter"],
    [profile],
  );
  const cars = useMemo(() => {
    const owned = VEHICLES.filter((v) => ownedIds.includes(v.id));
    return owned.sort((a, b) => {
      const fa = favorites.includes(a.id) ? 0 : 1;
      const fb = favorites.includes(b.id) ? 0 : 1;
      return fa - fb || RARITY_META[b.rarity].order - RARITY_META[a.rarity].order;
    });
  }, [ownedIds, favorites]);

  return (
    <div className="card mb-4 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-black"><Car size={14} /> YOUR RIDE</span>
        <button className="btn btn-white px-2.5 py-1 text-[10px] font-black" onClick={() => { click(); setScreen("garage"); }}>
          Full garage →
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {cars.map((v) => {
          const active = garage.vehicle === v.id;
          return (
            <button
              key={v.id}
              onMouseEnter={hover}
              onClick={() => { click(); setGarage({ vehicle: v.id }); AudioMan.pickup(); }}
              className={`shrink-0 overflow-hidden rounded-2xl border-[3px] border-[#16181d] transition-transform hover:-translate-y-0.5 ${active ? "ring-4 ring-[#2dd4c8]" : ""}`}
              style={{ width: 104, boxShadow: "0 3px 0 #16181d" }}
            >
              <CarImage vehId={v.id} paint={active ? garage.paint : undefined} wheels={garage.wheels} className="h-14 w-full" />
              <div className="bg-white px-1.5 py-1">
                <div className="truncate text-[10px] font-black">{v.name}</div>
                {favorites.includes(v.id) && <Star size={9} className="inline fill-[#ffd23f] text-[#ffb700]" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Tracks() {
  const setup = useApp((s) => s.setup);
  const startRace = useStartRace();
  const profile = useApp((s) => s.profile);
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20">
      <div className="flex items-center justify-between py-4"><Back /><Wallet /></div>
      <ScreenTitle icon={<Flag size={24} />} sub={`${MODES.find((m) => m.id === setup.mode)?.name ?? "Race"} — pick your ride, then a battlefield.`}>
        Choose a Track
      </ScreenTitle>
      <QuickPickCars />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TRACKS.map((t, i) => (
          <button
            key={t.id}
            className="card-dark anim-fade-up overflow-hidden p-0 text-left transition-transform hover:-translate-y-1 hover:rotate-1"
            style={{ animationDelay: `${i * 40}ms` }}
            onMouseEnter={hover}
            onClick={() => { click(); startRace({ mode: setup.mode, track: t.id }); }}
          >
            <div
              className="flex h-28 items-end p-3"
              style={{ background: `linear-gradient(135deg, ${t.theme.sky}, ${t.theme.horizon} 55%, ${t.theme.ground})` }}
            >
              <span
                className="rounded-xl border-2 border-[#16181d] px-2.5 py-1 text-xs font-black"
                style={{ background: t.theme.track, color: "#16181d", boxShadow: "0 3px 0 #16181d" }}
              >
                {t.slippery > 0.5 ? "SLIPPERY!" : t.obstacles.length > 3 ? "DANGER!" : "FUN!"} · {t.laps} laps
              </span>
            </div>
            <div className="p-4">
              <div className="text-lg font-black">{t.name}</div>
              <p className="mt-1 text-xs font-bold leading-snug text-[#cbbdf3]">{t.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Shared starter used by modes/tracks/friends
export function useStartRace() {
  const setSetup = useApp((s) => s.setSetup);
  const setInRace = useApp((s) => s.setInRace);
  const bumpRaceKey = useApp((s) => s.bumpRaceKey);
  return useCallback((s: { mode: string; track: string; gpRace?: number; gpScores?: Record<string, number>; net?: import("@/lib/store").NetRoomInfo | null }) => {
    setSetup(s);
    bumpRaceKey();
    setInRace(true);
  }, [setSetup, setInRace, bumpRaceKey]);
}

// ===========================================================================
// GARAGE
// ===========================================================================
function RarityBadge({ rarity, small }: { rarity: Rarity; small?: boolean }) {
  const m = RARITY_META[rarity];
  return (
    <span
      className={`rounded-full border-2 border-[#16181d] font-black uppercase tracking-wide text-[#16181d] ${small ? "px-1.5 py-0.5 text-[8px]" : "px-2.5 py-1 text-[10px]"}`}
      style={{ background: m.color }}
    >
      {m.name}
    </span>
  );
}

function StatBar({ label, v, bonus = 0 }: { label: string; v: number; bonus?: number }) {
  const base = Math.max(0, v - bonus);
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[11px] font-black">
        <span>{label}</span>
        <span>{v.toFixed(1)}{bonus > 0 && <span className="ml-1 text-[#28a765]">+{bonus.toFixed(1)}</span>}</span>
      </div>
      <div className="stat-track relative h-3">
        <div className="stat-fill" style={{ width: `${Math.min(100, base * 10)}%` }} />
        {bonus > 0 && (
          <div className="absolute top-0 h-full rounded-r-full bg-[#ffb700]"
            style={{ left: `${Math.min(100, base * 10)}%`, width: `${Math.min(100 - base * 10, bonus * 10)}%` }} />
        )}
      </div>
    </div>
  );
}

function UpgradeIcon({ k, size = 16 }: { k: string; size?: number }) {
  if (k === "engine") return <Cog size={size} />;
  if (k === "tires") return <CircleDot size={size} />;
  if (k === "turbo") return <Rocket size={size} />;
  return <Wrench size={size} />;
}

function Garage() {
  const garage = useApp((s) => s.garage);
  const setGarage = useApp((s) => s.setGarage);
  const profile = useApp((s) => s.profile);
  const buyItem = useApp((s) => s.buyItem);
  const buyUpgrade = useApp((s) => s.buyUpgrade);
  const favorites = useApp((s) => s.favorites);
  const toggleFavorite = useApp((s) => s.toggleFavorite);
  const startRace = useStartRace();
  const [sel, setSel] = useState(garage.vehicle);
  const [filter, setFilter] = useState<"all" | Rarity | "owned" | "locked" | "favorites">("all");
  const [sort, setSort] = useState<"rarity" | "price" | "speed" | "name">("rarity");
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"stats" | "tune" | "style">("stats");

  const ownedList = useMemo(
    () => profile?.unlocked.vehicles ?? ["shopping-cart", "chicken-bike", "pizza-scooter"],
    [profile],
  );
  const owned = (id: string) => ownedList.includes(id);
  const wheelsOwned = (id: string) => profile?.unlocked.wheels.includes(id) ?? id === "classic";
  const veh = VEHICLES.find((v) => v.id === sel) ?? VEHICLES[0];
  const stats = collectionStats(ownedList);
  const ups = getUpgrades(profile?.upgrades, veh.id);
  const tuned = upgradedStats(veh, ups);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3200); };

  const list = useMemo(() => {
    let l = [...VEHICLES];
    const q = query.trim().toLowerCase();
    if (q) l = l.filter((v) => v.name.toLowerCase().includes(q) || v.cls.toLowerCase().includes(q) || v.rarity.includes(q));
    if (filter === "owned") l = l.filter((v) => ownedList.includes(v.id));
    else if (filter === "locked") l = l.filter((v) => !ownedList.includes(v.id));
    else if (filter === "favorites") l = l.filter((v) => favorites.includes(v.id));
    else if (filter !== "all") l = l.filter((v) => v.rarity === filter);
    l.sort((a, b) => {
      if (sort === "rarity") return RARITY_META[b.rarity].order - RARITY_META[a.rarity].order || a.price - b.price;
      if (sort === "price") return a.price - b.price;
      if (sort === "speed") return vehicleRating(b) - vehicleRating(a);
      return a.name.localeCompare(b.name);
    });
    return l;
  }, [filter, sort, ownedList, favorites, query]);

  const doBuy = async (pay: "coins" | "gems") => {
    if (busy) return;
    setBusy(true);
    const r = await buyItem("vehicles", veh.id, pay);
    setBusy(false);
    if (r.ok) { AudioMan.victoryFanfare(); flash(`${veh.name} added to your collection!`); setGarage({ vehicle: veh.id }); }
    else flash(r.error ?? "Could not buy that.");
  };

  const doUpgrade = async (key: string) => {
    if (busy) return;
    setBusy(true);
    const r = await buyUpgrade(veh.id, key);
    setBusy(false);
    if (r.ok) { AudioMan.itemGot(); flash(`${key.toUpperCase()} upgraded to level ${r.level}!`); }
    else flash(r.error ?? "Upgrade failed.");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20">
      <div className="flex items-center justify-between py-4"><Back /><Wallet /></div>
      <ScreenTitle icon={<Car size={24} />} sub="20 collectible rides · tune each one with Engine, Tires, Turbo and Frame upgrades.">
        Collection &amp; Garage
      </ScreenTitle>

      {/* equipped strip — always one tap to race */}
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <CarImage vehId={garage.vehicle} paint={garage.paint} wheels={garage.wheels} className="h-16 w-24 shrink-0 rounded-2xl border-[3px] border-[#16181d]" />
        <div className="min-w-[120px] flex-1">
          <div className="text-[10px] font-black tracking-widest text-[#8b5cf6]">CURRENTLY EQUIPPED</div>
          <div className="text-lg font-black leading-tight">{VEHICLES.find((v) => v.id === garage.vehicle)?.name}</div>
          <div className="text-[11px] font-bold text-[#6b5a8e]">
            Tuning {upgradeTotal(getUpgrades(profile?.upgrades, garage.vehicle))}/{UPGRADES.length * MAX_UPGRADE_LEVEL}
          </div>
        </div>
        <Btn tone="btn-green" onClick={() => startRace({ mode: "quick", track: "candy-rush" })}>
          <span className="flex items-center gap-1.5"><Play size={15} /> Race now</span>
        </Btn>
      </div>

      {/* collection progress */}
      <div className="card-dark mb-4 flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-[180px] flex-1">
          <div className="flex items-end justify-between text-sm font-black">
            <span>GARAGE COMPLETION</span>
            <span className="text-[#ffd23f]">{stats.have}/{stats.total} · {stats.pct}%</span>
          </div>
          <div className="stat-track mt-1 h-5"><div className="stat-fill" style={{ width: `${stats.pct}%` }} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {stats.byRarity.map((r) => (
            <span key={r.rarity} className="flex items-center gap-1.5 rounded-xl border-2 border-[#16181d] px-2.5 py-1 text-[11px] font-black text-[#16181d]"
              style={{ background: RARITY_META[r.rarity].color }}>
              {RARITY_META[r.rarity].name} {r.have}/{r.total}
            </span>
          ))}
        </div>
      </div>

      {/* search + filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b5cf6]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cars…"
            className="w-44 rounded-2xl border-[3px] border-[#16181d] bg-white py-2 pl-9 pr-3 text-xs font-black shadow-[0_3px_0_#16181d] outline-none focus:border-[#8b5cf6]"
          />
        </span>
        {(["all", "favorites", "owned", "locked", "common", "rare", "epic", "legendary"] as const).map((f) => (
          <button key={f} onMouseEnter={hover} onClick={() => { click(); setFilter(f); }}
            className={`btn px-3 py-1.5 text-xs font-black capitalize ${filter === f ? "btn-yellow" : "btn-dark"}`}>
            {f === "favorites" ? <Star size={12} className="inline" /> : null} {f}
          </button>
        ))}
        <select
          value={sort}
          onChange={(e) => { click(); setSort(e.target.value as "rarity" | "price" | "speed" | "name"); }}
          className="ml-auto rounded-xl border-[3px] border-[#16181d] bg-white px-2 py-1.5 text-xs font-black shadow-[0_3px_0_#16181d]"
        >
          <option value="rarity">Sort: Rarity</option>
          <option value="price">Sort: Price</option>
          <option value="speed">Sort: Rating</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_390px]">
        {/* ------- car photo grid ------- */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {list.map((v) => {
            const has = owned(v.id);
            const equipped = garage.vehicle === v.id;
            const fav = favorites.includes(v.id);
            const lvl = upgradeTotal(getUpgrades(profile?.upgrades, v.id));
            return (
              <div key={v.id}
                className={`card relative overflow-hidden p-0 transition-transform hover:-translate-y-1 ${sel === v.id ? "ring-4 ring-[#2dd4c8]" : ""}`}>
                <button className="block w-full text-left" onMouseEnter={hover} onClick={() => { click(); setSel(v.id); }}>
                  <div className="relative">
                    <CarImage vehId={v.id} paint={equipped ? garage.paint : undefined} className={`h-24 w-full ${has ? "" : "opacity-60 grayscale"}`} />
                    <span className="absolute left-1.5 top-1.5"><RarityBadge rarity={v.rarity} small /></span>
                    {!has && (
                      <span className="absolute right-1.5 top-1.5 rounded-full border-2 border-[#16181d] bg-white/90 p-1">
                        <Lock size={11} />
                      </span>
                    )}
                    {equipped && (
                      <span className="absolute bottom-1.5 left-1.5 rounded-full border-2 border-[#16181d] bg-[#3ddc84] px-2 py-0.5 text-[9px] font-black">EQUIPPED</span>
                    )}
                    {lvl > 0 && (
                      <span className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded-full border-2 border-[#16181d] bg-[#ffb700] px-1.5 py-0.5 text-[9px] font-black">
                        <Wrench size={9} />{lvl}
                      </span>
                    )}
                  </div>
                  <div className="px-2.5 pt-2">
                    <div className="truncate text-xs font-black">{v.name}</div>
                    <div className="mt-0.5 flex items-center justify-between text-[10px] font-black text-[#6b5a8e]">
                      <span>{v.cls}</span>
                      <span className="flex items-center gap-0.5"><Gauge size={10} />{vehicleRating(v)}</span>
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-1 p-2 pt-1.5">
                  {has ? (
                    <button
                      onClick={() => { click(); setGarage({ vehicle: v.id }); setSel(v.id); AudioMan.pickup(); }}
                      disabled={equipped}
                      className={`btn flex-1 px-2 py-1 text-[10px] font-black ${equipped ? "btn-green" : "btn-yellow"}`}
                    >
                      {equipped ? "✓ Equipped" : "Equip"}
                    </button>
                  ) : (
                    <span className="flex flex-1 items-center gap-1 text-[10px] font-black text-[#8b5cf6]">
                      <Coins size={11} /> {v.price.toLocaleString()}
                      {v.gems ? <><Gem size={10} className="ml-0.5" />{v.gems}</> : null}
                    </span>
                  )}
                  <button onClick={() => { click(); toggleFavorite(v.id); }} className="btn btn-white px-1.5 py-1" title="Favorite">
                    <Star size={12} className={fav ? "fill-[#ffd23f] text-[#ffb700]" : "text-[#a08fd0]"} />
                  </button>
                </div>
              </div>
            );
          })}
          {list.length === 0 && <p className="col-span-full p-6 text-center font-bold text-[#cbbdf3]">No cars match that search.</p>}
        </div>

        {/* ------- detail panel ------- */}
        <div className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
          <div className="card p-4">
            <div className="h-44 rounded-2xl border-[3px] border-[#16181d]">
              <Preview3D kind="kart" vehId={veh.id} charId={garage.character} paint={garage.paint} wheels={garage.wheels} hat={garage.hat} />
            </div>
            <div className="mt-2">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xl font-black leading-tight">{veh.name}</div>
                <button onClick={() => { click(); toggleFavorite(veh.id); }} className="btn btn-white px-2 py-1">
                  <Star size={14} className={favorites.includes(veh.id) ? "fill-[#ffd23f] text-[#ffb700]" : "text-[#a08fd0]"} />
                </button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <RarityBadge rarity={veh.rarity} />
                <span className="rounded-full border-2 border-[#16181d] bg-[#f3ecff] px-2 py-0.5 text-[10px] font-black">{veh.cls}</span>
                <span className="rounded-full border-2 border-[#16181d] bg-[#fff3c4] px-2 py-0.5 text-[10px] font-black">RATING {vehicleRating(veh)}</span>
              </div>
            </div>

            {msg && <p className="mt-2 rounded-xl border-2 border-dashed border-[#c9b8f5] bg-[#f7f2ff] p-2 text-xs font-black text-[#8b5cf6]">{msg}</p>}

            {/* panel tabs */}
            <div className="mt-3 flex gap-1.5">
              {([["stats", "Stats"], ["tune", "Tune"], ["style", "Style"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => { click(); setPanel(k); }}
                  className={`btn flex-1 px-2 py-1.5 text-xs font-black ${panel === k ? "btn-teal" : "btn-white"}`}>
                  {label}
                </button>
              ))}
            </div>

            {panel === "stats" && (
              <div className="mt-3">
                <div className="rounded-2xl border-[3px] border-[#16181d] bg-[#e9fbff] p-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-black text-[#00838f]"><Zap size={13} /> {veh.ability.name}</div>
                  <p className="text-[11px] font-bold text-[#5b4a80]">{veh.ability.desc}</p>
                </div>
                <p className="mt-2 text-xs font-bold text-[#6b5a8e]">{veh.desc}</p>
                <div className="mt-3">
                  <StatBar label="Acceleration" v={tuned.accel} bonus={+(tuned.accel - veh.accel).toFixed(1)} />
                  <StatBar label="Top speed" v={tuned.top} bonus={+(tuned.top - veh.top).toFixed(1)} />
                  <StatBar label="Handling" v={tuned.handling} bonus={+(tuned.handling - veh.handling).toFixed(1)} />
                  <StatBar label="Drift" v={tuned.drift} bonus={+(tuned.drift - veh.drift).toFixed(1)} />
                  <StatBar label="Weight" v={tuned.weight} />
                </div>
              </div>
            )}

            {panel === "tune" && (
              <div className="mt-3">
                {!owned(veh.id) ? (
                  <p className="rounded-xl border-2 border-dashed border-[#c9b8f5] bg-[#f7f2ff] p-3 text-xs font-black text-[#8b5cf6]">
                    Buy this car to unlock tuning.
                  </p>
                ) : (
                  <>
                    <div className="mb-2 flex items-center justify-between text-xs font-black">
                      <span className="flex items-center gap-1.5"><Wrench size={13} /> TUNING</span>
                      <span className="text-[#8b5cf6]">{upgradeTotal(ups)}/{UPGRADES.length * MAX_UPGRADE_LEVEL}</span>
                    </div>
                    {UPGRADES.map((u) => {
                      const lvl = ups[u.key];
                      const maxed = lvl >= MAX_UPGRADE_LEVEL;
                      const cost = maxed ? 0 : upgradeCost(veh, u.key, lvl + 1);
                      return (
                        <div key={u.key} className="mb-2 rounded-2xl border-[3px] border-[#16181d] bg-white p-2.5">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-black" style={{ color: u.color }}>
                              <UpgradeIcon k={u.key} size={14} /> {u.name}
                            </span>
                            <span className="flex gap-0.5">
                              {Array.from({ length: MAX_UPGRADE_LEVEL }, (_, i) => (
                                <span key={i} className="h-3 w-3 rounded-sm border-2 border-[#16181d]"
                                  style={{ background: i < lvl ? u.color : "#e8e2f5" }} />
                              ))}
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] font-bold text-[#6b5a8e]">{u.desc}</p>
                          <div className="mt-1.5">
                            {maxed ? (
                              <span className="flex items-center justify-center gap-1 rounded-full border-2 border-[#16181d] bg-[#ffd700] py-1 text-[10px] font-black">
                                <Check size={11} /> MAXED
                              </span>
                            ) : (
                              <button
                                onClick={() => void doUpgrade(u.key)}
                                disabled={busy || !profile || (profile?.coins ?? 0) < cost}
                                className="btn btn-yellow w-full px-2 py-1 text-[11px] font-black"
                              >
                                Upgrade → Lv{lvl + 1} · <Coins size={10} className="inline" /> {cost}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {panel === "style" && (
              <div className="mt-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-black"><Paintbrush size={14} /> PAINT</div>
                <div className="flex flex-wrap gap-2">
                  {PAINTS.map((c) => (
                    <button key={c}
                      className={`h-8 w-8 rounded-xl border-[3px] border-[#16181d] transition-transform hover:scale-110 ${garage.paint === c ? "ring-4 ring-[#2dd4c8]" : ""}`}
                      style={{ background: c, boxShadow: "0 3px 0 #16181d" }}
                      onClick={() => { click(); setGarage({ paint: c }); }} />
                  ))}
                </div>
                <div className="mb-2 mt-4 flex items-center gap-2 text-xs font-black"><CircleDot size={14} /> WHEELS</div>
                <div className="flex flex-wrap gap-2">
                  {WHEELS.map((w) => {
                    const isOwned = wheelsOwned(w.id);
                    return (
                      <button key={w.id}
                        className={`btn px-2.5 py-1.5 text-[11px] font-black ${garage.wheels === w.id ? "btn-teal" : "btn-white"}`}
                        onClick={async () => {
                          click();
                          if (isOwned) { setGarage({ wheels: w.id }); return; }
                          const r = await buyItem("wheels", w.id);
                          if (r.ok) { AudioMan.itemGot(); setGarage({ wheels: w.id }); }
                          else flash(r.error ?? "Could not buy.");
                        }}>
                        {w.name} {!isOwned && (profile ? `· ${w.price}c` : <Lock size={10} className="inline" />)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* actions */}
            <div className="mt-3 flex flex-wrap gap-2">
              {owned(veh.id) ? (
                <>
                  <Btn tone={garage.vehicle === veh.id ? "btn-green" : "btn-yellow"} onClick={() => { setGarage({ vehicle: veh.id }); AudioMan.pickup(); }}>
                    {garage.vehicle === veh.id ? "Equipped ✓" : "Equip"}
                  </Btn>
                  <Btn tone="btn-white" onClick={() => { setGarage({ vehicle: veh.id }); startRace({ mode: "practice", track: "candy-rush" }); }}>
                    <span className="flex items-center gap-1.5"><Play size={14} /> Test drive</span>
                  </Btn>
                </>
              ) : (
                <>
                  <Btn tone="btn-pink" disabled={busy || !profile || (profile?.coins ?? 0) < veh.price} onClick={() => void doBuy("coins")}>
                    <span className="flex items-center gap-1.5"><Coins size={15} /> {veh.price.toLocaleString()}</span>
                  </Btn>
                  {veh.gems !== undefined && (
                    <Btn tone="btn-purple" disabled={busy || !profile || (profile?.gems ?? 0) < veh.gems} onClick={() => void doBuy("gems")}>
                      <span className="flex items-center gap-1.5"><Gem size={14} /> {veh.gems}</span>
                    </Btn>
                  )}
                </>
              )}
            </div>
            {!profile && <p className="mt-2 text-[11px] font-bold text-[#8b5cf6]">Sign in to buy, tune and keep cars permanently.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}


// ===========================================================================
// CHARACTERS
// ===========================================================================
function Characters() {
  const garage = useApp((s) => s.garage);
  const setGarage = useApp((s) => s.setGarage);
  const profile = useApp((s) => s.profile);
  const buyItem = useApp((s) => s.buyItem);
  const [msg, setMsg] = useState<string | null>(null);
  const ch = CHARACTERS.find((c) => c.id === garage.character) ?? CHARACTERS[0];
  const owned = (id: string) => profile?.unlocked.characters.includes(id) ?? ["captain-noodle", "granny-turbo"].includes(id);
  const hatOwned = (id: string) => profile?.unlocked.hats.includes(id) ?? id === "none";
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20">
      <div className="flex items-center justify-between py-4"><Back /><Wallet /></div>
      <ScreenTitle icon={<Smile size={24} />} sub="Eight original oddballs. Each one fully unqualified to drive.">Characters</ScreenTitle>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <div className="h-64">
            <Preview3D kind="char" vehId={garage.vehicle} charId={ch.id} paint={garage.paint} wheels={garage.wheels} hat={garage.hat} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-2xl font-black">{ch.name}</div>
              <p className="text-sm font-bold text-[#6b5a8e]">{ch.desc}</p>
            </div>
            {!owned(ch.id) ? (
              <Btn tone="btn-pink" disabled={!profile || (profile?.coins ?? 0) < ch.price}
                onClick={async () => {
                  const r = await buyItem("characters", ch.id);
                  if (r.ok) { AudioMan.itemGot(); flash(`${ch.name} joined your squad!`); }
                  else flash(r.error ?? "Purchase failed.");
                }}>
                Unlock · {ch.price}c
              </Btn>
            ) : (
              <span className="flex shrink-0 items-center gap-1 rounded-full border-2 border-[#16181d] bg-[#3ddc84] px-3 py-1 text-xs font-black"><Check size={14} /> In squad</span>
            )}
          </div>
          {msg && <p className="mt-2 text-xs font-black text-[#8b5cf6]">{msg}</p>}
          <div className="mt-4 mb-2 text-sm font-black">HAT STYLE</div>
          <div className="flex flex-wrap gap-2">
            {HATS.map((h) => {
              const isOwned = hatOwned(h.id);
              return (
                <button
                  key={h.id}
                  className={`btn px-3 py-2 text-xs font-black ${garage.hat === h.id ? "btn-purple" : "btn-white"}`}
                  onClick={async () => {
                    click();
                    if (isOwned) { setGarage({ hat: h.id }); return; }
                    const r = await buyItem("hats", h.id);
                    if (r.ok) { AudioMan.itemGot(); setGarage({ hat: h.id }); }
                    else flash(r.error ?? "Purchase failed.");
                  }}
                >
                  {h.name} {!isOwned && (profile ? `· ${h.price}c` : <Lock size={11} className="inline" />)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 self-start sm:grid-cols-2">
          {CHARACTERS.map((c) => (
            <button
              key={c.id}
              onMouseEnter={hover}
              onClick={() => { click(); setGarage({ character: c.id }); }}
              className={`card flex items-center gap-3 p-3 text-left transition-transform hover:-translate-y-0.5 ${garage.character === c.id ? "ring-4 ring-[#2dd4c8]" : ""}`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[#16181d] text-lg font-black text-white"
                style={{ background: c.shirt }}>
                {c.name.slice(0, 1)}
              </span>
              <span>
                <span className="block text-sm font-black">{c.name} {!owned(c.id) && <Lock size={11} className="inline" />}</span>
                <span className="block text-[11px] font-bold text-[#6b5a8e]">{c.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}



// ===========================================================================
// SHOP
// ===========================================================================
function Shop() {
  const profile = useApp((s) => s.profile);
  const buyItem = useApp((s) => s.buyItem);
  const buyBundle = useApp((s) => s.buyBundle);
  const buyGems = useApp((s) => s.buyGems);
  const openCrate = useApp((s) => s.openCrate);
  const [tab, setTab] = useState<"crates" | "bundles" | "cosmetics" | "gems">("crates");
  const [cosTab, setCosTab] = useState<"hats" | "wheels" | "horns" | "dances">("hats");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ name: string; rarity: string; kind: string; id?: string; coinsBack?: number } | null>(null);

  const lists: Record<string, readonly { id: string; name: string; price: number }[]> = { hats: HATS, wheels: WHEELS, horns: HORNS, dances: DANCES };
  const ownedIn = (kind: string, id: string) => {
    if (!profile) return (lists[kind]?.find((x) => x.id === id)?.price ?? 0) === 0;
    return profile.unlocked[kind as keyof Unlocks].includes(id);
  };

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500); };

  const doCrate = async (crateId: string) => {
    if (busy) return;
    setBusy(true);
    setOpening(crateId);
    AudioMan.startBoost();
    // suspense roll
    await new Promise((r) => setTimeout(r, 1200));
    AudioMan.stopBoost();
    const res = await openCrate(crateId);
    setOpening(null);
    setBusy(false);
    if (!res.ok) { flash(res.error ?? "Crate jammed."); return; }
    if (res.reward) {
      AudioMan.victoryFanfare();
      setReveal({ name: res.reward.name, rarity: res.reward.rarity, kind: res.reward.kind, id: res.reward.id, coinsBack: res.coinsBack });
    } else {
      AudioMan.coinChime();
      setReveal({ name: "Duplicate protection payout", rarity: "common", kind: "coins", coinsBack: res.coinsBack });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20">
      <div className="flex items-center justify-between py-4"><Back /><Wallet /></div>
      <ScreenTitle icon={<ShoppingBag size={24} />} sub="Crates, bundles and cosmetics. 100% cosmetic — zero pay-to-win, zero real money.">
        Dealership
      </ScreenTitle>

      {!profile && <div className="card-dark mb-4 p-4 text-sm font-bold">Sign in (top-left) to earn coins, gems and unlock goodies.</div>}
      {msg && <div className="card mb-4 p-3 text-sm font-black text-[#8b5cf6]">{msg}</div>}

      <div className="mb-4 flex flex-wrap gap-2">
        {([["crates", "Crates"], ["bundles", "Bundles"], ["cosmetics", "Cosmetics"], ["gems", "Gem Exchange"]] as const).map(([t, label]) => (
          <button key={t} onClick={() => { click(); setTab(t); }} className={`btn px-4 py-2 text-sm ${tab === t ? "btn-yellow" : "btn-dark"}`}>{label}</button>
        ))}
      </div>

      {/* ---------------- CRATES ---------------- */}
      {tab === "crates" && (
        <>
          <p className="mb-3 text-sm font-bold text-[#cbbdf3]">
            Crates roll a random car you <b>don&apos;t own yet</b> — the roll happens on the server, and you can never get a duplicate.
            Own everything in a tier? You get cosmetics or a coin payout instead.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {CRATES.map((c) => (
              <div key={c.id} className="card overflow-hidden p-0">
                <div className="flex h-28 items-center justify-center" style={{ background: `linear-gradient(140deg, ${c.color}, #ffffff)` }}>
                  <Package size={54} className={`text-[#16181d] ${opening === c.id ? "anim-shake" : "anim-bob"}`} />
                </div>
                <div className="p-4">
                  <div className="text-lg font-black">{c.name}</div>
                  <p className="mt-0.5 text-xs font-bold text-[#6b5a8e]">{c.desc}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(Object.keys(c.odds) as Rarity[]).filter((r) => c.odds[r] > 0).map((r) => (
                      <span key={r} className="rounded-full border-2 border-[#16181d] px-2 py-0.5 text-[9px] font-black text-[#16181d]"
                        style={{ background: RARITY_META[r].color }}>
                        {RARITY_META[r].name} {c.odds[r]}%
                      </span>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Btn
                      tone={c.currency === "gems" ? "btn-purple" : "btn-yellow"}
                      className="w-full"
                      disabled={busy || !profile || (c.currency === "gems" ? (profile?.gems ?? 0) < c.price : (profile?.coins ?? 0) < c.price)}
                      onClick={() => void doCrate(c.id)}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        {opening === c.id ? "Opening…" : <>Open · {c.price} {c.currency === "gems" ? <Gem size={14} /> : <Coins size={14} />}</>}
                      </span>
                    </Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---------------- BUNDLES ---------------- */}
      {tab === "bundles" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {BUNDLES.map((b) => {
            const allOwned = profile ? b.items.every((i) => profile.unlocked[i.kind as keyof Unlocks].includes(i.id)) : false;
            const value = b.items.reduce((sum, i) => {
              if (i.kind === "vehicles") return sum + (VEHICLES.find((v) => v.id === i.id)?.price ?? 0);
              const l = lists[i.kind];
              return sum + (l?.find((x) => x.id === i.id)?.price ?? 0);
            }, 0);
            const save = Math.max(0, Math.round((1 - b.coins / Math.max(1, value)) * 100));
            return (
              <div key={b.id} className="card overflow-hidden p-0">
                <div className="flex items-center justify-between p-4" style={{ background: `linear-gradient(120deg, ${b.color}, #ffffff)` }}>
                  <div>
                    <div className="text-lg font-black">{b.name}</div>
                    <p className="text-xs font-bold text-[#3a2f5c]">{b.desc}</p>
                  </div>
                  {save > 0 && (
                    <span className="shrink-0 rounded-full border-2 border-[#16181d] bg-[#ff4d6d] px-2.5 py-1 text-xs font-black text-white">-{save}%</span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-1.5">
                    {b.items.map((i) => {
                      const v = i.kind === "vehicles" ? VEHICLES.find((x) => x.id === i.id) : undefined;
                      const label = v?.name ?? (lists[i.kind]?.find((x) => x.id === i.id)?.name ?? i.id);
                      const ownedThis = profile?.unlocked[i.kind as keyof Unlocks].includes(i.id);
                      return (
                        <span key={i.kind + i.id}
                          className={`flex items-center gap-1 overflow-hidden rounded-xl border-2 border-[#16181d] py-1 pr-2 text-[10px] font-black ${ownedThis ? "bg-[#d1f7e6]" : "bg-[#f3ecff]"} ${v ? "pl-0" : "pl-2"}`}>
                          {v ? <CarImage vehId={v.id} className="h-7 w-10" backdrop /> : <PartyPopper size={11} />} {label}{ownedThis ? " ✓" : ""}
                        </span>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {allOwned ? (
                      <span className="flex items-center gap-1 rounded-full border-2 border-[#16181d] bg-[#3ddc84] px-3 py-1.5 text-xs font-black"><Check size={13} /> Fully owned</span>
                    ) : (
                      <>
                        <Btn tone="btn-yellow" disabled={busy || !profile || (profile?.coins ?? 0) < b.coins}
                          onClick={async () => {
                            setBusy(true);
                            const r = await buyBundle(b.id, "coins");
                            setBusy(false);
                            if (r.ok) { AudioMan.victoryFanfare(); flash(`${b.name} unlocked — ${r.granted} new item(s)!`); }
                            else flash(r.error ?? "Purchase failed.");
                          }}>
                          <span className="flex items-center gap-1.5"><Coins size={14} /> {b.coins.toLocaleString()}</span>
                        </Btn>
                        {b.gems !== undefined && (
                          <Btn tone="btn-purple" disabled={busy || !profile || (profile?.gems ?? 0) < b.gems}
                            onClick={async () => {
                              setBusy(true);
                              const r = await buyBundle(b.id, "gems");
                              setBusy(false);
                              if (r.ok) { AudioMan.victoryFanfare(); flash(`${b.name} unlocked!`); }
                              else flash(r.error ?? "Purchase failed.");
                            }}>
                            <span className="flex items-center gap-1.5"><Gem size={13} /> {b.gems}</span>
                          </Btn>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------- COSMETICS ---------------- */}
      {tab === "cosmetics" && (
        <>
          <div className="mb-4 flex gap-2">
            {(["hats", "wheels", "horns", "dances"] as const).map((t) => (
              <button key={t} onClick={() => { click(); setCosTab(t); }} className={`btn px-4 py-2 text-sm capitalize ${cosTab === t ? "btn-teal" : "btn-dark"}`}>{t}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {lists[cosTab].map((item) => {
              const isOwned = ownedIn(cosTab, item.id);
              return (
                <div key={item.id} className="card p-4">
                  <div className="flex h-16 items-center justify-center">
                    {cosTab === "hats" && <PartyPopper size={38} className="text-[#ff5ca8]" />}
                    {cosTab === "wheels" && <CircleDot size={38} className="text-[#2dd4c8]" />}
                    {cosTab === "horns" && <Volume2 size={38} className="text-[#8b5cf6]" />}
                    {cosTab === "dances" && <Music2 size={38} className="text-[#ff7f2a]" />}
                  </div>
                  <div className="mt-2 text-center text-sm font-black">{item.name}</div>
                  <div className="mt-2 flex justify-center">
                    {isOwned ? (
                      <span className="flex items-center gap-1 rounded-full border-2 border-[#16181d] bg-[#3ddc84] px-3 py-1 text-xs font-black"><Check size={13} /> Owned</span>
                    ) : (
                      <Btn tone="btn-yellow" disabled={busy || !profile || (profile?.coins ?? 0) < item.price}
                        onClick={async () => {
                          setBusy(true);
                          const r = await buyItem(cosTab as keyof Unlocks, item.id);
                          setBusy(false);
                          if (r.ok) { AudioMan.itemGot(); flash(`${item.name} unlocked!`); }
                          else flash(r.error ?? "Purchase failed.");
                        }}>
                        {item.price}c
                      </Btn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ---------------- GEM EXCHANGE ---------------- */}
      {tab === "gems" && (
        <>
          <p className="mb-3 text-sm font-bold text-[#cbbdf3]">
            Gems are earned by racing — never bought with real money. Trade your racing coins for gems to grab legendary cars and Legend Crates.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {GEM_EXCHANGE.map((g) => (
              <div key={g.id} className="card p-5 text-center">
                <Gem size={44} className="mx-auto text-[#a06cd5]" />
                <div className="mt-2 text-2xl font-black">{g.gems} gems</div>
                <div className="text-sm font-black">{g.name}</div>
                <p className="mt-1 text-xs font-bold text-[#6b5a8e]">{g.desc}</p>
                <div className="mt-3">
                  <Btn tone="btn-purple" className="w-full" disabled={busy || !profile || (profile?.coins ?? 0) < g.coins}
                    onClick={async () => {
                      setBusy(true);
                      const r = await buyGems(g.id);
                      setBusy(false);
                      if (r.ok) { AudioMan.coinChime(); flash(`+${g.gems} gems!`); }
                      else flash(r.error ?? "Exchange failed.");
                    }}>
                    <span className="flex items-center justify-center gap-1.5"><Coins size={14} /> {g.coins.toLocaleString()}</span>
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card-dark mt-6 p-4 text-sm font-bold text-[#cbbdf3]">
        Earn coins &amp; gems by racing, finishing daily challenges and grabbing achievements. Press <b>H</b> mid-race to honk your equipped horn.
        Every purchase is validated on the server — prices and crate rolls can&apos;t be faked.
      </div>

      {/* ---------------- CRATE REVEAL ---------------- */}
      {reveal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setReveal(null)}>
          <div className="card anim-pop w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-black tracking-[0.25em] text-[#8b5cf6]">CRATE OPENED</p>
            {reveal.kind === "vehicles" && reveal.id ? (
              <CarImage vehId={reveal.id} className="mx-auto mt-3 h-28 w-40 rounded-3xl border-[3px] border-[#16181d]" />
            ) : (
              <div className="mx-auto mt-3 flex h-24 w-24 items-center justify-center rounded-3xl border-[3px] border-[#16181d]"
                style={{ background: RARITY_META[(reveal.rarity as Rarity)] ? RARITY_META[reveal.rarity as Rarity].color : "#ffd23f" }}>
                {reveal.kind === "coins" ? <Coins size={46} /> : <PartyPopper size={46} />}
              </div>
            )}
            <h3 className="mt-3 text-2xl font-black capitalize">{reveal.name}</h3>
            {RARITY_META[reveal.rarity as Rarity] && reveal.kind !== "coins" && (
              <div className="mt-1 flex justify-center"><RarityBadge rarity={reveal.rarity as Rarity} /></div>
            )}
            {reveal.coinsBack ? <p className="mt-2 text-sm font-black text-[#28a765]">+{reveal.coinsBack} coins</p> : null}
            <div className="mt-4"><Btn tone="btn-green" className="w-full" onClick={() => setReveal(null)}>Sweet!</Btn></div>
          </div>
        </div>
      )}
    </div>
  );
}


// ===========================================================================
// EVENTS
// ===========================================================================
function Events() {
  const profile = useApp((s) => s.profile);
  const claimDaily = useApp((s) => s.claimDaily);
  const claimAchievement = useApp((s) => s.claimAchievement);
  const claimedAch = useApp((s) => s.achievementsClaimed);
  const daysToWeekend = (7 - new Date().getDay()) % 7 || 7;
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20">
      <div className="flex items-center justify-between py-4"><Back /><Wallet /></div>
      <ScreenTitle icon={<CalendarDays size={24} />} sub="Fresh chaos served daily.">Events & Challenges</ScreenTitle>

      <div className="card-dark mb-6 flex flex-col items-start gap-2 p-5 md:flex-row md:items-center md:justify-between"
        style={{ background: "linear-gradient(90deg, #7b2ff7, #ff5ca8)" }}>
        <div>
          <div className="text-2xl font-black">WINTER WOBBLE CUP</div>
          <p className="text-sm font-bold text-[#ffe3f3]">Seasonal event: double coins on Penguin Ice Road all season. Ends in {daysToWeekend} day{daysToWeekend === 1 ? "" : "s"}!</p>
        </div>
        <PartyPopper size={44} />
      </div>

      <h3 className="mb-3 text-xl font-black text-white text-outline">Daily Challenges</h3>
      {!profile && <p className="mb-4 text-sm font-bold text-[#a08fd0]">Sign in to track and claim daily rewards.</p>}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DAILIES.map((d) => {
          const progress = profile?.dailies?.progress?.[d.id] ?? 0;
          const done = progress >= d.target;
          const claimed = profile?.dailies?.claimed?.includes(d.id) ?? false;
          return (
            <div key={d.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="text-base font-black">{d.name}</div>
                <span className="text-xs font-black text-[#8b5cf6]">+{d.reward}c</span>
              </div>
              <p className="text-xs font-bold text-[#6b5a8e]">{d.desc}</p>
              <div className="stat-track mt-3 h-4"><div className="stat-fill" style={{ width: `${Math.min(100, (progress / d.target) * 100)}%` }} /></div>
              <div className="mt-1 flex items-center justify-between text-[11px] font-black">
                <span>{Math.min(progress, d.target)}/{d.target}</span>
                {claimed ? <span className="text-[#3ddc84]">Claimed!</span>
                  : done ? (
                    <button className="btn btn-green px-3 py-1 text-xs" onClick={() => { click(); void claimDaily(d.id, d.reward); AudioMan.itemGot(); }}>CLAIM</button>
                  ) : <span className="text-[#a08fd0]">In progress</span>}
              </div>
            </div>
          );
        })}
      </div>

      <h3 className="mb-3 text-xl font-black text-white text-outline">Achievements</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const derived: Record<string, number> = {
            carsOwned: profile?.unlocked.vehicles.length ?? 0,
            upgradeLevels: Object.values(profile?.upgrades ?? {}).reduce(
              (sum, car) => sum + Object.values(car ?? {}).reduce((s2, lv) => s2 + (lv ?? 0), 0), 0),
          };
          const val = derived[a.metric] ?? (profile?.stats as unknown as Record<string, number> | undefined)?.[a.metric] ?? 0;
          const done = val >= a.target;
          const claimed = claimedAch.includes(a.id);
          return (
            <div key={a.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-base font-black"><Medal size={16} className="text-[#ffb700]" />{a.name}</div>
                <span className="text-xs font-black text-[#8b5cf6]">+{a.reward}c</span>
              </div>
              <p className="text-xs font-bold text-[#6b5a8e]">{a.desc}</p>
              <div className="stat-track mt-3 h-4"><div className="stat-fill" style={{ width: `${Math.min(100, (val / a.target) * 100)}%` }} /></div>
              <div className="mt-1 flex items-center justify-between text-[11px] font-black">
                <span>{Math.min(val, a.target)}/{a.target}</span>
                {claimed ? <span className="text-[#3ddc84]">Claimed!</span>
                  : done ? (
                    <button className="btn btn-green px-3 py-1 text-xs" onClick={() => { click(); claimAchievement(a.id, a.reward); AudioMan.coinChime(); }}>CLAIM</button>
                  ) : <span className="text-[#a08fd0]">{val > 0 ? "Keep going!" : "Locked…"}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// LEADERBOARDS
// ===========================================================================
function Ranks() {
  const [tab, setTab] = useState<string>("candy-rush");
  const [laps, setLaps] = useState<{ name: string; vehicle: string; lapMs: number }[]>([]);
  const [players, setPlayers] = useState<{ name: string; xp: number; stats: { wins: number; races: number } }[]>([]);
  const [loading, setLoading] = useState(true);
  const profile = useApp((s) => s.profile);

  useEffect(() => {
    let alive = true;
    const url = tab === "__players__" ? "/api/leaderboard?top=players" : `/api/leaderboard?track=${tab}`;
    const kick = setTimeout(() => { if (alive) setLoading(true); }, 0);
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (tab === "__players__") setPlayers(d.players ?? []);
        else setLaps(d.laps ?? []);
        setLoading(false);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; clearTimeout(kick); };
  }, [tab]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20">
      <div className="flex items-center justify-between py-4"><Back /><Wallet /></div>
      <ScreenTitle icon={<Trophy size={24} />} sub="Best laps per track and the XP royalty. Server-verified.">Leaderboards</ScreenTitle>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {TRACKS.map((t) => (
          <button key={t.id} onClick={() => { click(); setTab(t.id); }}
            className={`btn shrink-0 px-4 py-2 text-xs font-black ${tab === t.id ? "btn-teal" : "btn-dark"}`}>{t.name}</button>
        ))}
        <button onClick={() => { click(); setTab("__players__"); }}
          className={`btn shrink-0 px-4 py-2 text-xs font-black ${tab === "__players__" ? "btn-yellow" : "btn-dark"}`}>Top Racers</button>
      </div>
      <div className="card-dark p-4">
        {loading ? (
          <p className="p-6 text-center font-bold text-[#cbbdf3]">Fetching glory…</p>
        ) : tab === "__players__" ? (
          players.length === 0 ? <p className="p-6 text-center font-bold text-[#cbbdf3]">No racers yet. Be the first legend.</p> : (
            <table className="w-full text-left text-sm font-bold">
              <thead><tr className="text-xs text-[#a08fd0]"><th className="p-2">#</th><th className="p-2">Racer</th><th className="p-2">Level</th><th className="p-2">XP</th><th className="p-2">Wins</th><th className="p-2">Races</th></tr></thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={p.name} className={i % 2 ? "bg-white/5" : ""}>
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2 font-black">{p.name}{profile?.name === p.name && <span className="ml-1 text-[#2dd4c8]">(you)</span>}</td>
                    <td className="p-2">{levelFromXp(p.xp)}</td>
                    <td className="p-2">{p.xp.toLocaleString()}</td>
                    <td className="p-2">{p.stats?.wins ?? 0}</td>
                    <td className="p-2">{p.stats?.races ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : laps.length === 0 ? (
          <p className="p-6 text-center font-bold text-[#cbbdf3]">No laps recorded on this track yet. The asphalt is virginal. Go ruin that.</p>
        ) : (
          <table className="w-full text-left text-sm font-bold">
            <thead><tr className="text-xs text-[#a08fd0]"><th className="p-2">#</th><th className="p-2">Racer</th><th className="p-2">Best lap</th><th className="p-2">Vehicle</th></tr></thead>
            <tbody>
              {laps.map((l, i) => (
                <tr key={l.name + i} className={i % 2 ? "bg-white/5" : ""}>
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2 font-black">{l.name}{profile?.name === l.name && <span className="ml-1 text-[#2dd4c8]">(you)</span>}</td>
                  <td className="p-2 font-black text-[#ffd23f]">{fmtTime(l.lapMs)}</td>
                  <td className="p-2 capitalize">{l.vehicle.replace(/-/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// FRIENDS (P2P MULTIPLAYER)
// ===========================================================================
function Friends() {
  const profile = useApp((s) => s.profile);
  const garage = useApp((s) => s.garage);
  const startRace = useStartRace();
  const [tab, setTab] = useState<"host" | "join">("host");
  const [status, setStatus] = useState("Pick a side: host a room or join one.");
  const roomRef = useRef<P2PRoom | null>(null);
  const [room, setRoom] = useState<P2PRoom | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [answerCode, setAnswerCode] = useState("");
  const [hostAnswerInput, setHostAnswerInput] = useState("");
  const [roster, setRoster] = useState<PeerRecord[]>([]);
  const [track, setTrack] = useState("candy-rush");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const guestSlotRef = useRef(0);
  const pendingGuestRef = useRef<string>("");

  const me: PeerRecord = useMemo(() => ({
    id: tab === "host" ? "host-player" : P2PRoom.genId(),
    name: profile?.name ?? `Guest-${Math.floor(Math.random() * 999)}`,
    vehicle: garage.vehicle,
    character: garage.character,
    paint: garage.paint,
  }), [profile?.name, garage.vehicle, garage.character, garage.paint, tab]);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard blocked */ }
  };

  const cleanup = useEffectCleanup(roomRef, setRoom, setRoster, setStatus);

  // ---- HOST ----
  const hostCreate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      cleanup();
      const r = P2PRoom.createHost({ ...me, id: "host-player" });
      roomRef.current = r;
      setRoom(r);
      setRoster([{ ...me, id: "host-player" }]);
      r.onMessage((from, m) => {
        if (m.t === "hello") {
          const peer = m.peer as PeerRecord;
          r.rekeyLastTo(peer.id);
          r.registerPeer(peer);
          setRoster((prev) => [...prev.filter((p) => p.id !== peer.id), peer]);
          r.send({ t: "lobby", track, roster: [{ ...me, id: "host-player" }, ...r.peers] });
          AudioMan.itemGot();
          setStatus(`${peer.name} joined the room!`);
        } else if (m.t === "state-update") {
          const peer = m.peer as PeerRecord;
          setRoster((prev) => prev.map((p) => (p.id === peer.id ? { ...p, ...peer } : p)));
          r.registerPeer({ ...(r.peers.find((p) => p.id === peer.id) ?? peer), ...peer });
          r.send({ t: "lobby", track, roster: [{ ...me, id: "host-player" }, ...r.peers] });
        }
        void from;
      });
      r.onPeerLeft((id) => {
        setRoster((prev) => prev.filter((p) => p.id !== id));
        setStatus("A friend left the room.");
      });
      setStatus("Room created! Generate an invite code and send it to a friend.");
    } finally {
      setBusy(false);
    }
  };

  const hostNewInvite = async () => {
    const r = roomRef.current;
    if (!r || busy) return;
    setBusy(true);
    try {
      const gid = `guest-${++guestSlotRef.current}`;
      pendingGuestRef.current = gid;
      const code = await r.makeInvite(gid);
      r.tagPending(gid);
      setInviteCode(code);
      setStatus("Invite code ready — send it to your friend. When they reply with an ANSWER code, paste it below.");
    } catch {
      setStatus("Could not create invite. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const hostAccept = async () => {
    const r = roomRef.current;
    if (!r || !hostAnswerInput.trim() || busy) return;
    setBusy(true);
    try {
      await r.acceptAnswer(pendingGuestRef.current, hostAnswerInput);
      setStatus("Connecting… waiting for the kart handshake.");
      setHostAnswerInput("");
    } catch {
      setStatus("That answer code did not work. Ask your friend to copy it again.");
    } finally {
      setBusy(false);
    }
  };

  const hostStart = () => {
    const r = roomRef.current;
    if (!r) return;
    const humans = [{ id: "host-player", name: me.name, vehicle: me.vehicle, character: me.character, paint: me.paint }, ...r.peers];
    const botDefs = makeBotDefs(humans.length);
    const payload = { t: "start_race", track, bots: botDefs, roster: humans };
    r.send(payload);
    audioStartJingle();
    startRace({
      mode: "multiplayer", track,
      net: {
        isHost: true, roomId: "p2p", peers: humans.filter((h) => h.id !== "host-player"),
        selfPeerId: "host-player", selfIsGuest: false, room: r, bots: botDefs,
      },
    });
  };

  // ---- JOIN ----
  const join = async () => {
    if (!joinCode.trim() || busy) return;
    setBusy(true);
    try {
      cleanup();
      const { room: r, answer } = await P2PRoom.join(joinCode, me);
      roomRef.current = r;
      setRoom(r);
      setAnswerCode(answer);
      setStatus("Answer code created! Send it back to the host, then wait here for the race to start.");
      r.onMessage((from, m) => {
        if (m.t === "lobby") {
          setRoster((m.roster as PeerRecord[]) ?? []);
          setTrack(String(m.track ?? "candy-rush"));
        } else if (m.t === "who") {
          r.send({ t: "hello", peer: me });
        } else if (m.t === "start_race") {
          const bots = (m.bots as { name: string; vehicle: string; character: string; paint: string }[]) ?? [];
          const roster2 = (m.roster as PeerRecord[]) ?? [];
          setRoster(roster2);
          audioStartJingle();
          startRace({
            mode: "multiplayer", track: String(m.track),
            net: {
              isHost: false, roomId: "p2p",
              peers: roster2.filter((p) => p.id !== me.id),
              selfPeerId: me.id, selfIsGuest: true, room: r, bots,
            },
          });
        }
        void from;
      });
      r.onPeerLeft(() => {
        setStatus("Host disconnected. Room closed.");
        setAnswerCode("");
        setRoster([]);
      });
      r.onOpen(() => {
        setStatus("Connected to the host! Waiting for them to start the race…");
        r.send({ t: "hello", peer: me });
        AudioMan.go();
      });
    } catch {
      setStatus("That invite code did not decode — get a fresh one from your host.");
    } finally {
      setBusy(false);
    }
  };

  const humans = roster.length;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20">
      <div className="flex items-center justify-between py-4"><Back /><Wallet /></div>
      <ScreenTitle icon={<Wifi size={24} />} sub="Real online racing with friends — peer-to-peer rooms, zero accounts needed.">
        Friends Room <span className="ml-1 align-middle text-xs font-black text-[#2dd4c8]">P2P ONLINE</span>
      </ScreenTitle>

      <div className="card-dark mb-4 flex items-start gap-3 p-4 text-sm font-bold text-[#cbbdf3]">
        <Info className="mt-0.5 shrink-0 text-[#2dd4c8]" size={18} />
        <p>
          Rooms work over encrypted WebRTC — your race travels directly browser&nbsp;→&nbsp;browser.
          Host generates an <b>INVITE CODE</b>, friend pastes it and gets an <b>ANSWER CODE</b>, host pastes the answer. Connected!
          The host simulates CPU rivals (clearly labeled) and calls the results. Hopping networks or very strict firewalls may block P2P.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <button className={`btn px-5 py-2.5 ${tab === "host" ? "btn-yellow" : "btn-dark"}`} onClick={() => { click(); setTab("host"); }}>Host a room</button>
        <button className={`btn px-5 py-2.5 ${tab === "join" ? "btn-teal" : "btn-dark"}`} onClick={() => { click(); setTab("join"); }}>Join a room</button>
      </div>

      {tab === "host" ? (
        <div className="card p-5">
          {!room ? (
            <Btn tone="btn-yellow" onClick={() => void hostCreate()} disabled={busy}>
              <span className="flex items-center gap-2"><PartyPopper size={17} /> Create Room</span>
            </Btn>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Btn tone="btn-teal" onClick={() => void hostNewInvite()} disabled={busy}>+ New invite code</Btn>
                {inviteCode && (
                  <button className="btn btn-white px-3 py-2 text-xs font-black" onClick={() => void copy(inviteCode, "invite")}>
                    <Copy size={13} className="mr-1 inline" />{copied === "invite" ? "Copied!" : "Copy invite"}
                  </button>
                )}
              </div>
              {inviteCode && (
                <>
                  <textarea
                    readOnly
                    className="h-24 w-full rounded-2xl border-[3px] border-[#16181d] bg-[#16181d] p-3 font-mono text-[10px] text-[#64ffda]"
                    value={inviteCode}
                    onFocus={(e) => e.target.select()}
                  />
                  <p className="text-xs font-bold text-[#6b5a8e]">Your friend pastes this into “Join”, gets an answer code, sends it back:</p>
                  <div className="flex gap-2">
                    <textarea
                      className="h-16 flex-1 rounded-2xl border-[3px] border-[#16181d] bg-white p-3 font-mono text-[10px]"
                      placeholder="Paste friend's ANSWER code here…"
                      value={hostAnswerInput}
                      onChange={(e) => setHostAnswerInput(e.target.value)}
                    />
                    <Btn tone="btn-green" onClick={() => void hostAccept()} disabled={busy || !hostAnswerInput.trim()}>Accept</Btn>
                  </div>
                </>
              )}
              <RoomRoster roster={roster} selfId="host-player" />
              <div>
                <div className="mb-2 text-sm font-black">PICK THE TRACK (host decides)</div>
                <div className="flex flex-wrap gap-2">
                  {TRACKS.map((t) => (
                    <button key={t.id} onClick={() => { click(); setTrack(t.id); }}
                      className={`btn px-3 py-1.5 text-xs font-black ${track === t.id ? "btn-purple" : "btn-white"}`}>{t.name}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Btn tone="btn-pink" onClick={hostStart} disabled={humans < 1}>
                  <span className="flex items-center gap-2"><Flag size={16} /> START RACE ({humans} human{humans === 1 ? "" : "s"} + CPUs)</span>
                </Btn>
                <Btn tone="btn-white" onClick={cleanup}>Close room</Btn>
              </div>
            </div>
          )}
          <p className="mt-4 text-sm font-black text-[#ff5ca8]">{status}</p>
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex flex-col gap-4">
            <textarea
              className="h-24 w-full rounded-2xl border-[3px] border-[#16181d] bg-white p-3 font-mono text-[10px]"
              placeholder="Paste the host's INVITE code here…"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <Btn tone="btn-teal" onClick={() => void join()} disabled={busy || !joinCode.trim()}>
              <span className="flex items-center gap-2"><Swords size={16} /> Join room</span>
            </Btn>
            {answerCode && (
              <>
                <p className="text-xs font-bold text-[#6b5a8e]">Send this ANSWER code back to your host (then wait here — the race will start automatically!):</p>
                <textarea
                  readOnly
                  className="h-24 w-full rounded-2xl border-[3px] border-[#16181d] bg-[#16181d] p-3 font-mono text-[10px] text-[#ffd23f]"
                  value={answerCode}
                  onFocus={(e) => e.target.select()}
                />
                <button className="btn btn-white self-start px-3 py-2 text-xs font-black" onClick={() => void copy(answerCode, "answer")}>
                  <Copy size={13} className="mr-1 inline" />{copied === "answer" ? "Copied!" : "Copy answer"}
                </button>
              </>
            )}
            <RoomRoster roster={roster} selfId={me.id} />
          </div>
          <p className="mt-4 text-sm font-black text-[#2dd4c8]">{status}</p>
        </div>
      )}
    </div>
  );
}

function RoomRoster({ roster, selfId }: { roster: PeerRecord[]; selfId: string }) {
  if (roster.length === 0) return null;
  return (
    <div className="card-dark p-3">
      <div className="mb-2 text-xs font-black text-[#a08fd0]">ROOM ROSTER</div>
      <div className="flex flex-wrap gap-2">
        {roster.map((p) => (
          <span key={p.id} className="flex items-center gap-2 rounded-full border-2 border-[#16181d] bg-white/10 px-3 py-1.5 text-xs font-black">
            <span className="h-3 w-3 rounded-full border border-[#16181d]" style={{ background: p.paint }} />
            {p.name}{p.id === selfId ? " (you)" : ""}
            <span className="text-[#a08fd0]">· {VEHICLES.find((v) => v.id === p.vehicle)?.name ?? "kart"}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function makeBotDefs(humanCount: number) {
  const names = ["Bot-zo the Clown", "Sir Bumpsalot", "Crash Test Daphne", "Roberto the Magnet", "Auntie Freeze", "Dr. Skidmarks"];
  const count = Math.max(0, 6 - humanCount);
  return Array.from({ length: count }, (_, i) => ({
    name: `${names[i % names.length]} (CPU)`,
    vehicle: VEHICLES[Math.floor(Math.random() * VEHICLES.length)].id,
    character: CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id,
    paint: ["#2e86ab", "#28c76f", "#a06cd5", "#ff5ca8", "#ffd23f", "#f28f3b"][i % 6],
  }));
}

function audioStartJingle() {
  AudioMan.ensure();
  AudioMan.go();
}

function useEffectCleanup(
  roomRef: React.MutableRefObject<P2PRoom | null>,
  setRoom: (r: P2PRoom | null) => void,
  setRoster: (r: PeerRecord[]) => void,
  setStatus: (s: string) => void,
) {
  return useCallback(() => {
    roomRef.current?.close();
    roomRef.current = null;
    setRoom(null);
    setRoster([]);
    setStatus("Room closed.");
  }, [roomRef, setRoom, setRoster, setStatus]);
}

// ===========================================================================
// SETTINGS
// ===========================================================================
function prettyKey(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return code.slice(5).toUpperCase();
  if (code === "Space") return "SPACE";
  if (code === "ShiftLeft") return "L-SHIFT";
  if (code === "ShiftRight") return "R-SHIFT";
  if (code === "ControlLeft") return "L-CTRL";
  if (code === "Enter") return "ENTER";
  return code.toUpperCase();
}

const BINDING_LABELS: { action: keyof KeyBindings; label: string }[] = [
  { action: "accel", label: "Accelerate" },
  { action: "brake", label: "Brake / Reverse" },
  { action: "left", label: "Steer Left" },
  { action: "right", label: "Steer Right" },
  { action: "drift", label: "Drift" },
  { action: "item", label: "Use Power-Up" },
  { action: "horn", label: "Horn" },
];

function SettingsScr() {
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const resetGuest = useApp((s) => s.resetGuest);
  const logout = useApp((s) => s.logout);
  const profile = useApp((s) => s.profile);
  const [confirm, setConfirm] = useState(false);
  const [binding, setBinding] = useState<keyof KeyBindings | null>(null);
  const [tiltNote, setTiltNote] = useState<string | null>(null);

  // capture a key while rebinding
  useEffect(() => {
    if (!binding) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") { setBinding(null); return; }
      const st = useApp.getState();
      const keys: Record<string, string> = { ...st.settings.keys };
      const oldCode = keys[binding];
      // swap on conflict so no key ever does two things
      for (const [act, code] of Object.entries(keys)) {
        if (code === e.code && act !== binding) keys[act] = oldCode;
      }
      keys[binding] = e.code;
      st.setSettings({ keys: keys as unknown as KeyBindings });
      AudioMan.pickup();
      setBinding(null);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [binding]);

  const toggleTilt = async () => {
    click();
    if (settings.tilt) { setSettings({ tilt: false }); setTiltNote(null); return; }
    // iOS 13+ needs a user-gesture permission grant for motion sensors
    try {
      const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
      if (typeof DOE.requestPermission === "function") {
        const res = await DOE.requestPermission();
        if (res !== "granted") { setTiltNote("Motion permission denied — your browser blocked tilt steering."); return; }
      }
      setSettings({ tilt: true });
      setTiltNote("Tilt steering ON — roll your phone like a steering wheel during races.");
    } catch {
      setTiltNote("Tilt sensors unavailable on this device.");
    }
  };
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20">
      <div className="py-4"><Back /></div>
      <ScreenTitle icon={<Settings size={24} />} sub="Tinker responsibly.">Settings</ScreenTitle>
      <div className="flex flex-col gap-4">
        <div className="card p-5">
          <Row label="Music" icon={<Music2 size={17} />}>
            <Toggle on={settings.music} onClick={() => { click(); const on = !settings.music; setSettings({ music: on }); AudioMan.ensure(); AudioMan.setMusicOn(on); }} />
          </Row>
          <Row label="Sound effects" icon={<Volume2 size={17} />}>
            <Toggle on={settings.sfx} onClick={() => { click(); const on = !settings.sfx; setSettings({ sfx: on }); AudioMan.setSfxOn(on); }} />
          </Row>
          <Row label="Graphics quality" icon={<MonitorSmartphone size={17} />}>
            <div className="flex gap-1">
              {(["low", "auto", "high"] as const).map((q) => (
                <button key={q} onClick={() => { click(); setSettings({ quality: q }); }}
                  className={`btn px-3 py-1 text-xs font-black capitalize ${settings.quality === q ? "btn-teal" : "btn-white"}`}>{q}</button>
              ))}
            </div>
          </Row>
          <Row label="Camera shake" icon={<Vibrate size={17} />}>
            <Toggle on={settings.shake} onClick={() => { click(); setSettings({ shake: !settings.shake }); }} />
          </Row>
          <Row label="Speed units" icon={<Ruler size={17} />}>
            <div className="flex gap-1">
              {(["kmh", "mph"] as const).map((u) => (
                <button key={u} onClick={() => { click(); setSettings({ units: u }); }}
                  className={`btn px-3 py-1 text-xs font-black uppercase ${settings.units === u ? "btn-yellow" : "btn-white"}`}>{u}</button>
              ))}
            </div>
          </Row>
        </div>

        {/* ======================= CONTROLS ======================= */}
        <div className="card p-5">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-black"><Keyboard size={17} /> CONTROLS</div>
            <Btn tone="btn-white" className="!px-3 !py-1.5 !text-xs" onClick={() => { setBinding(null); setSettings({ keys: { ...DEFAULT_KEYS } }); }}>
              Reset keys
            </Btn>
          </div>
          <p className="mb-2 text-[11px] font-bold text-[#8b5cf6]">
            Click a key chip and press any key to rebind it. Arrow keys always work as a second set. Esc pauses.
          </p>
          {binding && (
            <div className="anim-pop mb-2 rounded-2xl border-[3px] border-[#16181d] bg-[#ffd23f] px-4 py-2 text-sm font-black">
              Press a key for <span className="text-[#8b5cf6]">{BINDING_LABELS.find((b) => b.action === binding)?.label}</span>… (Esc to cancel)
            </div>
          )}
          {BINDING_LABELS.map((b) => (
            <Row key={b.action} label={b.label} icon={<ChevronRight size={14} className="text-[#a08fd0]" />}>
              <button
                onClick={() => { click(); setBinding(binding === b.action ? null : b.action); }}
                className={`btn px-3 py-1 text-xs font-black ${binding === b.action ? "btn-yellow anim-shake" : "btn-white"}`}
              >
                {binding === b.action ? "PRESS KEY…" : prettyKey(settings.keys[b.action])}
              </button>
            </Row>
          ))}
          <Row label="Steering response" icon={<Gauge size={17} />}>
            <div className="flex items-center gap-2">
              <input
                type="range" min={0.5} max={2} step={0.1} value={settings.sensitivity}
                onChange={(e) => setSettings({ sensitivity: Number(e.target.value) })}
                className="control-slider w-32 sm:w-40"
              />
              <span className="w-10 text-xs font-black">{settings.sensitivity.toFixed(1)}x</span>
            </div>
          </Row>

          <div className="mb-1 mt-4 flex items-center gap-2 border-t-2 border-dashed border-[#e2d5ff] pt-4 text-sm font-black">
            <Smartphone size={17} /> MOBILE / TOUCH
          </div>
          <Row label="Touch button size" icon={<Maximize2 size={17} />}>
            <div className="flex items-center gap-2">
              <input
                type="range" min={0.8} max={1.5} step={0.05} value={settings.touchScale}
                onChange={(e) => setSettings({ touchScale: Number(e.target.value) })}
                className="control-slider w-32 sm:w-40"
              />
              <span className="w-10 text-xs font-black">{Math.round(settings.touchScale * 100)}%</span>
            </div>
          </Row>
          <Row label="Swap sides (pedals left, steer right)" icon={<MoveHorizontal size={17} />}>
            <Toggle on={settings.swapTouch} onClick={() => { click(); setSettings({ swapTouch: !settings.swapTouch }); }} />
          </Row>
          <Row label="Tilt steering (gyro)" icon={<Gamepad2 size={17} />}>
            <Toggle on={settings.tilt} onClick={() => void toggleTilt()} />
          </Row>
          {tiltNote && <p className="mt-1 text-xs font-bold text-[#8b5cf6]">{tiltNote}</p>}
          {settings.tilt && (
            <p className="mt-2 rounded-xl border-2 border-dashed border-[#c9b8f5] bg-[#f3ecff] p-2 text-[11px] font-bold text-[#5b4a80]">
              While racing: hold your phone in landscape and roll it left/right like a steering wheel.
              The steering buttons hide while tilt is on; DRIFT / STOP / GAS stay put.
            </p>
          )}
        </div>
        <div className="card p-5">
          <div className="mb-2 text-sm font-black">ACCOUNT</div>
          {profile ? (
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Signed in as <b>{profile.name}</b></span>
              <Btn tone="btn-white" onClick={logout}>Sign out</Btn>
            </div>
          ) : (
            <p className="text-sm font-bold text-[#6b5a8e]">Playing as guest. Sign in from the main menu to save.</p>
          )}
          <div className="mt-4 border-t-2 border-dashed border-[#e2d5ff] pt-4">
            {!confirm ? (
              <Btn tone="btn-red" onClick={() => setConfirm(true)}>Reset local guest data</Btn>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-[#ff4d6d]">Are you sure? Guests lose coins & unlocks.</span>
                <Btn tone="btn-red" onClick={() => { resetGuest(); setConfirm(false); }}>Yes, wipe it</Btn>
                <Btn tone="btn-white" onClick={() => setConfirm(false)}>Cancel</Btn>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b-2 border-dashed border-[#e2d5ff] py-3 last:border-0">
      <span className="flex items-center gap-2 text-sm font-black">{icon} {label}</span>
      {children}
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`h-9 w-16 rounded-full border-[3px] border-[#16181d] p-1 shadow-[0_3px_0_#16181d] transition-colors ${on ? "bg-[#3ddc84]" : "bg-[#8d8d9e]"}`}>
      <span className={`block h-6 w-6 rounded-full bg-white transition-transform ${on ? "translate-x-6" : ""}`} />
    </button>
  );
}

// ===========================================================================
// HOW TO PLAY
// ===========================================================================
function HowTo() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-20">
      <div className="py-4"><Back /></div>
      <ScreenTitle icon={<Gamepad2 size={24} />} sub="Everything a chaos champion must know.">How to Play</ScreenTitle>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h4 className="mb-3 flex items-center gap-2 text-lg font-black"><Gamepad2 size={18} /> PC CONTROLS</h4>
          <p className="mb-2 text-xs font-bold text-[#8b5cf6]">Default bindings shown — fully remappable in Settings → Controls.</p>
          {[
            ["W / ↑", "Accelerate"], ["S / ↓", "Brake & reverse"], ["A,D / ←,→", "Steer"],
            ["SPACE (hold)", "Drift — release for mini-turbo!"], ["E", "Use power-up"], ["H", "Honk horn"], ["ESC", "Pause"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b-2 border-dashed border-[#e2d5ff] py-2 text-sm font-bold last:border-0">
              <span>{v}</span>
              <kbd className="rounded-lg border-2 border-[#16181d] bg-[#f3ecff] px-2 py-0.5 font-black shadow-[0_2px_0_#16181d]">{k}</kbd>
            </div>
          ))}
          <h4 className="mb-3 mt-5 flex items-center gap-2 text-lg font-black"><Target size={18} /> TOUCH CONTROLS</h4>
          <p className="text-sm font-bold text-[#6b5a8e]">
            On phones & tablets: steering buttons on the left, GAS / BRAKE / DRIFT on the right, and the item button pops up when you grab a ? box.
            Turn your phone sideways for maximum chaos.
          </p>
        </div>
        <div className="card p-5">
          <h4 className="mb-3 flex items-center gap-2 text-lg font-black"><Zap size={18} /> POWER-UPS</h4>
          <div className="grid grid-cols-1 gap-1.5">
            {POWERUPS.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-bold" style={{ background: p.color + "22" }}>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[#16181d]" style={{ background: p.color }}>
                  <PowerIcon id={p.id} size={15} />
                </span>
                <span className="font-black">{p.name}</span>
                <span className="text-xs text-[#6b5a8e]">{p.desc}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5 md:col-span-2">
          <h4 className="mb-2 flex items-center gap-2 text-lg font-black"><Flame size={18} /> PRO TIPS FROM GRANNY TURBO</h4>
          <ul className="list-inside list-disc text-sm font-bold text-[#5b4a80]">
            <li>Drifting charges a mini-turbo — gold sparks mean a BIG boost is ready.</li>
            <li>The kart in first place gets weak items. Being last is secretly powerful.</li>
            <li>Ramps + drift = backflips. Backflips = respect.</li>
            <li>Ice Road: steer early. Earlier than that. There you go. Still too late.</li>
            <li>A banana defense shield is just a banana you throw at your problems.</li>
            <li>The Shopping Cart restocks items faster. Shopping Cart is life.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// RESULTS
// ===========================================================================
export function ResultsView({ summary, onRematch, onMenu, onGpNext }: {
  summary: RaceSummary;
  onRematch: () => void;
  onMenu: () => void;
  onGpNext?: () => void;
}) {
  const profile = useApp((s) => s.profile);
  const isGp = summary.mode === "grandprix";
  const gpSorted = summary.gpScores ? Object.entries(summary.gpScores).sort((a, b) => b[1] - a[1]) : [];
  const winner = summary.position === 1 || (summary.teamScores ? summary.teamScores[0] > summary.teamScores[1] : false);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      {winner && <Confetti />}
      <div className="card anim-pop relative w-full max-w-2xl p-6">
        <div className="text-center">
          <p className="text-sm font-black tracking-[0.25em] text-[#8b5cf6]">{summary.trackName} · {MODES.find((m) => m.id === summary.mode)?.name}</p>
          <h2 className="mt-1 text-5xl font-black">
            {summary.mode === "practice" ? "PRACTICE DONE"
              : summary.mode === "time-trial" ? "TIME TRIAL"
              : summary.eliminated ? "YEETED!"
              : winner ? "VICTORY!" : `P${summary.position}`}
          </h2>
          {summary.teamScores && (
            <p className="mt-1 text-lg font-black">
              <span className="text-[#2dd4c8]">Your team {summary.teamScores[0]}</span> – <span className="text-[#ff4d6d]">{summary.teamScores[1]} Rivals</span>
              {winner ? " — TEAM WINS!" : ""}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm font-black">
            <span className="rounded-full border-2 border-[#16181d] bg-[#f3ecff] px-3 py-1">Total {fmtTime(summary.totalMs)}</span>
            {summary.bestLapMs && <span className="rounded-full border-2 border-[#16181d] bg-[#fff3c4] px-3 py-1">Best lap {fmtTime(summary.bestLapMs)}</span>}
            <span className="rounded-full border-2 border-[#16181d] bg-[#ffd23f] px-3 py-1"><Coins size={13} className="mr-1 inline" />{summary.coinsCollected} grabbed</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm font-black">
            {summary.xpEarned !== undefined ? (
              <>
                <span className="rounded-full border-2 border-[#16181d] bg-[#d1f7e6] px-3 py-1">+{summary.xpEarned} XP</span>
                <span className="rounded-full border-2 border-[#16181d] bg-[#ffd23f] px-3 py-1">+{summary.coinsEarned}c</span>
                {!!summary.gemsEarned && (
                  <span className="rounded-full border-2 border-[#16181d] bg-[#c8a2f5] px-3 py-1">+{summary.gemsEarned} <Gem size={11} className="inline" /></span>
                )}
                {profile && <span className="rounded-full border-2 border-[#16181d] bg-[#e9e2ff] px-3 py-1">Lvl {levelFromXp(profile.xp)} · {profile.xp}/{xpForLevel(levelFromXp(profile.xp) + 1)} XP</span>}
              </>
            ) : (
              !profile && <span className="text-xs font-bold text-[#8b5cf6]">Sign in to bank XP &amp; coins from races.</span>
            )}
          </div>
        </div>

        <div className="mt-5 max-h-56 overflow-y-auto rounded-2xl border-[3px] border-[#16181d]">
          {summary.standings.map((s) => {
            const medalCol = s.position === 1 ? "#ffd700" : s.position === 2 ? "#c0c0c0" : s.position === 3 ? "#cd7f32" : "transparent";
            return (
              <div key={s.name + s.position}
                className={`flex items-center justify-between px-4 py-2 text-sm font-black ${s.isPlayer ? "bg-[#ffd23f]" : s.position % 2 === 0 ? "bg-[#f3ecff]" : "bg-white"}`}>
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#16181d]"
                    style={{ background: medalCol || "#fff" }}>{s.position}</span>
                  {s.name}
                  {s.team !== undefined && s.team >= 0 && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${s.team === 0 ? "bg-[#2dd4c8]" : "bg-[#ff4d6d] text-white"}`}>
                      {s.team === 0 ? "TEAM YOU" : "RIVALS"}
                    </span>
                  )}
                </span>
                <span>{s.totalMs !== undefined ? fmtTime(s.totalMs) : s.position === 1 ? "" : "DNF"}</span>
              </div>
            );
          })}
        </div>

        {isGp && summary.gpScores && (
          <div className="mt-4 rounded-2xl border-[3px] border-[#16181d] bg-[#fff8ef] p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-black text-[#8b5cf6]"><Trophy size={13} /> GRAND PRIX STANDINGS</div>
            {gpSorted.map(([name, pts], i) => (
              <div key={name} className="flex items-center justify-between py-0.5 text-sm font-bold">
                <span>{i + 1}. {name}</span><span className="font-black">{pts} pts</span>
              </div>
            ))}
            {summary.gpDone && (
              <p className="mt-2 text-center text-base font-black text-[#ff5ca8]">
                {gpSorted[0]?.[0] === profile?.name ? "YOU ARE THE GRAND PRIX CHAMPION!" : `${gpSorted[0]?.[0]} takes the cup!`}
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {isGp && !summary.gpDone && onGpNext && (
            <Btn tone="btn-pink" onClick={onGpNext}><span className="flex items-center gap-2">Next GP race <ChevronRight size={16} /></span></Btn>
          )}
          <Btn tone="btn-yellow" onClick={onRematch}><span className="flex items-center gap-2"><RotateCcw size={16} /> Rematch</span></Btn>
          <Btn tone="btn-white" onClick={onMenu}>Main menu</Btn>
        </div>
      </div>
    </div>
  );
}

// generated once at module load (module init is allowed to be impure)
const CONFETTI_COLORS = ["#ff5ca8", "#ffd23f", "#2dd4c8", "#8b5cf6", "#3ddc84", "#ff7f2a"];
const CONFETTI_PIECES = Array.from({ length: 70 }, (_, i) => ({
  left: Math.random() * 100,
  delay: Math.random() * 2.6,
  dur: 2.6 + Math.random() * 2.2,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}));

function Confetti() {
  const pieces = CONFETTI_PIECES;
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 h-3 w-2 rounded-sm"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animation: `confetti-fall ${p.dur}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ===========================================================================
// ROOT DISPATCH
// ===========================================================================
export default function Menus() {
  const screen = useApp((s) => s.screen);
  switch (screen) {
    case "modes": return <Modes />;
    case "tracks": return <Tracks />;
    case "garage": return <Garage />;
    case "characters": return <Characters />;
    case "shop": return <Shop />;
    case "events": return <Events />;
    case "ranks": return <Ranks />;
    case "friends": return <Friends />;
    case "settings": return <SettingsScr />;
    case "howto": return <HowTo />;
    default: return <Home />;
  }
}
