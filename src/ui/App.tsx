import { useCallback, useState } from "react";
import { signedMoney } from "../coach/words";
import { describeHand } from "../evaluator/describe";
import { isMiss } from "../grading/types";
import { CORE_CONCEPTS } from "../learn/concepts";
import { drillQueue } from "../learn/learner";
import { HERO, state } from "../session/session";
import { ActionBar } from "./ActionBar";
import { CoachPanel } from "./CoachPanel";
import { Help } from "./Help";
import { Progress } from "./Progress";
import { Table } from "./Table";
import { gameOutcome, tableNews } from "./tableNews";
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
  const answered = drilling && game.decisions.length > 0;
  const heroTurn = !game.playing && st.phase === "betting" && st.toAct === HERO && !answered;
  const handOver = !game.playing && st.phase === "complete" && !drilling;
  const due = drillQueue(game.learner, Date.now()).length;
  const decisionKey = `${game.hand.seed}:${game.shown.events.length}:${game.mode.kind === "drill" ? game.mode.index : "play"}`;
  const me = st.seats[HERO]!;

  const misses = game.decisions.filter((d) => d.grade?.graded && isMiss(d.grade.verdict)).length;
  const outcome = st.phase === "complete" ? gameOutcome(game.hand) : "playing";
  const net = st.phase === "complete" ? (st.payouts.find((p) => p.seat === HERO)?.amount ?? 0) - me.total : 0;
  const next = answered ? game.nextDrill : handOver ? game.nextHand : game.playing ? game.skip : null;
  // Space always belongs to the game, so it never presses whatever button last had focus.
  const onKey = useCallback((k: string) => (k === " " || k === "enter") && (next?.(), true), [next]);
  useKeys(page === "table" ? onKey : null);

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand"><span className="brand-mark" aria-hidden="true">♠</span>pokercoach</span>
        {drilling
          ? <button data-testid="stop-drills" onClick={game.stopDrills}>Stop practice</button>
          : due > 0 && page === "table" && <button className="primary" data-testid="start-drills" onClick={game.startDrills}>Practise {due} mistake{due > 1 ? "s" : ""}</button>}
        <button data-testid="tab-progress" onClick={() => setPage(page === "table" ? "progress" : "table")}>
          {page === "table" ? "Progress" : "Back to the table"}
        </button>
        <button data-testid="help-button" aria-label="How to play" onClick={() => setHelp(true)}>?</button>
      </header>
      {page === "table" ? (
        <main className="play">
          <div className="play-main">
            {game.mode.kind === "drill" && (
              <p className="banner" data-testid="drill-banner">Practice {game.mode.index + 1} of {game.mode.queue.length}: you got this spot wrong before.</p>
            )}
            <Table st={st} events={game.shown.events} onSkip={game.skip} />
            <div className="controls">
              <p className="you-have" data-testid="you-have">
                {me.folded ? "You folded" : "You have"}: <b>{describeHand(me.hole, st.board)}</b>
              </p>
              <div className="next-row">
                {heroTurn && <ActionBar key={decisionKey} st={st} onAct={game.act} />}
                {answered && <button className="primary wide" data-testid="next-drill" onClick={game.nextDrill}>Next</button>}
                {handOver && (
                  <div className="hand-over" data-testid="review">
                    <span>
                      {signedMoney(net, bb)} this hand{drilling ? "" : ` · ${signedMoney(game.table.net + net, bb)} this game`}
                      {!drilling && outcome === "lost" ? " · You are out of chips. Next hand starts a new game." : ""}
                      {!drilling && outcome === "won" ? " · You won: everyone else is out of chips!" : ""}
                      {misses > 0 ? ` · ${misses} mistake${misses > 1 ? "s" : ""} saved for practice` : ""}
                    </span>
                    <button className="primary" data-testid="next-hand" onClick={game.nextHand}>Next hand</button>
                  </div>
                )}
                {game.playing && <p className="muted small waiting">Others are acting. <span className="hint-keys">Space skips ahead.</span><span className="hint-touch">Tap the table to skip.</span></p>}
              </div>
            </div>
          </div>
          <CoachPanel key={game.hand.seed} decisions={game.decisions} opponents={game.hand.opponents} bigBlind={bb}
            moment={heroTurn ? "turn" : handOver ? "review" : "watching"} newTable={game.newTableHand}
            news={drilling ? null : tableNews(game.table)} />
        </main>
      ) : (
        <Progress learner={game.learner} concepts={CORE_CONCEPTS} />
      )}
      {help && <Help onClose={() => setHelp(false)} />}
    </div>
  );
}
