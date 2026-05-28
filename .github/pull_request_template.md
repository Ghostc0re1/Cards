## Summary

Describe the change.

## Verification

- [ ] Ran `npm run release:check`
- [ ] Added or updated tests when behavior changed
- [ ] Included screenshots or notes for UI changes
- [ ] Confirmed no secrets, `.env`, `.codex`, generated output, or private data are committed

## Deployment Notes

- [ ] No Supabase schema change
- [ ] Supabase `schema.sql` must be rerun before deploy
- [ ] Production smoke needed after deploy

## Smoke Areas

Check any areas that deserve extra attention:

- [ ] Magic-link sign-in
- [ ] Cloud sync
- [ ] Publish/unpublish
- [ ] Shared build preview
- [ ] `Save As`
- [ ] PNG export
