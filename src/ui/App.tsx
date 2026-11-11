import { useCallback, useMemo, useState } from "react";
import { oddsTimeline } from "../coach/liveOdds";
import { signedMoney } from "../coach/words";
import { isMiss } from "../grading/types";
import { CORE_CONCEPTS } from "../learn/concepts";
import { drillQueue } from "../learn/learner";
import { HERO, state } from "../session/session";
import { ActionBar } from "./ActionBar";
import { CoachPanel } from "./CoachPanel";
import { Help } from "./Help";
import { OddsPanel } from "./OddsPanel";
import { Progress } from "./Progress";
import { Table } from "./Table";
import { gameOutcome, tableNews } from "./tableNews";
import { useGame } from "./useGame";
import { TrainerPanel, TrainerWarning } from "./TrainerPanel";
import { useTrainer } from "./useTrainer";
import { trainerBrief } from "../coach/trainer";

const TRAINER_KEY = "pokercoach.trainer";
function readTrainer(): boolean {
  try { return localStorage.getItem(TRAINER_KEY) === "1"; } catch { return false; }
}
function saveTrainer(on: boolean) {
  try { localStorage.setItem(TRAINER_KEY, on ? "1" : "0"); } catch { /* Blocked storage: the choice lasts for this page only. */ }
}
import { useKeys } from "./useKeys";

export function App() {
  const game = useGame();
  const [page, setPage] = useState<"table" | "progress">("table");
  // First visit opens the guide, so someone new to poker knows the hands and the words.
  const [help, setHelp] = useState(() => game.learner.log.length === 0);
  const [trainerOn, setTrainerOn] = useState(readTrainer);
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

  // The trainer is for play only: in practice it would hand you the answer to the spot you missed.
  const trainerSpot = heroTurn && !drilling ? game.hand : null;
  const trainer = useTrainer(game, trainerOn && !drilling, trainerSpot);
  const brief = useMemo(() => (trainerSpot ? trainerBrief(st, HERO, game.hand.opponents, game.table.seen) : null), [trainerSpot, st, game.hand.opponents, game.table.seen]);
  const misses = game.decisions.filter((d) => d.grade?.graded && isMiss(d.grade.verdict)).length;
  const odds = useMemo(() => oddsTimeline(game.shown.events, HERO), [game.shown.events]);
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
        <button data-testid="trainer-toggle" aria-pressed={trainerOn} className={trainerOn ? "toggle-on" : ""}
          onClick={() => { setTrainerOn(!trainerOn); saveTrainer(!trainerOn); }}>Trainer: {trainerOn ? "On" : "Off"}</button>
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
              <OddsPanel folded={me.folded} over={st.phase === "complete"} steps={odds} />
              <div className="next-row">
                {heroTurn && trainer.warn && <TrainerWarning trainer={trainer} opponents={game.hand.opponents} bigBlind={bb} />}
                {heroTurn && !trainer.warn && trainer.checking && <p className="muted small waiting">Checking your move…</p>}
                {heroTurn && !trainer.warn && !trainer.checking && <ActionBar key={decisionKey} st={st} onAct={trainer.act} />}
                {answered && <button className="primary wide" data-testid="next-drill" onClick={game.nextDrill}>Next</button>}
                {handOver && (
                  <div className="hand-over" data-testid="review">
                    <span>
                      {signedMoney(net, bb)} profit this hand{drilling ? "" : ` · ${signedMoney(game.table.net + net, bb)} this game`}
                      {!drilling && outcome === "lost" ? " · You are out of chips. Next hand starts a new game." : ""}
                      {!drilling && outcome === "won" ? " · You won: everyone else is out of chips!" : ""}
                    </span>
                    <button className="primary" data-testid="next-hand" onClick={game.nextHand}>Next hand</button>
                  </div>
                )}
                {game.playing && <p className="muted small waiting">Others are acting. <span className="hint-keys">Space skips ahead.</span><span className="hint-touch">Tap the table to skip.</span></p>}
              </div>
            </div>
          </div>
          <div className="coach-col">
          {trainer.on && trainerSpot && brief && <TrainerPanel trainer={trainer} brief={brief} opponents={game.hand.opponents} bigBlind={bb} />}
          {!(trainer.on && trainerSpot && game.decisions.length === 0) && <CoachPanel key={game.hand.seed} decisions={game.decisions} opponents={game.hand.opponents} bigBlind={bb}
            moment={heroTurn ? "turn" : handOver ? "review" : "watching"} newTable={game.newTableHand}
            news={drilling ? null : tableNews(game.table)} />}
          </div>
        </main>
      ) : (
        <Progress learner={game.learner} concepts={CORE_CONCEPTS} />
      )}
      {help && <Help onClose={() => setHelp(false)} />}
    </div>
  );
}
