# Git Hooks

This directory contains git hooks that automate versioning and release workflows.

## Available Hooks

### pre-push

Automatically version bumps the webapp and/or extension based on changes being pushed to the main branch.

**What it does:**
- Analyzes commits being pushed to main/master branch
- Detects changes in webapp files (excluding extension directory)
- Detects changes in extension files
- Auto-bumps versions using commit message analysis
- Amends the last commit with version changes
- Prevents push until version is updated (requires re-push)

**Behavior:**
1. Detects if you're pushing to main/master
2. Checks for webapp changes (excludes `mio-session-extractor/`, `scripts/`, `dist/`)
3. Checks for extension changes (only `mio-session-extractor/` directory)
4. If changes detected without version bump:
   - Runs `version-webapp.js auto` or `version-extension.js auto`
   - Amends your last commit with version bump
   - Exits with error (requires you to push again)
5. Second push will succeed with versioned commit

**Example workflow:**
```bash
# Make changes to webapp
git add src/app/page.tsx
git commit -m "feat: add new homepage section"
git push origin main

# Hook detects changes, auto-bumps version, amends commit
# Output: "Versions updated. Please run 'git push' again"

git push origin main
# Now succeeds with versioned commit
```

## Installation

### Automatic (Recommended)

Hooks are automatically installed when you run `pnpm install` thanks to the `postinstall` script.

### Manual

```bash
# Install all hooks
pnpm run setup-hooks install

# List installed hooks
pnpm run setup-hooks list

# Uninstall hooks
pnpm run setup-hooks uninstall
```

## Disabling Hooks

### Temporarily (one-time)

Use `--no-verify` flag to skip hooks:

```bash
git push --no-verify
```

### Permanently

Uninstall the hooks:

```bash
pnpm run setup-hooks uninstall
```

## How Version Detection Works

The pre-push hook uses the same version detection logic as the version scripts:

### Major Version Bump
- `BREAKING CHANGE` in commit message
- `breaking:` prefix
- `feat!` or `fix!` (with exclamation mark)
- API changes, incompatible changes

### Minor Version Bump
- `feat:` prefix
- `feature:`, `add:`, `new:` prefixes
- New features, enhancements
- API route additions (for webapp)

### Patch Version Bump
- `fix:`, `bug:` prefix
- `chore:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:` prefixes
- Bug fixes, documentation, code cleanup

## Troubleshooting

### Hook not running

Check if the hook is installed:
```bash
pnpm run setup-hooks list
```

Reinstall if needed:
```bash
pnpm run setup-hooks install
```

### Hook causing issues

Temporarily bypass the hook:
```bash
git push --no-verify
```

Or uninstall:
```bash
pnpm run setup-hooks uninstall
```

### Version not detecting correctly

Test version detection manually:
```bash
# For webapp
pnpm run version-webapp analyze

# For extension
pnpm run version-extension analyze
```

## Customization

To modify hook behavior, edit:
- [scripts/hooks/pre-push](pre-push) - The actual hook script
- [scripts/version-webapp.js](../version-webapp.js) - Webapp version detection logic
- [scripts/version-extension.js](../version-extension.js) - Extension version detection logic

After modifying, reinstall hooks:
```bash
pnpm run setup-hooks install
```
