# taytay

## Setup

Install dependencies before running the development TUI:

```bash
pnpm install
```

## Development

Type-check the source:

```bash
pnpm exec tsc --noEmit
```

Run the TUI directly from TypeScript source:

```bash
pnpm dev
```

Development smoke test:

- Type `hello` and press Enter. Expected: `hello` echoes as `you typed: hello`.
- Type `exit` and press Enter. Expected: the process exits cleanly.
- Run `pnpm dev` again and press `Ctrl+C`. Expected: the process exits cleanly.

## Production Build

Compile the TypeScript source into `dist/`:

```bash
pnpm build
```

Expected: the command exits 0 and creates executable `dist/cli.js`.

Run the built output:

```bash
pnpm start
```

Production smoke test:

- Type `hello` and press Enter. Expected: `hello` echoes as `you typed: hello`.
- Type `exit` and press Enter. Expected: the process exits cleanly.
- Run `pnpm start` again and press `Ctrl+C`. Expected: the process exits cleanly.
