# pokercoach

Learn No-Limit Hold'em by playing. After every decision a coach shows what your opponent likely had, the numbers that decided it, and one thing to remember. Mistakes come back as practice. No accounts, no API keys.

## Run it

```bash
npm install
npm run dev
```

Open the address it prints. A short guide opens on your first visit (press ? to see it again). Keys: F fold, C check or call, R raise, Space next. Progress is saved in your browser.

## Check it

```bash
npm run verify
```

Runs the typecheck, unit tests, a production build, and a browser test that plays real hands.

## Read more

- `docs/requirements.md`. What the app needs, the build order, and its current status.
- `docs/decisions.md`. Why it works the way it does.
- `CLAUDE.md`. How code is written here.
