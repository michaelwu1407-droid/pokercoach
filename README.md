# pokercoach

Learn No-Limit Hold'em by playing. A coach grades each decision by expected value against opponents whose strategies it knows, explains the numbers, cites where each idea comes from, and brings your mistakes back as drills.

## Run it

```bash
npm install
npm run dev
```

Open the address it prints. Progress is saved in your browser.

## Add your poker books

Books stay on your machine in `books/`, which is never committed. Extraction calls the Claude API, so set `ANTHROPIC_API_KEY` first.

```bash
npm run kb:ingest -- path/to/book.pdf --title "Book Title"
npm run kb:extract -- book-title
npm run kb:review -- book-title
```

Review shows each proposed concept with its quote. Only concepts you approve appear in the app. Restart `npm run dev` to load them.

## Check it

```bash
npm run verify
```

Runs the typecheck, unit tests, a production build, and a browser test that plays real hands.

## Read more

- `docs/requirements.md`. What the app needs, the build order, and its current status.
- `docs/decisions.md`. Why it works the way it does.
- `CLAUDE.md`. How code is written here.
