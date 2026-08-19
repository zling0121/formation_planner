# FormationFlow Setup

FormationFlow currently contains only the application shell and quality tooling. Product functionality, authentication, and database integration have not been implemented.

## Prerequisites

- Node.js 22.13.0 or newer
- pnpm 11

If pnpm is not available, enable it through Corepack:

```sh
corepack enable
corepack prepare pnpm@11.15.1 --activate
```

## Install Dependencies

From the project root:

```sh
pnpm install
```

The exact dependency graph is recorded in `pnpm-lock.yaml` after a successful install.

## Run the App

Start the development server:

```sh
pnpm dev
```

Then open <http://localhost:3000>.

To run the production server after building:

```sh
pnpm start
```

## Code Quality

Run linting:

```sh
pnpm lint
```

Check formatting:

```sh
pnpm format:check
```

Apply formatting:

```sh
pnpm format
```

## Run Tests

Run unit tests once:

```sh
pnpm test
```

Run unit tests in watch mode:

```sh
pnpm test:watch
```

Install the Playwright Chromium browser once on a new machine:

```sh
pnpm exec playwright install chromium
```

Run end-to-end tests:

```sh
pnpm test:e2e
```

The end-to-end test configuration starts the development server automatically when one is not already running.

## Build the App

Create a production build:

```sh
pnpm build
```

Run the resulting production build:

```sh
pnpm start
```

## Validation Record

Validation is not yet complete because this execution environment blocked access to the npm registry before dependencies could be installed.

| Command                  | Result                                                                       |
| ------------------------ | ---------------------------------------------------------------------------- |
| `node --version`         | Passed: bundled runtime reported `v24.14.0`.                                 |
| `pnpm --version`         | Passed: bundled package manager reported `11.9.0`.                           |
| `pnpm install --offline` | Blocked: the local package mirror did not contain `@playwright/test@1.61.1`. |
| `pnpm install`           | Blocked: registry access is not permitted by the current sandbox.            |
| `pnpm dev`               | Pending dependency installation.                                             |
| `pnpm lint`              | Pending dependency installation.                                             |
| `pnpm format:check`      | Pending dependency installation.                                             |
| `pnpm test`              | Pending dependency installation.                                             |
| `pnpm test:e2e`          | Pending dependency and Chromium installation.                                |
| `pnpm build`             | Pending dependency installation.                                             |
