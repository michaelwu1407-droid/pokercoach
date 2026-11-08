import { useEffect } from "react";

const RANKINGS = [
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

const TERMS = [
  ["bb", "Big blind. Every amount is in big blinds, so 2.5bb means two and a half big blinds."],
  ["Equity", "Your chance of winning the pot if all the cards were dealt out now."],
  ["Needed to call", "The equity at which a call breaks even: your call divided by the pot after you call."],
  ["Range", "Every hand an opponent could have, given what they have done this hand."],
  ["Folds to a bet", "How often a bet makes them give up. Wins the pot without a showdown."],
  ["Cost", "How much your choice gives up on average compared with the best option. A loss in one hand is luck. Cost is skill."],
] as const;

const KEYS = [["F", "Fold"], ["C", "Check or call"], ["R", "Smallest bet or raise"], ["2, 3", "Bigger sizes"], ["Space", "Continue or next hand"]] as const;

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
        <p>Make the best five-card hand from your two cards and the five on the table. Bet when you are ahead or can make them fold. After each decision the coach shows what they likely had and what it cost.</p>
        <h3>Hands, strongest first</h3>
        <ol className="plain-list">{RANKINGS.map(([n, d]) => <li key={n}><b>{n}.</b> {d}.</li>)}</ol>
        <h3>Words the coach uses</h3>
        <dl className="terms">{TERMS.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
        <h3>Keys</h3>
        <ul className="plain-list">{KEYS.map(([k, d]) => <li key={k}><kbd>{k}</kbd> {d}</li>)}</ul>
        <button className="primary wide sheet-start" data-testid="help-start" onClick={onClose}>Start playing</button>
      </div>
    </div>
  );
}
