import { useState } from "react";
import { drillQueue } from "../learn/learner";
import { HERO, state } from "../session/session";
import { describeHand } from "../evaluator/describe";
import { ActionBar } from "./ActionBar";
import { Help } from "./Help";
import { CoachPanel } from "./CoachPanel";
import { Progress } from "./Progress";
import { ALL_CONCEPTS } from "./store";
import { Table } from "./Table";
import { useGame } from "./useGame";

export function App() {
  const game = useGame();
  const [tab, setTab] = useState<"play" | "progress">("play");
  // First visit opens the guide, so someone new to poker knows the hands and the words.
  const [help, setHelp] = useState(() => game.learner.log.length === 0);
  const st = state(game.hand);
  const drilling = game.mode.kind === "drill";
  const paused = game.coachState.kind === "feedback" && game.coachState.paused;
  const answered = game.mode.kind === "drill" && game.mode.answered;
  const heroTurn = st.phase === "betting" && st.toAct === HERO && !paused && !answered;
  const due = drillQueue(game.learner, Date.now()).length;

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">pokercoach</span>
        <button className={tab === "play" ? "tab tab-on" : "tab"} data-testid="tab-play" onClick={() => setTab("play")}>Play</button>
        <button className={tab === "progress" ? "tab tab-on" : "tab"} data-testid="tab-progress" onClick={() => setTab("progress")}>Progress</button>
        <button data-testid="help-button" aria-label="How to play" onClick={() => setHelp(true)}>?</button>
        {drilling
          ? <button data-testid="stop-drills" onClick={game.stopDrills}>Back to the table</button>
          : due > 0 && <button data-testid="start-drills" onClick={() => (setTab("play"), game.startDrills())}>Practise {due} mistake{due > 1 ? "s" : ""}</button>}
      </header>
      {tab === "play" ? (
        <main className="play">
          <div className="play-main">
            {game.mode.kind === "drill" && (
              <p className="banner" data-testid="drill-banner">
                Practice {game.mode.index + 1} of {game.mode.queue.length}. You got this spot wrong before. What is the right play?
              </p>
            )}
            {game.newTable && game.coachState.kind === "idle" && (
              <p className="banner" data-testid="new-table">New table. Watch how each player bets. The coach tells you what they are after each decision.</p>
            )}
            <Table st={st} />
            <p className="you-have" data-testid="you-have">You have: <b>{describeHand(st.seats[HERO]!.hole, st.board)}</b></p>
            {heroTurn && <ActionBar st={st} onAct={game.act} />}
          </div>
          <CoachPanel coachState={game.coachState} st={st} opponents={game.hand.opponents} grades={game.hand.grades}
            drilling={drilling} onResume={game.resume} onNext={drilling ? game.nextDrill : game.nextHand} />
        </main>
      ) : (
        <Progress learner={game.learner} concepts={ALL_CONCEPTS} />
      )}
      {help && <Help onClose={() => setHelp(false)} />}
    </div>
  );
}
