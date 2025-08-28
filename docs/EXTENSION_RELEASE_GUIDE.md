# Extension Release Guide

This guide explains how to package and release the Multi-Platform Session Extractor extension.

## Overview

The extension packaging and release system is fully automated using GitHub Actions. It only creates releases when there are actual changes to the extension files.

## Quick Start

### 1. Package Extension Locally (Optional)

```bash
# Package the extension for testing
pnpm run package-extension

# Check current version
pnpm run version-extension current

# Increment version (patch/minor/major)
pnpm run version-extension patch
```

### 2. Automatic Release Process

The release process is triggered automatically when:

- Changes are pushed to the `main` or `master` branch
- Files in the `mio-session-extractor/` directory are modified
- The version in `manifest.json` hasn't been released yet

## Manual Release Process

### Step 1: Update Extension Version

```bash
# Check current version
pnpm run version-extension current

# Increment version (choose one)
pnpm run version-extension patch    # 2.1.0 -> 2.1.1
pnpm run version-extension minor    # 2.1.0 -> 2.2.0  
pnpm run version-extension major    # 2.1.0 -> 3.0.0

# Or set specific version
pnpm run version-extension set 2.2.0
```

### Step 2: Test Package Creation

```bash
# Create package locally to test
pnpm run package-extension
```

This creates:

- `dist/mio-session-extractor-v{version}.zip` - Versioned package
- `dist/mio-session-extractor-latest.zip` - Latest package
- `dist/mio-session-extractor/` - Unpacked extension files

### Step 3: Commit and Push

```bash
# Commit your extension changes
git add mio-session-extractor/
git commit -m "feat: add new extension feature"

# Push to trigger release
git push origin main
```

### Step 4: Monitor Release

1. Go to the **Actions** tab in your GitHub repository
2. Watch the "Release Extension" workflow
3. If successful, check the **Releases** section for the new release

## Force Release

To force a release even when no changes are detected:

1. Go to **Actions** tab in GitHub
2. Click "Release Extension" workflow
3. Click "Run workflow"
4. Check "Force release even if no changes detected"
5. Click "Run workflow"

## Version Management

### Version Commands

```bash
# Show current version
pnpm run version-extension current

# Set specific version
pnpm run version-extension set 2.2.0

# Increment versions
pnpm run version-extension patch    # Bug fixes
pnpm run version-extension minor    # New features
pnpm run version-extension major    # Breaking changes

# Don't commit version change to git
pnpm run version-extension patch --no-commit
```

### Version Format

The extension uses semantic versioning (semver): `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes or major feature overhauls
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, small improvements

## Release Workflow Details

### Automatic Checks

The GitHub Action performs these checks:

1. **Change Detection**: Only releases if extension files changed since last tag
2. **Version Validation**: Ensures version format is valid (x.y.z)
3. **Duplicate Prevention**: Skips release if version tag already exists
4. **File Validation**: Verifies all required extension files exist

### Release Assets

Each release includes:

- `mio-session-extractor-v{version}.zip` - Versioned extension package
- `mio-session-extractor-latest.zip` - Always points to latest version
- Detailed release notes with changes since last version
- Installation instructions

### Release Notes

Release notes are automatically generated and include:

- Changes since last release (from git commits)
- Installation instructions
- Feature highlights
- Direct download links

## Installation Instructions for Users

### Chrome/Edge Installation

1. Download the latest `mio-session-extractor-v{version}.zip` from [Releases](../../releases)
2. Extract the ZIP file to a folder
3. Open Chrome/Edge and go to `chrome://extensions/` or `edge://extensions/`
4. Enable "Developer mode" (toggle in top right)
5. Click "Load unpacked" and select the extracted folder
6. The extension should now appear in your extensions list

### Firefox Installation (Developer Mode)

1. Download and extract the extension
2. Open Firefox and go to `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` file from the extracted folder

## Troubleshooting

### Release Not Created

**Problem**: Pushed changes but no release was created

**Solutions**:

1. Check if extension files were actually modified
2. Verify the version in `manifest.json` hasn't been released before
3. Check GitHub Actions logs for errors
4. Use force release option if needed

### Package Creation Failed

**Problem**: Local packaging fails

**Solutions**:

1. Ensure `zip` command is available on your system
2. Check that all extension files exist
3. Verify file permissions on the extension directory
4. Run `pnpm run package-extension` to see detailed error logs

### Version Update Failed

**Problem**: Version command fails

**Solutions**:

1. Check that `mio-session-extractor/manifest.json` exists
2. Verify the manifest.json has valid JSON syntax
3. Ensure you have write permissions to the file
4. Use `--no-commit` flag if git operations fail

## File Structure

```
mio-session-extractor/
├── manifest.json           # Extension manifest (contains version)
├── background.js          # Service worker
├── content-script.js      # Content script
├── performance-worker.js  # Performance worker
├── popup.html            # Extension popup
├── popup.js              # Popup logic
├── settings.html         # Settings page
├── settings.js           # Settings logic
├── settings.css          # Settings styles
├── settings-ui.js        # Settings UI components
├── icons/                # Extension icons
├── README.md             # Extension documentation
├── INSTALLATION_GUIDE.md # Installation instructions
└── SETTINGS_GUIDE.md     # Settings documentation

scripts/
├── package-extension.js   # Packaging script
└── version-extension.js   # Version management script

.github/workflows/
└── release-extension.yml  # GitHub Actions workflow
```

## Advanced Usage

### Custom Package Files

To modify which files are included in the package, edit the `EXTENSION_FILES` array in `scripts/package-extension.js`:

```javascript
const EXTENSION_FILES = [
    'manifest.json',
    'background.js',
    // Add or remove files as needed
];
```

### Custom Release Notes

The release notes are auto-generated, but you can customize the template in `.github/workflows/release-extension.yml` in the "Generate release notes" step.

### Development Workflow

1. Make changes to extension files
2. Test locally by loading unpacked extension
3. Update version: `pnpm run version-extension patch`
4. Package locally: `pnpm run package-extension`
5. Test the packaged version
6. Commit and push to trigger release

## Security Notes

- The GitHub Action uses `GITHUB_TOKEN` which is automatically provided
- No additional secrets or tokens are required
- All operations are performed in the GitHub Actions environment
- Package creation is deterministic and reproducible

## Support

If you encounter issues with the release process:

1. Check the GitHub Actions logs for detailed error messages
2. Verify all required files exist in the extension directory
3. Ensure the manifest.json is valid JSON with a proper version field
4. Test packaging locally before pushing to GitHub

For extension-specific issues, refer to the extension's own documentation in the `mio-session-extractor/` directory.
