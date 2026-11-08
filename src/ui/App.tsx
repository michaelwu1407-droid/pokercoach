import { useCallback, useState } from "react";
import { signedMoney } from "../coach/words";
import { describeHand } from "../evaluator/describe";
import { drillQueue } from "../learn/learner";
import { HERO, state } from "../session/session";
import { ActionBar } from "./ActionBar";
import { CoachPanel } from "./CoachPanel";
import { Help } from "./Help";
import { Progress } from "./Progress";
import { ALL_CONCEPTS } from "./store";
import { Table } from "./Table";
import { useGame } from "./useGame";
import { useKeys } from "./useKeys";

export function App() {
  const game = useGame();
  const [page, setPage] = useState<"table" | "progress">("table");
  // First visit opens the guide, so someone new to poker knows the hands and the words.
  const [help, setHelp] = useState(() => game.learner.log.length === 0);
  // Everything on the table follows the hand as played out so far, so opponents act one at a time.
  const st = state(game.shown);
  const bb = st.config.bigBlind;
  const drilling = game.mode.kind === "drill";
  const paused = game.coachState.kind === "feedback" && game.coachState.paused;
  const answered = game.mode.kind === "drill" && game.mode.answered;
  const heroTurn = !game.playing && st.phase === "betting" && st.toAct === HERO && !paused && !answered;
  const handOver = !game.playing && st.phase === "complete" && !paused && !drilling;
  const due = drillQueue(game.learner, Date.now()).length;
  const decisionKey = `${game.hand.seed}:${game.shown.events.length}:${game.mode.kind === "drill" ? game.mode.index : "play"}`;

  const misses = game.hand.grades.filter((g) => g.graded && (g.verdict === "mistake" || g.verdict === "blunder")).length;
  const net = st.phase === "complete" ? (st.payouts.find((p) => p.seat === HERO)?.amount ?? 0) - st.seats[HERO]!.total : 0;
  const next = paused ? game.resume : answered ? game.nextDrill : handOver ? game.nextHand : game.playing ? game.skip : null;
  const onKey = useCallback((k: string) => (k === " " || k === "enter") && next !== null && (next(), true), [next]);
  useKeys(next ? onKey : null);

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">pokercoach</span>
        {drilling
          ? <button data-testid="stop-drills" onClick={game.stopDrills}>Back to the table</button>
          : due > 0 && page === "table" && <button data-testid="start-drills" onClick={game.startDrills}>Practise {due} mistake{due > 1 ? "s" : ""}</button>}
        <button data-testid="tab-progress" onClick={() => setPage(page === "table" ? "progress" : "table")}>
          {page === "table" ? "Progress" : "Back to the table"}
        </button>
        <button data-testid="help-button" aria-label="How to play" onClick={() => setHelp(true)}>?</button>
      </header>
      {page === "table" ? (
        <main className={`play${game.coachState.kind === "feedback" ? " with-coach" : ""}`}>
          <div className="play-main">
            {game.mode.kind === "drill" && (
              <p className="banner" data-testid="drill-banner">Practice {game.mode.index + 1} of {game.mode.queue.length}: you got this spot wrong before.</p>
            )}
            <Table st={st} events={game.shown.events} onSkip={game.skip} />
            <div className="controls">
              <p className="you-have" data-testid="you-have">You have: <b>{describeHand(st.seats[HERO]!.hole, st.board)}</b></p>
              {heroTurn && <ActionBar key={decisionKey} st={st} onAct={game.act} />}
              {paused && <button className="primary wide" data-testid="continue" onClick={game.resume}>Got it, continue</button>}
              {answered && <button className="primary wide" data-testid="next-drill" onClick={game.nextDrill}>Next</button>}
              {handOver && (
                <div className="hand-over" data-testid="review">
                  <span>{signedMoney(net, bb)} this hand{misses > 0 ? ` · ${misses} mistake${misses > 1 ? "s" : ""}` : ""}</span>
                  <button className="primary" data-testid="next-hand" onClick={game.nextHand}>Next hand</button>
                </div>
              )}
            </div>
          </div>
          <CoachPanel coachState={game.coachState} opponents={game.hand.opponents} bigBlind={bb} />
        </main>
      ) : (
        <Progress learner={game.learner} concepts={ALL_CONCEPTS} />
      )}
      {help && <Help onClose={() => setHelp(false)} />}
    </div>
  );
}
