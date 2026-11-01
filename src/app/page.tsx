"use client";

import { Suspense, useCallback, useEffect } from "react";
import { useApp, type RaceSummary } from "@/lib/store";
import Menus, { TopBar, ResultsView, useStartRace } from "@/components/menus";
import RaceScreen from "@/components/game";
import { AudioMan } from "@/game/audio";
import { GP_TRACKS, GP_POINTS } from "@/game/data";

export default function Page() {
  return (
    <Suspense fallback={<div className="candy-sky flex min-h-dvh items-center justify-center text-3xl font-black text-white">Loading chaos…</div>}>
      <Shell />
    </Suspense>
  );
}

function Shell() {
  const inRace = useApp((s) => s.inRace);
  const summary = useApp((s) => s.summary);
  const setSummary = useApp((s) => s.setSummary);
  const setup = useApp((s) => s.setup);
  const setInRace = useApp((s) => s.setInRace);
  const setScreen = useApp((s) => s.setScreen);
  const submitRace = useApp((s) => s.submitRace);
  const bumpRaceKey = useApp((s) => s.bumpRaceKey);
  const setSetup = useApp((s) => s.setSetup);
  const startRace = useStartRace();

  // menu music while not racing (browser needs a gesture first — any click does it)
  useEffect(() => {
    const kick = () => {
      AudioMan.ensure();
      if (!useApp.getState().inRace && !useApp.getState().summary) AudioMan.startMusic("menu");
      window.removeEventListener("pointerdown", kick);
    };
    window.addEventListener("pointerdown", kick);
    return () => window.removeEventListener("pointerdown", kick);
  }, []);

  useEffect(() => {
    if (!inRace && !summary) AudioMan.startMusic("menu");
  }, [inRace, summary]);

  const handleFinish = useCallback((s: RaceSummary) => {
    setInRace(false);
    if (s.mode === "practice") {
      setSummary({ ...s });
      return;
    }
    if (s.mode === "grandprix") {
      // Scores live in the summary/setup only — a rematch of the same GP race
      // never double-counts points.
      const scores: Record<string, number> = { ...(setup.gpScores ?? {}) };
      s.standings.forEach((r) => {
        scores[r.name] = (scores[r.name] ?? 0) + (GP_POINTS[r.position - 1] ?? 0);
      });
      const gpRace = setup.gpRace ?? 0;
      const gpDone = gpRace >= GP_TRACKS.length - 1;
      void submitRace({ ...s, gpScores: scores, gpDone });
      return;
    }
    void submitRace(s);
  }, [setInRace, setSummary, setup, submitRace]);

  const handleQuit = useCallback(() => {
    const net = useApp.getState().setup.net;
    if (net) {
      try { net.room.close(); } catch { /*noop*/ }
      setSetup({ net: null });
    }
    setInRace(false);
    setSummary(null);
    setScreen("menu");
    AudioMan.stopMusic();
    AudioMan.startMusic("menu");
  }, [setInRace, setSummary, setScreen, setSetup]);

  const handleRematch = useCallback(() => {
    setSummary(null);
    bumpRaceKey();
    setInRace(true);
  }, [setSummary, bumpRaceKey, setInRace]);

  const handleGpNext = useCallback(() => {
    const cur = useApp.getState().summary;
    const nextIdx = (setup.gpRace ?? 0) + 1;
    const scores = cur?.gpScores ?? setup.gpScores;
    setSummary(null);
    startRace({ mode: "grandprix", track: GP_TRACKS[nextIdx], gpRace: nextIdx, gpScores: scores });
  }, [setup, setSummary, startRace]);

  return (
    <div className="candy-sky min-h-dvh">
      {inRace ? (
        <RaceScreen onFinish={handleFinish} onQuit={handleQuit} onRestart={handleRematch} />
      ) : (
        <>
          <TopBar />
          <Menus />
          {summary && (
            <ResultsView
              summary={summary}
              onRematch={handleRematch}
              onMenu={() => { setSummary(null); setScreen("menu"); }}
              onGpNext={summary.mode === "grandprix" && !summary.gpDone ? handleGpNext : undefined}
            />
          )}
        </>
      )}
    </div>
  );
}
