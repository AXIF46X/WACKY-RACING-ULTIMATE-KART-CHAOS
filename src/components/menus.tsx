"use client";

// ============================================================================
// All menu screens + results + top bar + friends room (P2P) UI.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowLeftRight, Banana, Bird, Car, Check, ChevronRight, ChevronsUp, Coins, Copy,
  Flag, Gamepad2, Gem, Gift, HelpCircle, Home, Lock, Magnet, Music, Package, Play, Rocket,
  Search, Settings, Shield, ShoppingBag, Snowflake, Sparkles, Star, Trophy, Users, Volume2,
  Wrench, X, Zap,
} from "lucide-react";
import {
  useApp, type NetHandle, type RaceSummary, type Screen,
} from "@/lib/store";
import {
  ACHIEVEMENTS, BUNDLES, CHARACTERS, CRATES, DANCES, DAILIES, GEM_EXCHANGE, GP_POINTS, GP_TRACKS,
  HATS, HORNS, MAX_UPGRADE_LEVEL, MODES, POWERUPS, RARITY_COLOR, TRACKS, UPGRADES, VEHICLES,
  WHEELS, fmtTime, levelFromXp, modeById, powerupById, trackById, upgradeCost, vehicleById,
  xpForLevel, type Rarity, type Vehicle,
} from "@/game/data";
import { AudioMan } from "@/game/audio";
import { hostRoom, isWebRTCAvailable, joinRoom, type P2PRoom } from "@/game/net";
import CarImage from "@/components/car-image";
import Preview3D from "@/components/preview3d";

// ============================================================================
// PowerIcon
// ============================================================================

export function PowerIcon({ id, size = 24, className = "" }: { id: string; size?: number; className?: string }) {
  const p = { size, className, strokeWidth: 2.4 };
  switch (id) {
    case "rocket": return <Rocket {...p} />;
    case "banana": return <Banana {...p} />;
    case "punch": return <Zap {...p} />;
    case "magnet": return <Magnet {...p} />;
    case "shield": return <Shield {...p} />;
    case "freeze": return <Snowflake {...p} />;
    case "giant": return <ChevronsUp {...p} />;
    case "chicken": return <Bird {...p} />;
    case "reverse": return <ArrowLeftRight {...p} />;
    case "teleport": return <Sparkles {...p} />;
    default: return <Sparkles {...p} />;
  }
}

// ============================================================================
// useStartRace
// ============================================================================

export function useStartRace() {
  const setSetup = useApp((s) => s.setSetup);
  const setInRace = useApp((s) => s.setInRace);
  const bumpRaceKey = useApp((s) => s.bumpRaceKey);
  return useCallback(
    (cfg: { mode: string; track: string; gpRace?: number; gpScores?: Record<string, number>; net?: NetHandle | null }) => {
      const mode = modeById(cfg.mode);
      const prev = useApp.getState().setup;
      setSetup({
        mode: cfg.mode,
        track: cfg.track,
        laps: mode.laps,
        gpRace: cfg.gpRace,
        gpScores: cfg.gpScores,
        net: cfg.net !== undefined ? cfg.net : prev.net,
      });
      bumpRaceKey();
      setInRace(true);
    },
    [setSetup, setInRace, bumpRaceKey],
  );
}

// ============================================================================
// TopBar
// ============================================================================

export function TopBar() {
  const profile = useApp((s) => s.profile);
  const screen = useApp((s) => s.screen);
  const setScreen = useApp((s) => s.setScreen);

  useEffect(() => {
    const st = useApp.getState();
    st.hydrate();
    if (st.profile) void st.ensureProfile(st.profile.name);
  }, []);

  const level = levelFromXp(profile?.xp ?? 0);
  const xpIn = (profile?.xp ?? 0) - xpForLevel(level);
  const xpNeed = Math.max(1, xpForLevel(level + 1) - xpForLevel(level));

  const nav: { icon: React.ReactNode; label: string; s: Screen }[] = [
    { icon: <Car size={15} />, label: "Garage", s: "garage" },
    { icon: <ShoppingBag size={15} />, label: "Shop", s: "shop" },
    { icon: <Trophy size={15} />, label: "Ranks", s: "leaderboard" },
    { icon: <Users size={15} />, label: "Friends", s: "friends" },
    { icon: <Settings size={15} />, label: "Settings", s: "settings" },
  ];

  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 px-3 py-2">
      <button className="btn btn-white flex items-center gap-1.5 px-3 py-1.5 text-sm font-black" onClick={() => { AudioMan.click(); setScreen("menu"); }}>
        <Home size={16} /> WACKY RACING
      </button>
      {profile && (
        <div className="card-dark flex items-center gap-2.5 px-3 py-1.5 sm:gap-3">
          <span className="max-w-28 truncate font-black text-[#ffd23f]">{profile.name}</span>
          <span className="text-xs font-black text-[#cbbdf3]">Lv {level}</span>
          <div className="stat-track hidden h-2.5 w-20 sm:block md:w-28">
            <div className="stat-fill" style={{ width: `${Math.min(100, (xpIn / xpNeed) * 100)}%` }} />
          </div>
          <span className="flex items-center gap-1 text-sm font-black text-[#ffd23f]"><Coins size={14} />{profile.coins}</span>
          <span className="flex items-center gap-1 text-sm font-black text-[#9bf0ff]"><Gem size={14} />{profile.gems}</span>
        </div>
      )}
      <div className="ml-auto flex flex-wrap gap-1.5">
        {nav.map((n) => (
          <button
            key={n.s}
            className={`btn btn-dark flex items-center gap-1 px-2.5 py-1.5 text-xs font-black ${screen === n.s ? "!bg-[#8b5cf6]" : ""}`}
            onClick={() => { AudioMan.click(); setScreen(n.s); }}
          >
            {n.icon}{n.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Menus (screen switch)
// ============================================================================

export default function Menus() {
  const screen = useApp((s) => s.screen);
  const [tuneVeh, setTuneVeh] = useState<string | null>(null);
  return (
    <main className="relative z-10 mx-auto w-full max-w-5xl px-3 pb-24 pt-1">
      <Toast />
      {screen === "menu" && <MenuScreen />}
      {screen === "tracks" && <TracksScreen />}
      {screen === "garage" && <GarageScreen onTune={setTuneVeh} />}
      {screen === "tune" && <TuneScreen vehicleId={tuneVeh} onBack={() => useApp.getState().setScreen("garage")} />}
      {screen === "shop" && <ShopScreen />}
      {screen === "characters" && <CharactersScreen />}
      {screen === "settings" && <SettingsScreen />}
      {screen === "leaderboard" && <LeaderboardScreen />}
      {screen === "friends" && <FriendsScreen />}
      {screen === "howto" && <HowToScreen />}
    </main>
  );
}

function Toast() {
  const toast = useApp((s) => s.toast);
  const setToast = useApp((s) => s.setToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast, setToast]);
  if (!toast) return null;
  return (
    <div className="anim-pop fixed left-1/2 top-16 z-[60] -translate-x-1/2">
      <div className="btn btn-purple px-5 py-2 text-sm font-black">{toast}</div>
    </div>
  );
}

function ScreenHead({ title, onBack, children }: { title: string; onBack?: () => void; children?: React.ReactNode }) {
  const setScreen = useApp((s) => s.setScreen);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {onBack && (
        <button className="btn btn-white px-3 py-1.5 text-sm font-black" onClick={() => { AudioMan.click(); onBack(); }}>
          <ArrowLeft size={16} />
        </button>
      )}
      <h2 className="bg-clip-title text-3xl font-black sm:text-4xl">{title}</h2>
      <div className="ml-auto flex items-center gap-2">{children}</div>
      {onBack === undefined && (
        <button className="btn btn-dark px-3 py-1.5 text-sm font-black" onClick={() => { AudioMan.click(); setScreen("menu"); }}>
          <Home size={16} />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Menu
// ============================================================================

function MenuScreen() {
  const profile = useApp((s) => s.profile);
  const ensureProfile = useApp((s) => s.ensureProfile);
  const setScreen = useApp((s) => s.setScreen);
  const startRace = useStartRace();
  const [name, setName] = useState("");

  if (!profile) {
    return (
      <div className="flex min-h-[70dvh] items-center justify-center">
        <div className="card anim-pop w-full max-w-sm p-6 text-center">
          <h1 className="bg-clip-title text-4xl font-black">WACKY RACING</h1>
          <p className="mt-1 text-sm font-bold text-[#6b5a8e]">ULTIMATE KART CHAOS</p>
          <p className="mt-4 text-sm font-bold">Pick a racer name to start (no password — progress syncs to the server when a database is connected):</p>
          <input
            className="mt-3 w-full rounded-2xl border-[3px] border-[#1b1533] bg-white px-4 py-2.5 text-center text-lg font-black outline-none"
            placeholder="e.g. Speedy Sam"
            maxLength={16}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void ensureProfile(name); }}
          />
          <button className="btn btn-pink mt-4 w-full px-5 py-3 text-lg font-black text-white" onClick={() => void ensureProfile(name)}>
            <Play size={18} /> START RACING
          </button>
        </div>
      </div>
    );
  }

  const dailies = DAILIES.map((d) => ({
    ...d,
    progress: Math.min(d.target, profile.dailies?.progress?.[d.id] ?? 0),
    claimed: profile.dailies?.claimed?.includes(d.id) ?? false,
    today: profile.dailies?.date === new Date().toISOString().slice(0, 10),
  }));

  return (
    <div className="flex flex-col items-center gap-5 pt-4">
      <div className="text-center">
        <h1 className="bg-clip-title anim-wiggle text-5xl font-black sm:text-7xl">WACKY RACING</h1>
        <p className="text-outline mt-1 text-sm font-black text-white sm:text-base">ULTIMATE KART CHAOS 🏁</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button className="btn btn-yellow anim-bob px-8 py-4 text-2xl font-black" onClick={() => { AudioMan.click(); setScreen("tracks"); }}>
          <span className="flex items-center gap-2"><Play size={24} /> RACE</span>
        </button>
        <button className="btn btn-purple px-6 py-4 text-xl font-black text-white" onClick={() => { AudioMan.click(); startRace({ mode: "grandprix", track: GP_TRACKS[0], gpRace: 0, gpScores: {} }); }}>
          <Trophy size={22} /> GRAND PRIX
        </button>
      </div>

      <div className="grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: <Car size={20} />, label: "Garage", s: "garage" as Screen },
          { icon: <ShoppingBag size={20} />, label: "Shop", s: "shop" as Screen },
          { icon: <Users size={20} />, label: "Friends Room", s: "friends" as Screen },
          { icon: <HelpCircle size={20} />, label: "How to play", s: "howto" as Screen },
        ].map((b) => (
          <button key={b.s} className="card btn btn-white flex flex-col items-center gap-1 px-3 py-4 text-sm font-black" onClick={() => { AudioMan.click(); setScreen(b.s); }}>
            {b.icon}{b.label}
          </button>
        ))}
      </div>

      <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <h3 className="flex items-center gap-2 text-lg font-black"><Flag size={18} className="text-[#ff5ca8]" /> Daily challenges</h3>
          <div className="mt-2 flex flex-col gap-2">
            {dailies.map((d) => (
              <div key={d.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="text-xs font-black">{d.name} <span className="text-[#6b5a8e]">+{d.reward}🪙</span></div>
                  <div className="stat-track mt-0.5 h-2 w-full"><div className="stat-fill" style={{ width: `${(d.progress / d.target) * 100}%` }} /></div>
                </div>
                <span className="w-12 text-right text-[10px] font-black text-[#6b5a8e]">{d.progress}/{d.target}</span>
                <ClaimDaily id={d.id} ready={d.today && d.progress >= d.target && !d.claimed} />
              </div>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <h3 className="flex items-center gap-2 text-lg font-black"><Trophy size={18} className="text-[#ffd23f]" /> Achievements</h3>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {ACHIEVEMENTS.map((a) => {
              const unlocked = achievementDone(a.id, profile);
              return (
                <div key={a.id} className={`rounded-xl border-2 border-[#1b1533] p-1.5 text-center ${unlocked ? "bg-[#fff3c9]" : "opacity-45 grayscale"}`} title={a.desc}>
                  <div className="text-[10px] font-black leading-tight">{a.name}</div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] font-bold text-[#6b5a8e]">Seasonal event: CHAOS FEST — double coins in Chaos Mode!</p>
        </div>
      </div>
    </div>
  );
}

function ClaimDaily({ id, ready }: { id: string; ready: boolean }) {
  const apiPost = useApp((s) => s.apiPost);
  const setToast = useApp((s) => s.setToast);
  if (!ready) return <span className="w-14 text-right text-[10px] font-black text-[#a08fd0]">—</span>;
  return (
    <button
      className="btn btn-green w-14 px-1 py-1 text-[10px] font-black"
      onClick={async () => {
        try {
          await apiPost("/api/sync", { dailies: { claim: id } });
          setToast("Daily claimed! +coins");
          AudioMan.sfx("buy");
        } catch {
          setToast("Offline — connect a database to claim");
        }
      }}
    >
      CLAIM
    </button>
  );
}

function achievementDone(id: string, p: NonNullable<ReturnType<typeof useApp.getState>["profile"]>): boolean {
  const owned = p.unlocked.vehicles.length;
  const upgLevels = Object.values(p.upgrades ?? {}).reduce((a, c) => a + Object.values(c).reduce((x, y) => x + y, 0), 0);
  switch (id) {
    case "first-race": return p.stats.races >= 1;
    case "first-win": return p.stats.wins >= 1;
    case "podium": return p.stats.podiums >= 1;
    case "collector": return owned >= 10;
    case "completionist": return owned >= VEHICLES.length;
    case "master-tuner": return upgLevels >= 20;
    case "drifter": return p.stats.drifts >= 60;
    case "coin-hoarder": return p.stats.coinsCollected >= 500;
    case "chaos-survivor": return p.stats.wins >= 1;
    default: return false;
  }
}

// ============================================================================
// Tracks / mode select
// ============================================================================

function TracksScreen() {
  const setScreen = useApp((s) => s.setScreen);
  const garage = useApp((s) => s.garage);
  const patchGarage = useApp((s) => s.patchGarage);
  const profile = useApp((s) => s.profile);
  const startRace = useStartRace();
  const [mode, setMode] = useState("quick");
  const [track, setTrack] = useState(TRACKS[0].id);
  const [best, setBest] = useState<{ name: string; lapMs: number } | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetch(`/api/leaderboard?track=${track}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (alive) setBest(j.laps?.[0] ? { name: j.laps[0].name, lapMs: j.laps[0].lapMs } : null); })
      .catch(() => { if (alive) setBest(null); });
    return () => { alive = false; };
  }, [track]);

  const owned = profile ? VEHICLES.filter((v) => profile.unlocked.vehicles.includes(v.id)) : VEHICLES;
  const quickPick = [
    ...owned.filter((v) => garage.favorites.includes(v.id)),
    ...owned.filter((v) => !garage.favorites.includes(v.id)),
  ].slice(0, 8);

  const modes = MODES.filter((m) => m.id !== "friends");

  return (
    <div>
      <ScreenHead title="Pick a race" onBack={() => setScreen("menu")}>
        <span className="hud-panel px-3 py-1.5 text-xs font-black">Riding: <b className="text-[#ffd23f]">{vehicleById(garage.vehicle).name}</b></span>
      </ScreenHead>

      {/* mode chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {modes.map((m) => (
          <button
            key={m.id}
            className={`btn px-4 py-2 text-sm font-black ${mode === m.id ? "btn-pink text-white" : "btn-white"}`}
            title={m.desc}
            onClick={() => { AudioMan.click(); setMode(m.id); }}
          >
            {m.name}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs font-black text-[#cbbdf3]">{modeById(mode).desc} — {modeById(mode).laps > 0 ? `${modeById(mode).laps} laps` : "free roam"}</p>

      {/* track cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TRACKS.map((t) => (
          <button
            key={t.id}
            className={`card anim-fade-up p-3 text-left transition-transform hover:-translate-y-1 ${track === t.id ? "!border-[#ffd23f] !shadow-[0_8px_0_#16181d,0_0_0_4px_#ffd23f]" : ""}`}
            onClick={() => { AudioMan.click(); setTrack(t.id); }}
          >
            <div className="flex h-20 items-center justify-center rounded-2xl border-[3px] border-[#1b1533]" style={{ background: `linear-gradient(180deg, #${t.theme.sky.toString(16).padStart(6, "0")}, #${t.theme.ground.toString(16).padStart(6, "0")})` }}>
              <Flag size={30} className="text-white drop-shadow" />
            </div>
            <div className="mt-2 text-base font-black leading-tight">{t.name}</div>
            <div className="text-[11px] font-bold text-[#6b5a8e]">{t.desc}</div>
            <div className="mt-1 text-[10px] font-black text-[#8b5cf6]">
              {track === t.id ? (best === undefined ? "loading best lap…" : best ? `Best: ${fmtTime(best.lapMs)} by ${best.name}` : "No laps yet — set one!") : ""}
            </div>
          </button>
        ))}
      </div>

      {/* quick-pick car bar */}
      <div className="card mt-4 p-3">
        <div className="mb-2 text-xs font-black text-[#6b5a8e]">QUICK PICK — swap kart right before the race:</div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {quickPick.map((v) => (
            <button
              key={v.id}
              className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-2xl border-[3px] border-[#1b1533] ${garage.vehicle === v.id ? "ring-4 ring-[#ffd23f]" : ""}`}
              title={v.name}
              onClick={() => { AudioMan.sfx("equip"); patchGarage({ vehicle: v.id }); }}
            >
              <CarImage vehId={v.id} className="h-full w-full" />
              {garage.favorites.includes(v.id) && <Star size={12} className="absolute right-1 top-1 fill-[#ffd23f] text-[#ffd23f]" />}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex justify-center">
        <button
          className="btn btn-green px-10 py-4 text-2xl font-black"
          onClick={() => { AudioMan.sfx("go"); startRace({ mode, track }); }}
        >
          <span className="flex items-center gap-2"><Play size={26} /> START — {trackById(track).name}</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Garage (collection)
// ============================================================================

type Filter = "all" | "favorites" | "owned" | "locked" | Rarity;
type Sort = "rarity" | "price" | "name";

const RARITY_ORDER: Rarity[] = ["legendary", "epic", "rare", "common"];

function GarageScreen({ onTune }: { onTune: (id: string) => void }) {
  const setScreen = useApp((s) => s.setScreen);
  const garage = useApp((s) => s.garage);
  const patchGarage = useApp((s) => s.patchGarage);
  const profile = useApp((s) => s.profile);
  const buyItem = useApp((s) => s.buyItem);
  const setToast = useApp((s) => s.setToast);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("rarity");
  const startRace = useStartRace();

  const list = useMemo(() => {
    let arr = [...VEHICLES];
    const owned = (id: string) => !!profile?.unlocked.vehicles.includes(id);
    if (filter === "favorites") arr = arr.filter((v) => garage.favorites.includes(v.id));
    else if (filter === "owned") arr = arr.filter((v) => owned(v.id));
    else if (filter === "locked") arr = arr.filter((v) => !owned(v.id));
    else if (filter !== "all") arr = arr.filter((v) => v.rarity === filter);
    if (q) arr = arr.filter((v) => v.name.toLowerCase().includes(q.toLowerCase()) || v.ability.toLowerCase().includes(q.toLowerCase()));
    arr.sort((a, b) => {
      if (sort === "price") return a.price - b.price || RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
      if (sort === "name") return a.name.localeCompare(b.name);
      return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || b.stats.speed - a.stats.speed;
    });
    return arr;
  }, [q, filter, sort, profile, garage.favorites]);

  const veh = vehicleById(garage.vehicle);

  return (
    <div>
      <ScreenHead title="Garage" onBack={() => setScreen("menu")}>
        <button className="btn btn-green flex items-center gap-1.5 px-4 py-2 text-sm font-black" onClick={() => { AudioMan.click(); setScreen("tracks"); }}>
          <Play size={15} /> RACE NOW
        </button>
      </ScreenHead>

      {/* equipped strip */}
      <div className="card mb-4 flex items-center gap-3 p-3">
        <CarImage vehId={veh.id} paint={garage.paint} wheels={garage.wheels} withDriver charId={garage.character} hat={garage.hat} className="h-20 w-28 shrink-0 rounded-2xl border-[3px] border-[#1b1533]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-xl font-black">{veh.name}</span>
            <span className="rounded-full border-2 border-[#1b1533] px-2 py-0.5 text-[10px] font-black uppercase" style={{ background: RARITY_COLOR[veh.rarity] }}>{veh.rarity}</span>
          </div>
          <div className="text-xs font-bold text-[#6b5a8e]">{veh.ability} — {veh.abilityDesc}</div>
          <StatBars vehicle={veh} upgrades={profile?.upgrades?.[veh.id] ?? {}} />
        </div>
        <button className="btn btn-teal hidden px-3 py-2 text-xs font-black sm:block" onClick={() => { AudioMan.click(); startRace({ mode: "practice", track: TRACKS[0].id }); }}>
          TEST DRIVE
        </button>
      </div>

      {/* toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="card flex items-center gap-1.5 px-3 py-1.5">
          <Search size={15} />
          <input className="w-32 bg-transparent text-sm font-black outline-none" placeholder="search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {(["all", "favorites", "owned", "locked", "common", "rare", "epic", "legendary"] as Filter[]).map((f) => (
          <button key={f} className={`btn px-3 py-1.5 text-xs font-black ${filter === f ? "btn-dark" : "btn-white"}`} onClick={() => setFilter(f)}>
            {f === "favorites" ? "★" : f}
          </button>
        ))}
        <select className="card px-3 py-1.5 text-xs font-black" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="rarity">sort: rarity</option>
          <option value="price">sort: price</option>
          <option value="name">sort: name</option>
        </select>
      </div>

      {/* grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((v) => {
          const owned = !!profile?.unlocked.vehicles.includes(v.id);
          const fav = garage.favorites.includes(v.id);
          const equipped = garage.vehicle === v.id;
          return (
            <div key={v.id} className={`card relative p-2.5 ${equipped ? "!shadow-[0_8px_0_#16181d,0_0_0_4px_#3ddc84]" : ""}`}>
              <button className="absolute right-2 top-2 z-10" onClick={() => patchGarage({ favorites: fav ? garage.favorites.filter((f) => f !== v.id) : [...garage.favorites, v.id] })}>
                <Star size={18} className={fav ? "fill-[#ffd23f] text-[#ffd23f]" : "text-[#c9b8f5]"} />
              </button>
              <CarImage vehId={v.id} className="h-24 w-full rounded-2xl border-[3px] border-[#1b1533]" />
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="truncate text-sm font-black">{v.name}</span>
                <span className="ml-auto shrink-0 rounded-full border-2 border-[#1b1533] px-1.5 py-px text-[9px] font-black uppercase" style={{ background: RARITY_COLOR[v.rarity] }}>{v.rarity}</span>
              </div>
              <div className="text-[10px] font-bold leading-tight text-[#6b5a8e]">{v.ability}: {v.abilityDesc}</div>
              <StatBars vehicle={v} upgrades={profile?.upgrades?.[v.id] ?? {}} compact />
              <div className="mt-2 flex gap-1.5">
                {owned ? (
                  <>
                    <button className={`btn flex-1 px-2 py-1.5 text-xs font-black ${equipped ? "btn-green" : "btn-yellow"}`} onClick={() => { AudioMan.sfx("equip"); patchGarage({ vehicle: v.id }); }}>
                      {equipped ? "EQUIPPED" : "EQUIP"}
                    </button>
                    <button className="btn btn-teal px-2 py-1.5 text-xs font-black" onClick={() => { AudioMan.click(); onTune(v.id); useApp.getState().setScreen("tune"); }}>
                      <Wrench size={13} />
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-pink flex-1 px-2 py-1.5 text-xs font-black text-white"
                    onClick={async () => {
                      const pay: "coins" | "gems" = v.gems && v.rarity !== "common" && v.rarity !== "rare" ? "gems" : "coins";
                      const r = await buyItem("vehicles", v.id, pay);
                      if (r.ok) { AudioMan.sfx("buy"); setToast(`${v.name} unlocked!`); patchGarage({ vehicle: v.id }); }
                      else setToast(`Cannot buy: ${r.error ?? "error"}`);
                    }}
                  >
                    <Lock size={12} /> {v.gems ? `${v.gems} 💎` : `${v.price} 🪙`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatBars({ vehicle, upgrades, compact = false }: { vehicle: Vehicle; upgrades: Record<string, number>; compact?: boolean }) {
  const lvl = (k: string) => Math.max(0, Math.min(MAX_UPGRADE_LEVEL, Math.floor(upgrades[k] ?? 0)));
  const rows: [string, number, number][] = [
    ["SPD", vehicle.stats.speed, lvl("engine") * 6],
    ["ACC", vehicle.stats.accel, lvl("engine") * 8 + lvl("turbo") * 8],
    ["HAN", vehicle.stats.handling, lvl("tires") * 4 + lvl("frame") * 4],
    ["DRF", vehicle.stats.drift, lvl("tires") * 6 + lvl("turbo") * 6],
    ["WGT", vehicle.stats.weight, -lvl("frame") * 6],
  ];
  return (
    <div className={`mt-1 flex flex-col gap-0.5 ${compact ? "" : ""}`}>
      {rows.map(([label, base, bonus]) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="w-7 text-[9px] font-black text-[#6b5a8e]">{label}</span>
          <div className={`stat-track h-1.5 flex-1 ${compact ? "" : ""}`}>
            <div className="relative h-full w-full">
              <div className="stat-fill absolute left-0 top-0" style={{ width: `${Math.min(100, base)}%` }} />
              {bonus !== 0 && (
                <div
                  className="absolute top-0 h-full bg-gradient-to-r from-[#ffd23f] to-[#ff9de2]"
                  style={{
                    left: `${Math.min(100, base)}%`,
                    width: `${Math.min(100 - Math.min(100, base), Math.abs(bonus))}%`,
                    opacity: 0.95,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Tune
// ============================================================================

function TuneScreen({ vehicleId, onBack }: { vehicleId: string | null; onBack: () => void }) {
  const profile = useApp((s) => s.profile);
  const buyUpgrade = useApp((s) => s.buyUpgrade);
  const setToast = useApp((s) => s.setToast);
  const veh = vehicleById(vehicleId ?? useApp.getState().garage.vehicle);
  const upg = profile?.upgrades?.[veh.id] ?? {};
  const owned = !!profile?.unlocked.vehicles.includes(veh.id);

  return (
    <div>
      <ScreenHead title={`Tune: ${veh.name}`} onBack={onBack} />
      {!owned && <p className="mb-3 text-sm font-black text-[#ff4d6d]">You do not own this kart yet — buy it in the Garage.</p>}
      <div className="card mb-4 flex items-center gap-3 p-3">
        <CarImage vehId={veh.id} className="h-24 w-32 shrink-0 rounded-2xl border-[3px] border-[#1b1533]" />
        <StatBars vehicle={veh} upgrades={upg} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {UPGRADES.map((u) => {
          const cur = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, Math.floor(upg[u.key] ?? 0)));
          const maxed = cur >= MAX_UPGRADE_LEVEL;
          const cost = maxed ? 0 : upgradeCost(veh, u.key, cur + 1);
          const afford = (profile?.coins ?? 0) >= cost;
          return (
            <div key={u.key} className="card p-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-black">{u.name}</span>
                <span className="flex gap-1">
                  {Array.from({ length: MAX_UPGRADE_LEVEL }).map((_, i) => (
                    <span key={i} className={`h-3 w-3 rounded-full border-2 border-[#1b1533] ${i < cur ? "bg-[#ffd23f]" : "bg-[#e8ddff]"}`} />
                  ))}
                </span>
              </div>
              <p className="text-xs font-bold text-[#6b5a8e]">{u.desc}</p>
              <button
                className={`btn mt-3 w-full px-4 py-2 text-sm font-black ${maxed ? "btn-dark" : afford && owned ? "btn-yellow" : "btn-white"}`}
                disabled={maxed || !owned || !afford}
                onClick={async () => {
                  const r = await buyUpgrade(veh.id, u.key);
                  if (r.ok) { AudioMan.sfx("buy"); setToast(`${u.name} → level ${r.level} (−${r.cost}🪙)`); }
                  else setToast(`Tune failed: ${r.error}`);
                }}
              >
                {maxed ? "MAXED OUT" : `Upgrade — ${cost} 🪙`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Shop (crates, bundles, gem exchange)
// ============================================================================

function ShopScreen() {
  const setScreen = useApp((s) => s.setScreen);
  const profile = useApp((s) => s.profile);
  const openCrate = useApp((s) => s.openCrate);
  const buyBundle = useApp((s) => s.buyBundle);
  const exchangeGems = useApp((s) => s.exchangeGems);
  const setToast = useApp((s) => s.setToast);
  const [reward, setReward] = useState<{ name: string; rarity: Rarity } | null>(null);

  return (
    <div>
      <ScreenHead title="Shop" onBack={() => setScreen("menu")}>
        <span className="hud-panel flex items-center gap-1.5 px-3 py-1.5 text-xs font-black"><Coins size={13} className="text-[#ffd23f]" />{profile?.coins ?? 0} <Gem size={13} className="ml-1 text-[#9bf0ff]" />{profile?.gems ?? 0}</span>
      </ScreenHead>

      {reward && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={() => setReward(null)}>
          <div className="card anim-pop w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-black text-[#6b5a8e]">CRATE REWARD</div>
            <div className="mt-1 text-3xl font-black" style={{ color: RARITY_COLOR[reward.rarity] }}>{reward.name}</div>
            <div className="mt-1 text-xs font-black uppercase" style={{ color: RARITY_COLOR[reward.rarity] }}>{reward.rarity}</div>
            <button className="btn btn-yellow mt-5 w-full py-2.5 font-black" onClick={() => setReward(null)}>SWEET!</button>
          </div>
        </div>
      )}

      <h3 className="mb-2 flex items-center gap-2 text-xl font-black text-white"><Package size={20} className="text-[#2dd4c8]" /> Mystery crates</h3>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {CRATES.map((c) => (
          <div key={c.id} className="card p-4">
            <div className="text-lg font-black">{c.name}</div>
            <div className="text-xs font-bold text-[#6b5a8e]">{c.desc}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {(Object.keys(c.odds) as Rarity[]).map((r) => c.odds[r] > 0 && (
                <span key={r} className="rounded-full border-2 border-[#1b1533] px-1.5 py-px text-[9px] font-black uppercase" style={{ background: RARITY_COLOR[r] }}>
                  {r} {c.odds[r]}%
                </span>
              ))}
            </div>
            <button
              className="btn btn-pink mt-3 w-full py-2 text-sm font-black text-white"
              onClick={async () => {
                const r = await openCrate(c.id);
                if (r.ok) {
                  AudioMan.sfx("buy");
                  if (r.reward) setReward({ name: r.reward.name, rarity: r.reward.rarity });
                  else setToast(`Nothing new — +${r.coinsBack ?? 0} coins back`);
                } else setToast(`Crate failed: ${r.error}`);
              }}
            >
              OPEN — {c.price} {c.currency === "gems" ? "💎" : "🪙"}
            </button>
          </div>
        ))}
      </div>

      <h3 className="mb-2 flex items-center gap-2 text-xl font-black text-white"><Gift size={20} className="text-[#ff5ca8]" /> Bundles</h3>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {BUNDLES.map((b) => {
          const sep = b.items.reduce((a, it) => a + (it.kind === "vehicles" ? vehicleById(it.id).price : 0), 0);
          return (
            <div key={b.id} className="card p-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-black">{b.name}</span>
                {sep > b.coins && <span className="rounded-full border-2 border-[#1b1533] bg-[#3ddc84] px-2 py-0.5 text-[10px] font-black">SAVE {Math.round((1 - b.coins / sep) * 100)}%</span>}
              </div>
              <div className="text-xs font-bold text-[#6b5a8e]">{b.desc}</div>
              <div className="mt-1 text-[11px] font-black">{b.items.map((it) => it.id.replace(/-/g, " ")).join(" · ")}{b.bonusCoins ? ` · +${b.bonusCoins}🪙` : ""}</div>
              <div className="mt-3 flex gap-2">
                <button className="btn btn-yellow flex-1 py-2 text-xs font-black" onClick={async () => { const r = await buyBundle(b.id, "coins"); r.ok ? (AudioMan.sfx("buy"), setToast(`${b.name} unlocked!`)) : setToast(`Failed: ${r.error}`); }}>
                  {b.coins} 🪙
                </button>
                {b.gems !== undefined && (
                  <button className="btn btn-purple flex-1 py-2 text-xs font-black text-white" onClick={async () => { const r = await buyBundle(b.id, "gems"); r.ok ? (AudioMan.sfx("buy"), setToast(`${b.name} unlocked!`)) : setToast(`Failed: ${r.error}`); }}>
                    {b.gems} 💎
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h3 className="mb-2 flex items-center gap-2 text-xl font-black text-white"><Gem size={20} className="text-[#9bf0ff]" /> Coin → gem exchange</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {GEM_EXCHANGE.map((g) => (
          <div key={g.id} className="card flex items-center justify-between p-4">
            <div>
              <div className="text-base font-black">{g.name}</div>
              <div className="text-xs font-bold text-[#6b5a8e]">{g.coins} 🪙 → <b className="text-[#2f6fb2]">{g.gems} 💎</b></div>
            </div>
            <button className="btn btn-teal px-3 py-2 text-xs font-black" onClick={async () => { const r = await exchangeGems(g.id); r.ok ? (AudioMan.sfx("buy"), setToast("Exchanged!")) : setToast(`Failed: ${r.error}`); }}>
              SWAP
            </button>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-[11px] font-bold text-[#a08fd0]">All prices, rolls and wallet math are validated server-side. No real-money store — coins and gems are earned by racing.</p>
    </div>
  );
}

// ============================================================================
// Characters & cosmetics
// ============================================================================

type CosmeticKind = "characters" | "hats" | "wheels" | "horns" | "dances";

function CosmeticRow({
  title, items, kind, current, owned, onPick,
}: {
  title: string;
  items: readonly { id: string; name: string; price: number }[];
  kind: CosmeticKind;
  current: string;
  owned: (kind: CosmeticKind, id: string) => boolean;
  onPick: (kind: CosmeticKind, id: string, price: number) => void;
}) {
  return (
    <div className="card mb-3 p-3">
      <div className="mb-2 text-sm font-black">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => {
          const isOwned = owned(kind, it.id);
          const active = current === it.id;
          return (
            <button
              key={it.id}
              className={`btn px-3 py-1.5 text-xs font-black ${active ? "btn-yellow" : isOwned ? "btn-white" : "btn-dark"}`}
              onClick={() => onPick(kind, it.id, it.price)}
            >
              {active && <Check size={12} className="inline" />} {it.name} {isOwned ? "" : <span className="text-[#ffd23f]">· {it.price}🪙</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CharactersScreen() {
  const setScreen = useApp((s) => s.setScreen);
  const garage = useApp((s) => s.garage);
  const patchGarage = useApp((s) => s.patchGarage);
  const profile = useApp((s) => s.profile);
  const buyItem = useApp((s) => s.buyItem);
  const setToast = useApp((s) => s.setToast);

  const owned = (kind: CosmeticKind, id: string) => !!profile?.unlocked[kind].includes(id);

  const handlePick = async (kind: CosmeticKind, id: string, price: number) => {
    if (!owned(kind, id)) {
      const r = await buyItem(kind, id, "coins");
      if (!r.ok) { setToast(`Need ${price}🪙`); return; }
      AudioMan.sfx("buy");
    }
    AudioMan.sfx("equip");
    const key = kind === "characters" ? "character" : kind === "hats" ? "hat" : kind === "wheels" ? "wheels" : kind === "horns" ? "horn" : "dance";
    patchGarage({ [key]: id } as Partial<typeof garage>);
  };

  return (
    <div>
      <ScreenHead title="Racer & cosmetics" onBack={() => setScreen("menu")} />
      <div className="card mb-4 flex flex-col items-center gap-2 p-4 sm:flex-row">
        <Preview3D vehicleId={garage.vehicle} paint={garage.paint} wheelsId={garage.wheels} charId={garage.character} hatId={garage.hat} size={200} />
        <div className="flex-1 text-center sm:text-left">
          <div className="text-2xl font-black">{vehicleById(garage.vehicle).name}</div>
          <div className="text-sm font-bold text-[#6b5a8e]">Driver: {garage.character} · Hat: {garage.hat} · Wheels: {garage.wheels} · Horn: {garage.horn} · Dance: {garage.dance}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-[#6b5a8e]">PAINT:</span>
            {["#e4572e", "#ff5ca8", "#2dd4c8", "#8b5cf6", "#ffd23f", "#3ddc84", "#16181d", "#fff8ef"].map((c) => (
              <button key={c} className={`h-7 w-7 rounded-full border-[3px] border-[#1b1533] ${garage.paint === c ? "ring-4 ring-[#ffd23f]" : ""}`} style={{ background: c }} onClick={() => patchGarage({ paint: c })} />
            ))}
          </div>
        </div>
      </div>
      <CosmeticRow title="Characters" items={CHARACTERS} kind="characters" current={garage.character} owned={owned} onPick={(k, id, p) => void handlePick(k, id, p)} />
      <CosmeticRow title="Hats" items={HATS} kind="hats" current={garage.hat} owned={owned} onPick={(k, id, p) => void handlePick(k, id, p)} />
      <CosmeticRow title="Wheels" items={WHEELS} kind="wheels" current={garage.wheels} owned={owned} onPick={(k, id, p) => void handlePick(k, id, p)} />
      <CosmeticRow title="Horns (press H in race)" items={HORNS} kind="horns" current={garage.horn} owned={owned} onPick={(k, id, p) => void handlePick(k, id, p)} />
      <CosmeticRow title="Victory dances" items={DANCES} kind="dances" current={garage.dance} owned={owned} onPick={(k, id, p) => void handlePick(k, id, p)} />
    </div>
  );
}

// ============================================================================
// Settings
// ============================================================================

const ACTION_LABELS: [keyof import("@/lib/store").KeyBindings, string][] = [
  ["up", "Accelerate"], ["down", "Brake / reverse"], ["left", "Steer left"], ["right", "Steer right"],
  ["drift", "Drift (hold)"], ["item", "Use power-up"], ["horn", "Honk"], ["pause", "Pause"],
];

function SettingsScreen() {
  const setScreen = useApp((s) => s.setScreen);
  const settings = useApp((s) => s.settings);
  const patchSettings = useApp((s) => s.patchSettings);
  const [listening, setListening] = useState<keyof import("@/lib/store").KeyBindings | null>(null);

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      patchSettings({ keys: { ...useApp.getState().settings.keys, [listening]: e.code } });
      setListening(null);
    };
    window.addEventListener("keydown", onKey, { once: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [listening, patchSettings]);

  const toggle = (key: "swapTouch" | "tilt" | "music" | "sfx" | "shake", value: boolean) => {
    patchSettings({ [key]: value });
    if (key === "music") AudioMan.setMusicOn(value);
    if (key === "sfx") AudioMan.setSfxOn(value);
  };

  return (
    <div>
      <ScreenHead title="Settings" onBack={() => setScreen("menu")} />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-black"><Gamepad2 size={18} /> Controls — key remapping</h3>
          <div className="flex flex-col gap-1.5">
            {ACTION_LABELS.map(([action, label]) => (
              <div key={action} className="flex items-center gap-2">
                <span className="w-32 text-xs font-black">{label}</span>
                <button
                  className={`btn px-3 py-1.5 text-xs font-black ${listening === action ? "btn-pink text-white animate-pulse" : "btn-white"}`}
                  onClick={() => setListening(action)}
                >
                  {listening === action ? "press a key…" : settings.keys[action]}
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] font-bold text-[#6b5a8e]">Arrows always work as a second set. Esc pauses.</p>

          <h3 className="mb-2 mt-4 text-lg font-black">Sliders</h3>
          <label className="flex items-center gap-2 text-xs font-black">Steering response
            <input type="range" className="control-slider flex-1" min={0.5} max={2} step={0.05} value={settings.sensitivity}
              onChange={(e) => patchSettings({ sensitivity: Number(e.target.value) })} />
            <span className="w-8 text-right">{settings.sensitivity.toFixed(2)}</span>
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs font-black">Touch button size
            <input type="range" className="control-slider flex-1" min={0.8} max={1.5} step={0.05} value={settings.touchScale}
              onChange={(e) => patchSettings({ touchScale: Number(e.target.value) })} />
            <span className="w-8 text-right">{Math.round(settings.touchScale * 100)}%</span>
          </label>
        </div>

        <div className="card p-4">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-black"><Volume2 size={18} /> Touch & display</h3>
          {([
            ["swapTouch", "Swap pedal/steer sides", settings.swapTouch],
            ["tilt", "Tilt steering (gyro)", settings.tilt],
            ["music", "Music", settings.music],
            ["sfx", "Sound effects", settings.sfx],
            ["shake", "Screen shake", settings.shake],
          ] as const).map(([key, label, val]) => (
            <button key={key} className="mr-2 mt-1 inline-flex items-center gap-2" onClick={() => toggle(key as "swapTouch" | "tilt" | "music" | "sfx" | "shake", !val)}>
              <span className={`btn px-3 py-1.5 text-xs font-black ${val ? "btn-green" : "btn-white"}`}>{val ? "ON" : "OFF"}</span>
              <span className="text-xs font-black">{label}</span>
            </button>
          ))}
          {settings.tilt && (
            <button
              className="btn btn-teal mt-2 px-3 py-1.5 text-xs font-black"
              onClick={async () => {
                try {
                  const doe = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
                  if (doe.requestPermission) {
                    const r = await doe.requestPermission();
                    setToastRef(r === "granted" ? "Motion permission granted" : "Motion permission denied");
                  }
                } catch { setToastRef("Motion not available"); }
              }}
            >
              Request iOS motion permission
            </button>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-black">Units:</span>
            {(["kmh", "mph"] as const).map((u) => (
              <button key={u} className={`btn px-3 py-1.5 text-xs font-black ${settings.units === u ? "btn-purple text-white" : "btn-white"}`} onClick={() => patchSettings({ units: u })}>{u.toUpperCase()}</button>
            ))}
            <span className="ml-2 text-xs font-black">Quality:</span>
            {(["low", "high"] as const).map((qq) => (
              <button key={qq} className={`btn px-3 py-1.5 text-xs font-black ${settings.quality === qq ? "btn-purple text-white" : "btn-white"}`} onClick={() => patchSettings({ quality: qq })}>{qq}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  function setToastRef(t: string) { useApp.getState().setToast(t); }
}

// ============================================================================
// Leaderboard
// ============================================================================

function LeaderboardScreen() {
  const setScreen = useApp((s) => s.setScreen);
  const [tab, setTab] = useState<"players" | string>("players");
  const [data, setData] = useState<{ players?: { name: string; xp: number }[]; laps?: { name: string; lapMs: number; vehicle: string }[] } | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    const url = tab === "players" ? "/api/leaderboard?top=players" : `/api/leaderboard?track=${tab}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (alive) { setData(j); setErr(false); } })
      .catch(() => { if (alive) { setData(null); setErr(true); } });
    return () => { alive = false; };
  }, [tab]);

  return (
    <div>
      <ScreenHead title="Leaderboards" onBack={() => setScreen("menu")} />
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
        <button className={`btn px-3 py-1.5 text-xs font-black ${tab === "players" ? "btn-yellow" : "btn-white"}`} onClick={() => setTab("players")}>Top racers</button>
        {TRACKS.map((t) => (
          <button key={t.id} className={`btn px-3 py-1.5 text-xs font-black ${tab === t.id ? "btn-yellow" : "btn-white"}`} onClick={() => setTab(t.id)}>{t.name}</button>
        ))}
      </div>
      {err && <p className="text-sm font-black text-[#ff8299]">No server connection — leaderboards need a database (DATABASE_URL).</p>}
      <div className="card p-4">
        {tab === "players" ? (
          <table className="w-full text-left">
            <thead><tr className="text-xs font-black text-[#6b5a8e]"><th className="p-1">#</th><th className="p-1">Racer</th><th className="p-1 text-right">Level</th><th className="p-1 text-right">XP</th></tr></thead>
            <tbody>
              {data?.players?.map((p, i) => (
                <tr key={p.name + i} className="border-t-2 border-[#f0e6ff] text-sm font-black">
                  <td className="p-1">{i + 1}</td><td className="p-1">{p.name}</td>
                  <td className="p-1 text-right">{levelFromXp(p.xp)}</td><td className="p-1 text-right">{p.xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <>
            <div className="mb-2 text-sm font-black text-[#6b5a8e]">Best laps — {trackById(tab as string).name}</div>
            <table className="w-full text-left">
              <thead><tr className="text-xs font-black text-[#6b5a8e]"><th className="p-1">#</th><th className="p-1">Racer</th><th className="p-1">Vehicle</th><th className="p-1 text-right">Lap</th></tr></thead>
              <tbody>
                {data?.laps?.map((l, i) => (
                  <tr key={l.name + i} className="border-t-2 border-[#f0e6ff] text-sm font-black">
                    <td className="p-1">{i + 1}</td><td className="p-1">{l.name}</td>
                    <td className="p-1 text-xs">{vehicleById(l.vehicle).name}</td>
                    <td className="p-1 text-right tabular-nums">{fmtTime(l.lapMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {data && !err && ((tab === "players" && !data.players?.length) || (tab !== "players" && !data.laps?.length)) && (
          <p className="p-2 text-sm font-bold text-[#6b5a8e]">No records yet — race to set them!</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Friends room (P2P)
// ============================================================================

function FriendsScreen() {
  const setScreen = useApp((s) => s.setScreen);
  const profile = useApp((s) => s.profile);
  const setSetup = useApp((s) => s.setSetup);
  const startRace = useStartRace();
  const [tab, setTab] = useState<"host" | "join">("host");
  const [room, setRoom] = useState<P2PRoom | null>(null);
  const [invite, setInvite] = useState("");
  const [answer, setAnswer] = useState("");
  const [peerInput, setPeerInput] = useState("");
  const [peers, setPeers] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState("");
  const [track, setTrack] = useState(TRACKS[0].id);
  const [copied, setCopied] = useState(false);

  const wire = (r: P2PRoom) => {
    r.onPeerJoin = (p) => setPeers((ps) => [...ps.filter((x) => x.id !== p.id), { id: p.id, name: p.name }]);
    r.onPeerLeave = (id) => setPeers((ps) => ps.filter((x) => x.id !== id));
  };

  const doHost = async () => {
    setStatus("creating room…");
    try {
      if (!isWebRTCAvailable()) throw new Error("WebRTC not available in this browser");
      const { room: r, invite: inv } = await hostRoom(profile?.name ?? "Host");
      wire(r);
      setRoom(r);
      setInvite(inv);
      setStatus("Room created! Send the INVITE code to a friend.");
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    }
  };

  const doAccept = async () => {
    if (!room) return;
    setStatus("connecting…");
    try {
      await room.acceptAnswer(peerInput);
      setStatus("Friend connected! ✅");
    } catch (e) {
      setStatus(`Answer rejected: ${(e as Error).message}`);
    }
  };

  const doJoin = async () => {
    setStatus("joining…");
    try {
      if (!isWebRTCAvailable()) throw new Error("WebRTC not available in this browser");
      const { room: r, answer: ans } = await joinRoom(peerInput, profile?.name ?? "Racer");
      wire(r);
      const prev = r.onMessage;
      r.onMessage = (from, data) => {
        prev?.(from, data);
        const msg = data as { t?: string; track?: string };
        if (msg.t === "start" && msg.track) {
          const net: NetHandle = { room: r, role: "peer" };
          setSetup({ net });
          startRace({ mode: "friends", track: msg.track, net });
        }
      };
      setRoom(r);
      setAnswer(ans);
      setStatus("Send the ANSWER code back to the host. When they start the race, you're in!");
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    }
  };

  const startFriendsRace = () => {
    if (!room) return;
    room.send({ t: "start", track });
    const net: NetHandle = { room, role: "host" };
    setSetup({ net });
    startRace({ mode: "friends", track, net });
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setStatus("Clipboard blocked — copy manually."); }
  };

  return (
    <div>
      <ScreenHead title="Friends Room (P2P)" onBack={() => setScreen("menu")} />
      <p className="mb-3 max-w-2xl text-xs font-bold text-[#cbbdf3]">
        Real peer-to-peer multiplayer via WebRTC data channels with public STUN — no game server needed.
        Host creates a room, friends join with the invite/answer codes. The host browser simulates clearly-labeled CPU rivals and is authoritative for results.
        Some restrictive networks block P2P — single-player always works.
      </p>
      <div className="mb-3 flex gap-2">
        <button className={`btn px-4 py-2 text-sm font-black ${tab === "host" ? "btn-pink text-white" : "btn-white"}`} onClick={() => setTab("host")}>HOST A ROOM</button>
        <button className={`btn px-4 py-2 text-sm font-black ${tab === "join" ? "btn-pink text-white" : "btn-white"}`} onClick={() => setTab("join")}>JOIN A ROOM</button>
      </div>

      {tab === "host" ? (
        <div className="card max-w-2xl p-4">
          {!room ? (
            <button className="btn btn-green w-full py-3 text-lg font-black" onClick={() => void doHost()}>CREATE ROOM</button>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <div className="mb-1 text-xs font-black text-[#6b5a8e]">INVITE CODE (send to friend):</div>
                <div className="flex gap-2">
                  <textarea readOnly className="h-24 flex-1 rounded-2xl border-[3px] border-[#1b1533] bg-[#f4edff] p-2 text-[11px] font-bold" value={invite} />
                  <button className="btn btn-teal px-3 py-2 text-xs font-black" onClick={() => void copy(invite)}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-black text-[#6b5a8e]">PASTE THE ANSWER CODE FROM YOUR FRIEND:</div>
                <div className="flex gap-2">
                  <input className="h-12 flex-1 rounded-2xl border-[3px] border-[#1b1533] bg-white px-3 text-xs font-bold" value={peerInput} onChange={(e) => setPeerInput(e.target.value)} placeholder="answer code…" />
                  <button className="btn btn-yellow px-4 py-2 text-sm font-black" onClick={() => void doAccept()}>CONNECT</button>
                </div>
              </div>
              <div className="text-sm font-black">Friends connected: {peers.length > 0 ? peers.map((p) => p.name).join(", ") : "none yet"}</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black">Track:</span>
                <select className="card px-3 py-1.5 text-xs font-black" value={track} onChange={(e) => setTrack(e.target.value)}>
                  {TRACKS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button className="btn btn-green px-6 py-2.5 text-base font-black" disabled={peers.length === 0} onClick={startFriendsRace}>
                  <Play size={16} /> START RACE
                </button>
              </div>
            </div>
          )}
          {status && <p className="mt-3 text-xs font-black text-[#6b5a8e]">{status}</p>}
        </div>
      ) : (
        <div className="card max-w-2xl p-4">
          {!room ? (
            <div className="flex flex-col gap-3">
              <div>
                <div className="mb-1 text-xs font-black text-[#6b5a8e]">PASTE INVITE CODE FROM HOST:</div>
                <textarea className="h-24 w-full rounded-2xl border-[3px] border-[#1b1533] bg-[#f4edff] p-2 text-[11px] font-bold" value={peerInput} onChange={(e) => setPeerInput(e.target.value)} placeholder="invite code…" />
              </div>
              <button className="btn btn-green w-full py-3 text-lg font-black" onClick={() => void doJoin()}>JOIN ROOM</button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <div className="mb-1 text-xs font-black text-[#6b5a8e]">ANSWER CODE (send back to host):</div>
                <div className="flex gap-2">
                  <textarea readOnly className="h-24 flex-1 rounded-2xl border-[3px] border-[#1b1533] bg-[#f4edff] p-2 text-[11px] font-bold" value={answer} />
                  <button className="btn btn-teal px-3 py-2 text-xs font-black" onClick={() => void copy(answer)}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>
                </div>
              </div>
              <p className="text-xs font-black text-[#6b5a8e]">Waiting for the host to start the race…</p>
            </div>
          )}
          {status && <p className="mt-3 text-xs font-black text-[#6b5a8e]">{status}</p>}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// How to play
// ============================================================================

function HowToScreen() {
  const setScreen = useApp((s) => s.setScreen);
  return (
    <div>
      <ScreenHead title="How to play" onBack={() => setScreen("menu")} />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-2 text-lg font-black">⌨️ PC controls</h3>
          <table className="w-full text-sm font-black">
            <tbody>
              {[["W / ↑", "Accelerate"], ["S / ↓", "Brake / reverse"], ["A D / ← →", "Steer"], ["SPACE (hold)", "Drift — release for mini-turbo (gold = BIG)"], ["E / ENTER", "Use power-up"], ["H", "Honk"], ["ESC", "Pause"]].map(([k, a]) => (
                <tr key={k} className="border-t-2 border-[#f0e6ff]"><td className="p-1.5 text-[#8b5cf6]">{k}</td><td className="p-1.5">{a}</td></tr>
              ))}
            </tbody>
          </table>
          <h3 className="mb-2 mt-4 text-lg font-black">📱 Mobile</h3>
          <p className="text-xs font-bold text-[#6b5a8e]">Touch controls appear automatically: steer buttons one side, GAS / STOP / DRIFT the other, item button when you grab a ? box. Remap in Settings → Controls (size, sides, tilt steering).</p>
        </div>
        <div className="card p-4">
          <h3 className="mb-2 text-lg font-black">🏁 Modes</h3>
          <div className="flex flex-col gap-1">
            {MODES.map((m) => <div key={m.id} className="text-xs font-black">{m.name} — <span className="font-bold text-[#6b5a8e]">{m.desc}</span></div>)}
          </div>
          <h3 className="mb-2 mt-4 text-lg font-black">🎁 Power-ups</h3>
          <div className="grid grid-cols-2 gap-1">
            {POWERUPS.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 text-xs font-black">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg border-2 border-[#1b1533] text-white" style={{ background: p.color }}><PowerIcon id={p.id} size={13} /></span>
                {p.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Results
// ============================================================================

export function ResultsView({
  summary,
  onRematch,
  onMenu,
  onGpNext,
}: {
  summary: RaceSummary;
  onRematch: () => void;
  onMenu: () => void;
  onGpNext?: () => void;
}) {
  const profile = useApp((s) => s.profile);
  const veh = vehicleById(summary.vehicleId);
  const placeColor = summary.position === 1 ? "#ffd23f" : summary.position === 2 ? "#c8ccd4" : summary.position === 3 ? "#ff9d5c" : "#cbbdf3";
  const gpStandings = summary.gpScores
    ? Object.entries(summary.gpScores).sort((a, b) => b[1] - a[1])
    : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="card anim-pop relative w-full max-w-lg p-6">
        {summary.position === 1 && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i} className="absolute top-0 h-3 w-2 animate-[confetti-fall_2.4s_linear_infinite]" style={{
                left: `${(i * 41) % 100}%`,
                background: ["#ffd23f", "#ff5ca8", "#2dd4c8", "#8b5cf6"][i % 4],
                animationDelay: `${(i % 12) * 0.2}s`,
              }} />
            ))}
          </div>
        )}
        <div className="text-center">
          <div className="text-xs font-black uppercase tracking-widest text-[#6b5a8e]">{trackById(summary.track).name} · {modeById(summary.mode).name}</div>
          <div className="text-7xl font-black" style={{ color: placeColor, textShadow: "0 5px 0 #16181d" }}>P{summary.position}</div>
          <div className="text-sm font-black text-[#6b5a8e]">of {summary.fieldSize} · {veh.name} · {fmtTime(summary.totalMs)}{summary.bestLapMs ? ` · best lap ${fmtTime(summary.bestLapMs)}` : ""}</div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border-[3px] border-[#1b1533] bg-[#f4edff] p-2">
            <div className="text-[10px] font-black text-[#6b5a8e]">XP EARNED</div>
            <div className="text-lg font-black text-[#8b5cf6]">+{summary.xpEarned ?? 0}</div>
          </div>
          <div className="rounded-2xl border-[3px] border-[#1b1533] bg-[#fff3c9] p-2">
            <div className="text-[10px] font-black text-[#6b5a8e]">COINS</div>
            <div className="flex items-center justify-center gap-1 text-lg font-black text-[#c9920a]"><Coins size={15} />+{summary.coinsEarned ?? 0}</div>
          </div>
          <div className="rounded-2xl border-[3px] border-[#1b1533] bg-[#e2f6ff] p-2">
            <div className="text-[10px] font-black text-[#6b5a8e]">GEMS</div>
            <div className="flex items-center justify-center gap-1 text-lg font-black text-[#2f6fb2]"><Gem size={15} />+{summary.gemsEarned ?? 0}</div>
          </div>
        </div>

        {gpStandings && (
          <div className="card-dark mt-4 p-3">
            <div className="mb-1 text-xs font-black text-[#ffd23f]">🏆 GRAND PRIX CUP STANDINGS</div>
            {gpStandings.map(([name, pts], i) => (
              <div key={name} className="flex justify-between text-xs font-black"><span>{i + 1}. {name}</span><span>{pts} pts</span></div>
            ))}
          </div>
        )}

        <div className="card-dark mt-4 max-h-44 overflow-y-auto p-3">
          {summary.standings.map((s) => (
            <div key={s.name} className="flex items-center gap-2 border-t border-[#3a2d66] py-1 text-xs font-black first:border-0">
              <span className="w-8" style={{ color: s.position <= 3 ? ["#ffd23f", "#c8ccd4", "#ff9d5c"][s.position - 1] : undefined }}>P{s.position}</span>
              <span className="flex-1 truncate">{s.name}{s.isPlayer ? " (you)" : ""}</span>
              <span className="text-[#a08fd0]">{s.vehicleId ? vehicleById(s.vehicleId).name : ""}</span>
              <span className="tabular-nums text-[#cbbdf3]">{s.totalMs ? fmtTime(s.totalMs) : "DNF"}</span>
            </div>
          ))}
        </div>

        {profile && <p className="mt-2 text-center text-[10px] font-bold text-[#6b5a8e]">Balance now: {profile.coins} 🪙 · {profile.gems} 💎 · Lv {levelFromXp(profile.xp)} ({profile.xp} XP)</p>}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button className="btn btn-yellow flex-1 py-3 font-black" onClick={() => { AudioMan.click(); onRematch(); }}>REMATCH</button>
          {onGpNext && <button className="btn btn-purple flex-1 py-3 font-black text-white" onClick={() => { AudioMan.click(); onGpNext(); }}>NEXT RACE <ChevronRight size={16} /></button>}
          <button className="btn btn-red flex-1 py-3 font-black text-white" onClick={() => { AudioMan.click(); onMenu(); }}>MENU</button>
        </div>
      </div>
    </div>
  );
}
