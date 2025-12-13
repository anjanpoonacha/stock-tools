#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKAGE_JSON_PATH = path.join(process.cwd(), 'package.json');
const DIST_DIR = 'dist-webapp';
const NEXT_BUILD_DIR = '.next';

// Directories to exclude from webapp analysis
const EXCLUDED_DIRS = ['mio-session-extractor', 'scripts', 'dist'];

function log(message) {
    console.log(`[PACKAGE-WEBAPP] ${message}`);
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log(`Created directory: ${dir}`);
    }
}

function getVersion() {
    if (!fs.existsSync(PACKAGE_JSON_PATH)) {
        throw new Error(`package.json not found: ${PACKAGE_JSON_PATH}`);
    }

    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    return packageJson.version;
}

function buildExcludePattern() {
    return EXCLUDED_DIRS.map((dir) => `':(exclude)${dir}/*'`).join(' ');
}

function hasWebappChanges() {
    try {
        const excludePattern = buildExcludePattern();
        // Get the last commit hash for webapp files (excluding extension directory)
        const result = execSync(`git log -1 --format="%H" -- . ${excludePattern}`, {
            encoding: 'utf8',
        }).trim();

        if (!result) {
            log('No commits found for webapp');
            return false;
        }

        // Check if there are any changes since last tag
        try {
            const lastTag = execSync('git describe --tags --abbrev=0 --match "webapp-v*"', {
                encoding: 'utf8',
            }).trim();
            const changesSinceTag = execSync(
                `git diff ${lastTag}..HEAD --name-only -- . ${excludePattern}`,
                {
                    encoding: 'utf8',
                }
            ).trim();

            if (changesSinceTag) {
                log(`Webapp changes found since ${lastTag}:`);
                log(changesSinceTag);
                return true;
            } else {
                log(`No webapp changes since last tag ${lastTag}`);
                return false;
            }
        } catch (error) {
            // No tags exist or no matching tags, check if there are any webapp files
            log('No webapp tags found, checking for webapp changes...');
            return true;
        }
    } catch (error) {
        log(`Error checking for changes: ${error.message}`);
        return true; // Default to true if we can't determine
    }
}

function runBuild() {
    log('Running Next.js build...');
    try {
        execSync('pnpm run build', { stdio: 'inherit' });
        log('Build completed successfully');
        return true;
    } catch (error) {
        log(`Build failed: ${error.message}`);
        throw error;
    }
}

function createPackage() {
    const version = getVersion();
    log(`Creating webapp package for version ${version}`);

    // Run the build first
    runBuild();

    // Clean and create dist directory
    if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true });
    }
    ensureDir(DIST_DIR);

    // Files and directories to include in the package
    const filesToCopy = [
        '.next',
        'public',
        'package.json',
        'pnpm-lock.yaml',
        'next.config.ts',
        '.env.production',
        'README.md',
    ];

    // Copy necessary files
    for (const file of filesToCopy) {
        const srcPath = path.join(process.cwd(), file);
        const destPath = path.join(DIST_DIR, file);

        if (fs.existsSync(srcPath)) {
            copyPath(srcPath, destPath);
        } else if (file !== '.env.production') {
            // .env.production is optional
            log(`Warning: File not found (skipping): ${srcPath}`);
        }
    }

    // Create a deployment info file
    const deploymentInfo = {
        version,
        buildDate: new Date().toISOString(),
        nextVersion: getNextVersion(),
        nodeVersion: process.version,
        environment: 'production',
    };

    fs.writeFileSync(
        path.join(DIST_DIR, 'deployment-info.json'),
        JSON.stringify(deploymentInfo, null, 2)
    );
    log('Created deployment-info.json');

    // Create a minimal package.json for deployment
    createDeploymentPackageJson(version);

    // Create tarball
    const tarballName = `webapp-v${version}.tar.gz`;
    const tarballPath = path.join(DIST_DIR, tarballName);

    try {
        execSync(`cd ${DIST_DIR} && tar -czf ${tarballName} .`, { stdio: 'inherit' });
        log(`Created package: ${tarballPath}`);

        // Create latest tarball
        const latestPath = path.join(DIST_DIR, 'webapp-latest.tar.gz');
        if (fs.existsSync(latestPath)) {
            fs.unlinkSync(latestPath);
        }
        fs.copyFileSync(tarballPath, latestPath);
        log(`Created latest package: ${latestPath}`);

        return {
            version,
            tarballPath,
            latestPath,
            distDir: DIST_DIR,
        };
    } catch (error) {
        log(`Error creating tarball: ${error.message}`);
        throw error;
    }
}

function copyPath(src, dest) {
    const stat = fs.statSync(src);

    if (stat.isDirectory()) {
        copyDirectory(src, dest);
    } else {
        const destDir = path.dirname(dest);
        ensureDir(destDir);
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

function getNextVersion() {
    try {
        const nextPackageJson = path.join(process.cwd(), 'node_modules', 'next', 'package.json');
        if (fs.existsSync(nextPackageJson)) {
            const pkg = JSON.parse(fs.readFileSync(nextPackageJson, 'utf8'));
            return pkg.version;
        }
    } catch (error) {
        log(`Warning: Could not determine Next.js version: ${error.message}`);
    }
    return 'unknown';
}

function createDeploymentPackageJson(version) {
    const originalPkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));

    const deploymentPkg = {
        name: originalPkg.name,
        version: version,
        private: true,
        type: 'module',
        scripts: {
            start: 'next start',
        },
        dependencies: originalPkg.dependencies,
        engines: {
            node: '>=18.0.0',
            pnpm: '>=8.0.0',
        },
    };

    fs.writeFileSync(
        path.join(DIST_DIR, 'package.json'),
        JSON.stringify(deploymentPkg, null, 2) + '\n'
    );
    log('Created deployment package.json');
}

function generateReleaseNotes() {
    try {
        const excludePattern = buildExcludePattern();
        const lastTag = execSync('git describe --tags --abbrev=0 --match "webapp-v*"', {
            encoding: 'utf8',
        }).trim();
        const commits = execSync(
            `git log ${lastTag}..HEAD --oneline -- . ${excludePattern}`,
            {
                encoding: 'utf8',
            }
        ).trim();

        if (!commits) {
            return 'No changes in webapp since last release.';
        }

        const lines = commits.split('\n').map((line) => `- ${line}`);
        return `## Changes\n\n${lines.join('\n')}`;
    } catch (error) {
        // No previous tags
        return '## Initial Release\n\nFirst packaged release of the webapp.';
    }
}

function showUsage() {
    console.log(`
Usage: node scripts/package-webapp.js [options]

Options:
  --skip-build             Skip the build step (use existing .next directory)
  --help, -h              Show this help message

Examples:
  node scripts/package-webapp.js
  node scripts/package-webapp.js --skip-build

This script will:
  1. Run 'pnpm run build' to create the Next.js production build
  2. Copy necessary files to ${DIST_DIR}/
  3. Create a deployment-ready tarball
  4. Generate release notes from git commits

Note: This script excludes ${EXCLUDED_DIRS.join(', ')} from analysis
`);
}

function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        showUsage();
        return;
    }

    log('Starting webapp packaging...');

    // Check if package.json exists
    if (!fs.existsSync(PACKAGE_JSON_PATH)) {
        log('Error: package.json not found');
        process.exit(1);
    }

    // Check for webapp changes (only in CI)
    if (process.env.GITHUB_ACTIONS && !hasWebappChanges()) {
        log('No webapp changes detected. Skipping package creation.');
        process.exit(0);
    }

    try {
        const result = createPackage();
        const releaseNotes = generateReleaseNotes();

        // Output for GitHub Actions
        if (process.env.GITHUB_ACTIONS) {
            console.log(`::set-output name=version::${result.version}`);
            console.log(`::set-output name=tarball_path::${result.tarballPath}`);
            console.log(`::set-output name=latest_path::${result.latestPath}`);
            console.log(`::set-output name=package_created::true`);

            // Write release notes to file
            fs.writeFileSync('release-notes-webapp.md', releaseNotes);
            console.log(`::set-output name=release_notes::release-notes-webapp.md`);
        }

        log('Packaging completed successfully!');
        log(`Version: ${result.version}`);
        log(`Package: ${result.tarballPath}`);
        log(`\nTo deploy this package:`);
        log(`  1. Extract: tar -xzf ${path.basename(result.tarballPath)}`);
        log(`  2. Install: pnpm install --prod`);
        log(`  3. Start: pnpm start`);
    } catch (error) {
        log(`Error: ${error.message}`);
        process.exit(1);
    }
}

// ES module equivalent of require.main === module
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { createPackage, hasWebappChanges, getVersion, runBuild };
