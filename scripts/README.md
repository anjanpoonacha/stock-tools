# Extension Build Scripts

This directory contains scripts for managing and packaging the Multi-Platform Session Extractor extension.

## Scripts

### `package-extension.js`

Creates a distributable ZIP package of the extension.

**Usage:**

```bash
node scripts/package-extension.js
# or
pnpm run package-extension
```

**Features:**

- Copies all necessary extension files to `dist/` directory
- Creates versioned ZIP file (`mio-session-extractor-v{version}.zip`)
- Creates latest ZIP file (`mio-session-extractor-latest.zip`)
- Detects changes since last release (in CI environment)
- Generates release notes automatically

### `version-extension.js`

Manages extension version in `manifest.json`.

**Usage:**

```bash
# Show current version
node scripts/version-extension.js current

# Set specific version
node scripts/version-extension.js set 2.2.0

# Increment versions
node scripts/version-extension.js patch    # 2.1.0 -> 2.1.1
node scripts/version-extension.js minor    # 2.1.0 -> 2.2.0
node scripts/version-extension.js major    # 2.1.0 -> 3.0.0

# Don't commit to git
node scripts/version-extension.js patch --no-commit
```

**Features:**

- Validates semantic version format (x.y.z)
- Automatically commits version changes to git
- Supports all semantic versioning increment types
- Option to skip git operations

## Package Contents

The extension package includes these files:

- `manifest.json` - Extension manifest
- `background.js` - Service worker
- `content-script.js` - Content script
- `performance-worker.js` - Performance worker
- `popup.html` & `popup.js` - Extension popup
- `settings.html`, `settings.js`, `settings.css`, `settings-ui.js` - Settings page
- `icons/` - Extension icons
- `README.md`, `INSTALLATION_GUIDE.md`, `SETTINGS_GUIDE.md` - Documentation

## CI/CD Integration

These scripts are designed to work with GitHub Actions:

- **Change Detection**: Only packages when extension files have changed
- **Version Validation**: Prevents duplicate releases
- **Automatic Release**: Creates GitHub releases with proper assets
- **Release Notes**: Auto-generates changelog from git commits

## Requirements

- Node.js (for running scripts)
- `zip` command (for creating packages)
- Git (for version management and change detection)

## Output

Packaging creates:

```
dist/
├── mio-session-extractor/              # Unpacked extension
├── mio-session-extractor-v{version}.zip # Versioned package
└── mio-session-extractor-latest.zip    # Latest package
```

## Error Handling

Scripts include comprehensive error handling:

- File existence validation
- Version format validation
- Git operation error handling
- Detailed logging for debugging

For more information, see the [Extension Release Guide](../docs/EXTENSION_RELEASE_GUIDE.md).
