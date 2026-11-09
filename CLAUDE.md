# poker-coach

An app that teaches the owner No-Limit Hold'em while they play. The full breakdown is in `docs/requirements.md`. Read it before any task.

## Coding practice: pstack, applied in full

This repo follows Lauren Tan's (poteto) pstack without modification. Source of truth is the plugin, not this file. This file never paraphrases pstack, because a paraphrase is a dilution.

- Plugin: `pstack@cursor-plugins` from `github.com/cursor/plugins`, enabled in `.claude/settings.json`. Baseline version 0.15.36, commit `6b03002`.
- First session on a machine: run `/pstack:setup-pstack`.
- Every non-trivial task starts with `/pstack:poteto-mode`. Follow its Non-negotiables, Principles, Autonomy, Subagents, Writing the reply, Comments, and the matched playbook, verbatim.
- Read `docs/harness/claude-code.md` inside the plugin once per session to map Cursor names to Claude Code names.
- If the plugin is not installed or fails to load, stop and install it. Do not proceed from memory of what pstack says.
- `/deslop` and `control-ui` come from the `cursor-team-kit` plugin. Install it too. Where a step needs a Cursor-only feature (Bugbot, Automations, cloud agents), write `Skipped in Claude Code: <step>. <reason>.` and continue, as the adapter instructs.

## Domain invariants (project-specific, enforced on top of pstack)

These follow from the north star. Each one is a rule a test or type must enforce, not a reminder (pstack's Encode Lessons in Structure).

1. **No LLM. Poker truth comes from code.** Legality, pot math, equity, range membership, and EV are computed by the engine and evaluator. Every number shown passes the grounding check in `src/coach/grounding.ts`.
2. **Grade decisions, never outcomes.** Feedback is scored by EV loss of the action taken against the best action. Who won the hand is never an input to grading.
3. **Every teaching claim is backed.** A claim shown to the learner comes from an evaluator result, a chart, or an opponent profile.
4. **You decide first.** Nothing hints at the answer before a decision. Feedback comes after.
5. **The hand is an event log.** Game state is derived by reducing an append-only list of actions. No mutable table object.

## Teaching rule (from the owner's feedback, applies to every screen)

Every number shown answers three things, briefly: what it is made of (the hands, the sum), why it is that size, and a quick check the learner can do at a live table. Never spend words defining basic terms such as what a percentage is. Short beats complete; plain words beat precise jargon.

Before shipping any change to coach text, run `npm run cards -- <seed> 24` on two or three seeds and read every card as a beginner who knows hand rankings but no theory: no line may contradict its own numbers, repeat another line, or leave a number without what it is measured against. Fix and re-read until none do.

## Stack defaults

TypeScript, strict mode. Web app. Choices beyond this are made per pstack's Prototype playbook, with the result recorded in `docs/decisions.md`.
