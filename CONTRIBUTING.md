# Contributing

Thanks for helping improve Cards. This is a small personal/community tool, so
the best contributions are focused, easy to review, and covered by the existing
checks.

## Workflow

1. Branch from `main`.
2. Make a focused change.
3. Run:

```bash
npm run release:check
```

4. Open a pull request.
5. Wait for `CI / verify` to pass before merging.

## Pull Request Guidelines

- Keep PRs scoped to one feature, fix, or documentation update.
- Avoid unrelated refactors.
- Do not commit generated output such as `dist`, `coverage`, `.wrangler`, or
  test result folders.
- Include screenshots or notes when the UI changes.
- Mention whether `supabase/schema.sql` changed or needs to be rerun.
- Mention any production smoke testing that should happen after deploy.

## Security Guidelines

Do not commit secrets or private local tooling state:

- `.env` or `.env.*`,
- `.codex`,
- Supabase service-role keys,
- Cloudflare API tokens,
- SMTP credentials,
- private exports or user data.

Report vulnerabilities privately. See [SECURITY.md](SECURITY.md).
