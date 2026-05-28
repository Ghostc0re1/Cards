# Cloudflare Workers + Supabase Setup

## Cloudflare Workers Static Assets

1. Push this folder to a GitHub repository.
2. Create a Cloudflare Workers project from that repository.
3. In the Cloudflare Git build settings, use `npx wrangler versions upload` as the command so pushes create inactive Worker versions instead of promoting production traffic.
4. `npm run build` writes the static site to `dist`.
5. `wrangler.jsonc` serves static assets from `dist`.
6. Keep `https://cards.dpdns.org/` as the primary production URL.
7. Keep `https://cards.tberardelli.workers.dev/` available during the custom-domain transition.
8. Normal production deploys should be promoted by GitHub Actions, not by Cloudflare's connected-repo auto deploy.

## GitHub Actions CI/CD

The repo uses two workflows:

- `CI` runs on pull requests and pushes to `main`. Its required merge check is the `verify` job.
- `Deploy Production` runs on pushes to `main` and can also be run manually. It reruns `npm run release:check` before `wrangler deploy`.

Required GitHub secrets for the `production` environment:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

After the `CI` workflow has run once, configure branch protection for `main`:

1. Require a pull request before merging.
2. Require status checks to pass before merging.
3. Select `CI / verify` or `verify`, whichever GitHub shows.
4. Require branches to be up to date before merging.
5. Block force pushes and branch deletion.

Do not require production deployments to succeed before merging. Production deploys happen after merge, and the deploy workflow performs its own release check before promotion.

## Cloudflare Pages Alternative

If you prefer Pages instead of Workers, set:

- Build command: `npm run build`
- Build output directory: `dist`

## Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. In Authentication settings, add redirect URLs for:
   - `http://127.0.0.1:5173/`
   - `https://cards.dpdns.org/`
   - `https://cards.tberardelli.workers.dev/`
   - your Cloudflare Pages production URL, if you also deploy there
4. Edit `src/supabase-config.ts`:
   - Set `enabled: true`
   - Set `url` to the project URL
   - Set `anonKey` to the publishable/anon key
5. Never place the service-role key in frontend files.
6. Review `Authentication > Rate Limits`, especially OTP/magic-link limits. The app enforces a 65-second local resend cooldown to match Supabase's default same-user OTP window, but project/IP limits can still return `429 Too Many Requests` during repeated testing.
7. Keep magic links and Brevo custom SMTP enabled for production.
8. If Supabase Auth logs show `525 5.7.1 Unauthorized IP address`, authorize the blocked Brevo SMTP source IP or relax Brevo unknown-IP blocking for the Supabase-only SMTP credential.

## Pre-production Checklist

1. Run the current `supabase/schema.sql` in Supabase before deploying. The app requires the v3 cloud schema: `profiles`, `builds.shared_at`, `build_shares`, and `shared_builds`.
2. Confirm Supabase Auth redirect URLs include:
   - `https://cards.dpdns.org/`
   - `https://cards.tberardelli.workers.dev/`
   - `http://127.0.0.1:5173/` for local smoke testing
3. Confirm the GitHub `CI / verify` check is passing.
4. Confirm the `Deploy Production` workflow completed successfully for the target commit.
5. Smoke test production:
   - stale or expired magic-link URL cleans itself up without signing out a valid cached session
   - first sign-in username setup works and duplicate usernames fail cleanly
   - publish, publish changes, and unpublish do not change local published status on failed cloud writes
   - shared builds open as read-only previews
   - `Save As` from a shared preview creates an editable private copy

## Notes

- The app continues to work locally with localStorage when Supabase is disabled.
- Export sharing is PNG-only in this phase.
- JSON export/import remains available as a backup path.
- Cloud build deletions use `deleted_at` tombstones and shared builds use published snapshots, so rerun `supabase/schema.sql` after pulling schema changes.
