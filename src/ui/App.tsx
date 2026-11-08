import { useState } from "react";
import { drillQueue } from "../learn/learner";
import { HERO, state } from "../session/session";
import { ActionBar } from "./ActionBar";
import { CoachPanel } from "./CoachPanel";
import { Concepts, Progress } from "./Progress";
import { Table } from "./Table";
import { useGame } from "./useGame";

type Tab = "play" | "progress" | "concepts";

export function App() {
  const game = useGame();
  const [tab, setTab] = useState<Tab>("play");
  const [note, setNote] = useState<string | null>(null);
  const st = state(game.hand);
  const drilling = game.mode.kind === "drill";
  const heroTurn = st.phase === "betting" && st.toAct === HERO && game.coachState.kind !== "reveal";
  const dueDrills = drillQueue(game.learner, Date.now()).length;
  const drillSpot = game.mode.kind === "drill" ? game.mode.queue[game.mode.index] : undefined;
  const decisionKey = `${game.hand.seed}:${game.hand.events.length}:${drillSpot?.id ?? "play"}`;

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">pokercoach</span>
        <nav>
          {(["play", "progress", "concepts"] as const).map((t) => (
            <button key={t} className={tab === t ? "tab tab-on" : "tab"} data-testid={`tab-${t}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
        {drilling
          ? <button data-testid="stop-drills" onClick={game.stopDrills}>Back to the table</button>
          : <button data-testid="start-drills" disabled={dueDrills === 0}
              onClick={() => { setTab("play"); setNote(game.startDrills() ? null : "No drills due."); }}>
              Drills ({dueDrills} due)
            </button>}
      </header>
      {note && <p className="note">{note}</p>}
      {tab === "play" && (
        <main className="play">
          <div className="play-main">
            {drilling && game.mode.kind === "drill" && (
              <p className="drill-banner" data-testid="drill-banner">
                Drill {game.mode.index + 1} of {game.mode.queue.length}. You got this spot wrong before. Decide again.
              </p>
            )}
            <Table st={st} revealAll={false} />
            {heroTurn && <ActionBar key={decisionKey} st={st} askReason={game.coachState.kind === "predict" || drilling} onAct={game.act} />}
          </div>
          <CoachPanel coachState={game.coachState} concepts={game.concepts} related={game.related} st={st}
            drilling={drilling} drillConceptIds={drillSpot?.conceptIds ?? []} onDismiss={game.dismiss} onNextHand={game.nextHand} />
        </main>
      )}
      {tab === "progress" && <Progress learner={game.learner} concepts={game.concepts} />}
      {tab === "concepts" && <Concepts learner={game.learner} concepts={game.concepts} />}
    </div>
  );
}
