#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSION_DIR = 'mio-session-extractor';
const DIST_DIR = 'dist';
const PACKAGE_NAME = 'mio-session-extractor';

// Files to include in the package
const EXTENSION_FILES = [
    'manifest.json',
    'background.js',
    'content-script.js',
    'performance-worker.js',
    'popup.html',
    'popup.js',
    'settings.html',
    'settings.js',
    'settings.css',
    'settings-ui.js',
    'icons/',
    'README.md',
    'INSTALLATION_GUIDE.md',
    'SETTINGS_GUIDE.md',
];

function log(message) {
    console.log(`[PACKAGE] ${message}`);
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log(`Created directory: ${dir}`);
    }
}

function copyFile(src, dest) {
    const destDir = path.dirname(dest);
    ensureDir(destDir);

    if (fs.statSync(src).isDirectory()) {
        copyDirectory(src, dest);
    } else {
        fs.copyFileSync(src, dest);
        log(`Copied: ${src} -> ${dest}`);
    }
}

function copyDirectory(src, dest) {
    ensureDir(dest);
    const files = fs.readdirSync(src);

    for (const file of files) {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);

        if (fs.statSync(srcPath).isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
    log(`Copied directory: ${src} -> ${dest}`);
}

function getVersion() {
    const manifestPath = path.join(EXTENSION_DIR, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return manifest.version;
}

function hasExtensionChanges() {
    try {
        // Get the last commit hash for extension files
        const result = execSync(`git log -1 --format="%H" -- ${EXTENSION_DIR}/`, { encoding: 'utf8' }).trim();

        if (!result) {
            log('No commits found for extension directory');
            return false;
        }

        // Check if there are any changes since last tag
        try {
            const lastTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
            const changesSinceTag = execSync(`git diff ${lastTag}..HEAD --name-only -- ${EXTENSION_DIR}/`, {
                encoding: 'utf8',
            }).trim();

            if (changesSinceTag) {
                log(`Extension changes found since ${lastTag}:`);
                log(changesSinceTag);
                return true;
            } else {
                log(`No extension changes since last tag ${lastTag}`);
                return false;
            }
        } catch (error) {
            // No tags exist, check if there are any extension files
            log('No tags found, checking for extension files...');
            return fs.existsSync(EXTENSION_DIR);
        }
    } catch (error) {
        log(`Error checking for changes: ${error.message}`);
        return true; // Default to true if we can't determine
    }
}

function createPackage() {
    const version = getVersion();
    log(`Creating package for version ${version}`);

    // Clean and create dist directory
    if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true });
    }
    ensureDir(DIST_DIR);

    const packageDir = path.join(DIST_DIR, PACKAGE_NAME);
    ensureDir(packageDir);

    // Copy extension files
    for (const file of EXTENSION_FILES) {
        const srcPath = path.join(EXTENSION_DIR, file);
        const destPath = path.join(packageDir, file);

        if (fs.existsSync(srcPath)) {
            copyFile(srcPath, destPath);
        } else {
            log(`Warning: File not found: ${srcPath}`);
        }
    }

    // Create ZIP file
    const zipName = `${PACKAGE_NAME}-v${version}.zip`;
    const zipPath = path.join(DIST_DIR, zipName);

    try {
        execSync(`cd ${DIST_DIR} && zip -r ${zipName} ${PACKAGE_NAME}`, { stdio: 'inherit' });
        log(`Created package: ${zipPath}`);

        // Create latest.zip symlink/copy
        const latestPath = path.join(DIST_DIR, `${PACKAGE_NAME}-latest.zip`);
        if (fs.existsSync(latestPath)) {
            fs.unlinkSync(latestPath);
        }
        fs.copyFileSync(zipPath, latestPath);
        log(`Created latest package: ${latestPath}`);

        return {
            version,
            zipPath,
            latestPath,
            packageDir,
        };
    } catch (error) {
        log(`Error creating ZIP: ${error.message}`);
        throw error;
    }
}

function generateReleaseNotes() {
    try {
        const lastTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
        const commits = execSync(`git log ${lastTag}..HEAD --oneline -- ${EXTENSION_DIR}/`, {
            encoding: 'utf8',
        }).trim();

        if (!commits) {
            return 'No changes in extension files since last release.';
        }

        const lines = commits.split('\n').map((line) => `- ${line}`);
        return `## Changes\n\n${lines.join('\n')}`;
    } catch (error) {
        // No previous tags
        return '## Initial Release\n\nFirst packaged release of the Multi-Platform Session Extractor extension.';
    }
}

function main() {
    log('Starting extension packaging...');

    // Check if extension directory exists
    if (!fs.existsSync(EXTENSION_DIR)) {
        log(`Error: Extension directory ${EXTENSION_DIR} not found`);
        process.exit(1);
    }

    // Check for extension changes
    if (process.env.GITHUB_ACTIONS && !hasExtensionChanges()) {
        log('No extension changes detected. Skipping package creation.');
        process.exit(0);
    }

    try {
        const result = createPackage();
        const releaseNotes = generateReleaseNotes();

        // Output for GitHub Actions
        if (process.env.GITHUB_ACTIONS) {
            console.log(`::set-output name=version::${result.version}`);
            console.log(`::set-output name=zip_path::${result.zipPath}`);
            console.log(`::set-output name=latest_path::${result.latestPath}`);
            console.log(`::set-output name=package_created::true`);

            // Write release notes to file
            fs.writeFileSync('release-notes.md', releaseNotes);
            console.log(`::set-output name=release_notes::release-notes.md`);
        }

        log('Packaging completed successfully!');
        log(`Version: ${result.version}`);
        log(`Package: ${result.zipPath}`);
    } catch (error) {
        log(`Error: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { createPackage, hasExtensionChanges, getVersion };
