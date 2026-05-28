# Security Policy

## Supported Versions

Only the latest `main` branch and the latest GitHub Release are supported.
Older versions are not maintained.

## Reporting A Vulnerability

Please do not open public issues for vulnerabilities, leaked credentials, or
security-sensitive reports.

Use GitHub private vulnerability reporting if it is enabled for this repository.
If it is not available, contact the maintainer directly with:

- a short description of the issue,
- the affected area,
- steps to reproduce when safe,
- whether any secret, token, or user data may be involved.

Do not include active secrets in screenshots, logs, comments, or pull requests.

## Secrets

Never commit:

- `.env` or `.env.*`,
- `.codex`,
- Supabase service-role keys,
- Cloudflare API tokens,
- SMTP credentials,
- private user data exports.

If a secret is accidentally committed, rotate or revoke it immediately before
opening any cleanup pull request.
