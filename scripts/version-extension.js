#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSION_DIR = 'mio-session-extractor';
const MANIFEST_PATH = path.join(EXTENSION_DIR, 'manifest.json');

function log(message) {
    console.log(`[VERSION] ${message}`);
}

function getCurrentVersion() {
    if (!fs.existsSync(MANIFEST_PATH)) {
        throw new Error(`Manifest file not found: ${MANIFEST_PATH}`);
    }

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    return manifest.version;
}

function updateVersion(newVersion) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    manifest.version = newVersion;

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
    log(`Updated version to ${newVersion} in ${MANIFEST_PATH}`);
}

function parseVersion(version) {
    const parts = version.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
        throw new Error(`Invalid version format: ${version}. Expected format: x.y.z`);
    }
    return parts;
}

function incrementVersion(version, type) {
    const [major, minor, patch] = parseVersion(version);

    switch (type) {
        case 'major':
            return `${major + 1}.0.0`;
        case 'minor':
            return `${major}.${minor + 1}.0`;
        case 'patch':
            return `${major}.${minor}.${patch + 1}`;
        default:
            throw new Error(`Invalid version type: ${type}. Use 'major', 'minor', or 'patch'`);
    }
}

function validateVersion(version) {
    try {
        parseVersion(version);
        return true;
    } catch (error) {
        return false;
    }
}

function commitVersionChange(version) {
    try {
        execSync(`git add ${MANIFEST_PATH}`, { stdio: 'inherit' });
        execSync(`git commit -m "chore: bump extension version to ${version}"`, { stdio: 'inherit' });
        log(`Committed version change to git`);
    } catch (error) {
        log(`Warning: Could not commit version change: ${error.message}`);
    }
}

function showUsage() {
    console.log(`
Usage: node scripts/version-extension.js [command] [version]

Commands:
  current                    Show current version
  set <version>             Set specific version (e.g., 2.1.1)
  patch                     Increment patch version (x.y.z -> x.y.z+1)
  minor                     Increment minor version (x.y.z -> x.y+1.0)
  major                     Increment major version (x.y.z -> x+1.0.0)

Options:
  --no-commit              Don't commit the version change to git
  --help, -h               Show this help message

Examples:
  node scripts/version-extension.js current
  node scripts/version-extension.js set 2.2.0
  node scripts/version-extension.js patch
  node scripts/version-extension.js minor --no-commit
`);
}

function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const shouldCommit = !args.includes('--no-commit');

    if (!command || command === '--help' || command === '-h') {
        showUsage();
        return;
    }

    try {
        const currentVersion = getCurrentVersion();

        switch (command) {
            case 'current':
                console.log(currentVersion);
                break;

            case 'set':
                const newVersion = args[1];
                if (!newVersion) {
                    log('Error: Version required for set command');
                    showUsage();
                    process.exit(1);
                }

                if (!validateVersion(newVersion)) {
                    log(`Error: Invalid version format: ${newVersion}`);
                    process.exit(1);
                }

                updateVersion(newVersion);
                if (shouldCommit) {
                    commitVersionChange(newVersion);
                }
                break;

            case 'patch':
            case 'minor':
            case 'major':
                const incrementedVersion = incrementVersion(currentVersion, command);
                log(`Incrementing ${command} version: ${currentVersion} -> ${incrementedVersion}`);
                updateVersion(incrementedVersion);
                if (shouldCommit) {
                    commitVersionChange(incrementedVersion);
                }
                break;

            default:
                log(`Error: Unknown command: ${command}`);
                showUsage();
                process.exit(1);
        }
    } catch (error) {
        log(`Error: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    getCurrentVersion,
    updateVersion,
    incrementVersion,
    validateVersion,
};
