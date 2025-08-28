# Automated Version Detection Guide

This document explains how the GitHub Actions workflow automatically detects the appropriate version bump type based on commit messages.

## How It Works

The system analyzes commit messages since the last release to determine whether to increment the **major**, **minor**, or **patch** version number.

## Detection Logic

The workflow examines all commits that affect the `mio-session-extractor/` directory and uses pattern matching to categorize changes:

### 1. Major Version Bump (Breaking Changes)

**Triggers:** `2.1.0` → `3.0.0`

The system detects major version bumps when commit messages contain:

```bash
# Pattern: (BREAKING|major:|feat!:|fix!:)
```

**Examples of commit messages that trigger major bumps:**

```bash
# Explicit breaking change indicators
git commit -m "BREAKING: remove deprecated API endpoints"
git commit -m "BREAKING CHANGE: restructure extension manifest"

# Major version indicators
git commit -m "major: complete rewrite of session handling"

# Breaking feature/fix indicators (conventional commits)
git commit -m "feat!: change extension permissions structure"
git commit -m "fix!: remove support for legacy browser versions"
```

**What constitutes a breaking change:**

- Removing or changing existing APIs
- Changing extension permissions
- Modifying data structures that affect stored settings
- Removing features that users depend on
- Changing behavior that could break existing workflows

### 2. Minor Version Bump (New Features)

**Triggers:** `2.1.0` → `2.2.0`

The system detects minor version bumps when commit messages contain:

```bash
# Pattern: (feat:|feature:|minor:)
```

**Examples of commit messages that trigger minor bumps:**

```bash
# Feature additions
git commit -m "feat: add new performance monitoring dashboard"
git commit -m "feature: implement dark mode support"
git commit -m "feat: add export functionality for session data"

# Minor version indicators
git commit -m "minor: add new configuration options"
```

**What constitutes a minor change:**

- Adding new features
- Adding new configuration options
- Enhancing existing functionality (backward compatible)
- Adding new UI components or pages
- Improving performance without breaking changes

### 3. Patch Version Bump (Bug Fixes & Improvements)

**Triggers:** `2.1.0` → `2.1.1`

**Default behavior** - when no major or minor patterns are detected, the system defaults to patch.

**Examples of commit messages that result in patch bumps:**

```bash
# Bug fixes
git commit -m "fix: resolve session timeout issues"
git commit -m "bugfix: correct popup display on Firefox"

# Improvements and maintenance
git commit -m "improve: optimize memory usage in background script"
git commit -m "docs: update installation guide"
git commit -m "style: fix CSS alignment issues"
git commit -m "refactor: clean up content script code"
git commit -m "chore: update dependencies"
```

**What constitutes a patch change:**

- Bug fixes
- Performance improvements
- Documentation updates
- Code refactoring (no functional changes)
- Dependency updates
- Style/UI fixes
- Security patches

## Commit Message Best Practices

To ensure proper version detection, follow these commit message conventions:

### Conventional Commits Format

```bash
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Recommended Types

```bash
# For breaking changes
feat!: <description>    # Breaking feature
fix!: <description>     # Breaking fix
BREAKING: <description> # Explicit breaking change

# For new features  
feat: <description>     # New feature
feature: <description>  # Alternative feature syntax
minor: <description>    # Explicit minor bump

# For patches (default)
fix: <description>      # Bug fix
docs: <description>     # Documentation
style: <description>    # Formatting, styling
refactor: <description> # Code refactoring
perf: <description>     # Performance improvement
test: <description>     # Adding tests
chore: <description>    # Maintenance tasks
```

## Examples in Practice

### Scenario 1: Bug Fix Release

```bash
# Recent commits:
git commit -m "fix: resolve popup not showing on some websites"
git commit -m "fix: correct session data parsing error"
git commit -m "docs: update troubleshooting guide"

# Result: 2.1.0 → 2.1.1 (patch bump)
# Reason: Only fixes and documentation updates
```

### Scenario 2: Feature Release

```bash
# Recent commits:
git commit -m "feat: add automatic session backup functionality"
git commit -m "fix: improve error handling in backup process"
git commit -m "docs: document new backup feature"

# Result: 2.1.0 → 2.2.0 (minor bump)
# Reason: Contains new feature (feat:)
```

### Scenario 3: Breaking Change Release

```bash
# Recent commits:
git commit -m "feat!: change settings storage format for better performance"
git commit -m "BREAKING: remove deprecated polling methods"
git commit -m "docs: update migration guide for v3.0"

# Result: 2.1.0 → 3.0.0 (major bump)
# Reason: Contains breaking changes (feat!, BREAKING:)
```

## Manual Override Options

You can override the automatic detection in several ways:

### 1. GitHub Actions Manual Trigger

1. Go to **Actions** tab in GitHub
2. Select "Release Extension" workflow
3. Click "Run workflow"
4. Choose specific version bump type:
   - `auto` - Use automatic detection (default)
   - `patch` - Force patch bump
   - `minor` - Force minor bump  
   - `major` - Force major bump

### 2. Local Version Management

```bash
# Override automatic detection locally
pnpm run version-extension patch   # Force patch: 2.1.0 → 2.1.1
pnpm run version-extension minor   # Force minor: 2.1.0 → 2.2.0
pnpm run version-extension major   # Force major: 2.1.0 → 3.0.0
```

## Detection Algorithm Details

The workflow uses this bash script logic:

```bash
# Get commits since last release
COMMITS=$(git log $LAST_TAG..HEAD --oneline -- mio-session-extractor/)

# Check for breaking changes (highest priority)
if echo "$COMMITS" | grep -iE "(BREAKING|major:|feat!:|fix!:)" >/dev/null; then
  BUMP_TYPE="major"
  
# Check for new features (medium priority)
elif echo "$COMMITS" | grep -iE "(feat:|feature:|minor:)" >/dev/null; then
  BUMP_TYPE="minor"
  
# Default to patch (lowest priority)
else
  BUMP_TYPE="patch"
fi
```

## Case Sensitivity

The pattern matching is **case-insensitive**, so these are all equivalent:

```bash
git commit -m "BREAKING: major change"
git commit -m "breaking: major change"
git commit -m "Breaking: major change"
```

## Multiple Commit Types

When multiple commit types are present, the **highest priority** wins:

```bash
# These commits together:
git commit -m "feat: add new dashboard"      # minor
git commit -m "fix: resolve login issue"    # patch  
git commit -m "BREAKING: change API format" # major

# Result: major bump (highest priority)
```

## Priority Order

1. **Major** (breaking changes) - highest priority
2. **Minor** (new features) - medium priority  
3. **Patch** (fixes/improvements) - default/lowest priority

## Tips for Developers

1. **Be explicit** - Use clear commit message prefixes
2. **Think about impact** - Consider how changes affect users
3. **Use conventional commits** - Helps with automation and changelog generation
4. **Test locally** - Use `pnpm run version-extension current` to check before pushing
5. **Review before release** - Check the generated version makes sense

## Troubleshooting

### Version Not Bumped as Expected

1. Check commit messages match the expected patterns
2. Verify commits affect files in `mio-session-extractor/` directory
3. Review GitHub Actions logs for detection output
4. Use manual override if automatic detection fails

### Unexpected Major Bump

1. Search commit messages for `BREAKING`, `feat!`, `fix!`, or `major:`
2. Consider if the change truly breaks backward compatibility
3. Use manual override to force lower version if needed

This automated system ensures consistent versioning while reducing manual overhead for releases.
