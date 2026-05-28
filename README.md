# Cards

Cards is a personal open-source card builder for creating and sharing game build cards.
The production app lives at [cards.dpdns.org](https://cards.dpdns.org/).

## Features

- Authenticated builder with Supabase magic-link sign-in.
- Cloud-synced private builds with delete tombstones.
- Username profiles so shared builds do not expose email addresses.
- Published shared build snapshots grouped by hero.
- Read-only shared previews with `Save As` for private editable copies.
- PNG export for completed cards.

## Local Setup

Use Node.js 22.

```bash
npm ci
npm run dev
```

Vite serves the app locally. Supabase configuration lives in `src/supabase-config.ts`.
Never commit service-role keys, `.env` files, `.codex`, or private credentials.

## Verification

```bash
npm run check
npm run build
npm test
npm run release:check
```

`release:check` is the full CI/release gate.

## Deployment

Production is deployed to Cloudflare Workers through GitHub Actions after `main`
passes verification. See [DEPLOYMENT.md](DEPLOYMENT.md) for Cloudflare, Supabase,
CI/CD, and release details.

## Contributing

This is maintained as a small personal/community tool with no formal support SLA.
Issues and focused pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Please do not open public issues for secrets or vulnerabilities. See
[SECURITY.md](SECURITY.md) for reporting guidance.

## License

MIT. See [LICENSE](LICENSE).
