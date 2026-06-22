---
inclusion: always
---

# Development Workflow Rules

## Branch & PR Policy

Every change to this project MUST follow this workflow:

1. **Create a feature branch** from `main` before making any changes:
   - Branch naming: `feat/short-description`, `fix/short-description`, or `refactor/short-description`
   - Command: `git checkout -b feat/feature-name`

2. **Make changes on the branch** — never commit directly to `main`

3. **Run all checks before committing:**
   - TypeScript: `npx tsc --noEmit`
   - Rust: `cd src-tauri && cargo check`
   - Vite build: `npx vite build`

4. **Commit with descriptive messages** following conventional commits:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `refactor:` for code improvements
   - `docs:` for documentation
   - `chore:` for maintenance

5. **Push the branch and create a Pull Request:**
   - Push: `git push -u origin branch-name`
   - Create PR: `gh pr create --title "type: description" --body "..." --base main`

6. **Only after PR is approved and merged**, create a tag if a release is needed:
   - `git checkout main && git pull origin main`
   - `git tag vX.Y.Z && git push origin vX.Y.Z`

## Verification Checklist

Before pushing any branch, ALL of these must pass:

```bash
# 1. Run tests
npm test

# 2. TypeScript compilation (frontend)
npx tsc --noEmit

# 3. Rust compilation (backend)
cd src-tauri && cargo check

# 4. Frontend build (catches bundling issues)
npx vite build
```

If any check fails, fix the issue before pushing.

## What NOT to do

- Do NOT commit directly to `main`
- Do NOT push tags without merging the PR first
- Do NOT skip the verification checklist
- Do NOT force push to shared branches

## Tech Stack Reference

- **Frontend:** React 19, TypeScript, Vite, Recharts, jsPDF
- **Backend:** Rust, Tauri 2, SQLite (rusqlite)
- **Plugins:** dialog, fs, updater, process, opener
- **CI/CD:** GitHub Actions (windows build on tag push)
- **File save/export:** Always use Tauri native dialogs (`@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs`), never use Blob URLs or `a.click()` downloads

## Project Conventions

- All UI text in English (US)
- Date/time formatting uses `en-US` locale
- Item database in `src/data/items.ts` — covers D2R v3.2 Reign of the Warlock
- SQLite DB stored in app data dir (survives updates)
- Signing keys for updater stored as GitHub Secret, never in repo
