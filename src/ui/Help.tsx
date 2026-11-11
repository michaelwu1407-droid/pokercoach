import { useEffect } from "react";

export const RANKINGS = [
  ["Straight flush", "Five in a row, all one suit"],
  ["Four of a kind", "Four cards of one rank"],
  ["Full house", "Three of one rank and two of another"],
  ["Flush", "Five cards of one suit"],
  ["Straight", "Five in a row. Ace can be high or low"],
  ["Three of a kind", "Three cards of one rank"],
  ["Two pair", "Two different pairs"],
  ["Pair", "Two cards of one rank"],
  ["High card", "None of the above. Highest card wins"],
] as const;

export const ROUNDS = [
  ["Preflop", "You get two cards. First round of betting."],
  ["Flop", "Three shared cards are dealt face up. Second round."],
  ["Turn", "A fourth shared card. Third round."],
  ["River", "The fifth and last shared card. Final round, then hands are shown."],
] as const;

export const SEATS = [
  ["Dealer", "Acts last after the flop. The best seat, so you can play the most hands here."],
  ["Small blind and Big blind", "Must put in $0.50 and $1 before seeing cards. They act last before the flop and first after it."],
  ["Early, Middle, Late", "The seats after the blinds, in the order they act. The earlier you act, the fewer hands you should play."],
] as const;

export const RULES = [
  "Play few hands, and fewer still from the early seats. Most hands should be folded before the flop.",
  "Before you call, compare your chance to win with what the call needs.",
  "Bet when worse hands will call you or better hands will fold. Otherwise check.",
] as const;

export const WORDS = [
  ["Check", "Bet nothing and pass the turn on. Only possible when nobody has bet."],
  ["Call", "Match the current bet."],
  ["Raise / re-raise", "Make the bet bigger. A re-raise is a raise after someone else raised."],
  ["Raise to $8", "Your total bet this round becomes $8."],
  ["Kicker", "Your other card when two players have the same pair. The higher one wins."],
  ["Fold", "Give up the hand and anything you put in."],
  ["Bluff", "Bet with a weak hand so that better hands fold."],
  ["Chance to win", "How often your hand would win if all the cards were dealt out now."],
  ["Needed to call", "The chance to win at which a call breaks even: your call divided by the pot after you call."],
  ["Outs", "Cards still in the deck that would make your hand."],
  ["Cost on average", "What your choice loses on average, next to the best one. One lost hand is luck. Cost is skill."],
] as const;

export const SHEET = [
  ["They bet half the pot", "You need a 25% chance to call"],
  ["They bet two thirds of the pot", "You need about 29%"],
  ["They bet the whole pot", "You need about 33%"],
  ["Flush draw", "9 outs. About 35% to hit from the flop, 20% from the turn"],
  ["Straight draw, open at both ends", "8 outs. About 31% to hit from the flop, 17% from the turn"],
  ["Pair against two higher cards (8-8 vs A-K)", "About a coin flip, 55% to 45%"],
  ["Higher pair against lower pair (K-K vs 8-8)", "About 80% to 20%"],
  ["Same high card, better kicker (A-K vs A-10)", "About 70% to 30%"],
] as const;

export const KEYS = [
  ["F", "Fold"], ["C", "Check or call"], ["R", "Open the bet sizer, then R or Enter to confirm"],
  ["Arrow keys", "Change the bet amount"], ["Escape", "Close the bet sizer"], ["Space", "Skip ahead or deal the next hand"],
] as const;

export function Help({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" role="dialog" aria-label="How to play" onClick={onClose}>
      <div className="sheet" data-testid="help" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>How to play</h2>
          <button data-testid="help-close" onClick={onClose} aria-label="Close">Close</button>
        </div>
        <p>Make the best five-card hand from your two cards and five shared cards. Everyone starts with $100. Bet when you are ahead, or when they will fold. After each move, the coach shows what your choice cost.</p>
        <h3>Three rules to start with</h3>
        <ol className="plain-list">{RULES.map((r) => <li key={r}>{r}</li>)}</ol>
        <h3>Hands, strongest first</h3>
        <ol className="plain-list">{RANKINGS.map(([n, d]) => <li key={n}><b>{n}.</b> {d}.</li>)}</ol>
        <h3>The four betting rounds</h3>
        <dl className="terms">{ROUNDS.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
        <h3>Seats</h3>
        <dl className="terms">{SEATS.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
        <h3>Words the coach uses</h3>
        <dl className="terms">{WORDS.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
        <h3>Odds worth memorising</h3>
        <dl className="terms">{SHEET.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
        <p className="muted">Quick rule for draws: count your outs, multiply by 4 on the flop or by 2 on the turn. That is roughly your chance to hit.</p>
        <h3>The live trainer</h3>
        <p className="muted">Switch it on from the top bar. On your turn it gives three quick checks. Ask for a hint or the best move if you want. It warns you before a costly mistake. Moves it helped with stay out of your progress numbers.</p>
        <h3>Keys</h3>
        <ul className="plain-list">{KEYS.map(([k, d]) => <li key={k}><kbd>{k}</kbd> {d}</li>)}</ul>
        <button className="primary wide sheet-start" data-testid="help-start" onClick={onClose}>Start playing</button>
      </div>
    </div>
  );
}
