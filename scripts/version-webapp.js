#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKAGE_JSON_PATH = path.join(process.cwd(), 'package.json');

function log(message) {
    console.log(`[VERSION-WEBAPP] ${message}`);
}

// Enhanced commit analysis patterns
const VERSION_PATTERNS = {
    major: [
        /BREAKING\s*CHANGE/i,
        /breaking:/i,
        /feat!/,
        /fix!/,
        /^major:/i,
        /^feat\([^)]*\)!:/i,
        /^fix\([^)]*\)!:/i,
        /API\s*change/i,
        /major\s*refactor/i,
        /remove\s*support/i,
        /drop\s*support/i,
        /incompatible/i,
    ],
    minor: [
        /^feat:/i,
        /^feat\([^)]*\):/i,
        /^feature:/i,
        /^feature\([^)]*\):/i,
        /^add:/i,
        /^add\([^)]*\):/i,
        /^new:/i,
        /^new\([^)]*\):/i,
        /^minor:/i,
        /^minor\([^)]*\):/i,
        /add\s+support/i,
        /new\s+feature/i,
        /implement/i,
        /introduce/i,
        /enhance/i,
        /improvement/i,
        /upgrade/i,
    ],
    patch: [
        /^fix:/i,
        /^fix\([^)]*\):/i,
        /^bug:/i,
        /^bug\([^)]*\):/i,
        /^patch:/i,
        /^patch\([^)]*\):/i,
        /^hotfix:/i,
        /^hotfix\([^)]*\):/i,
        /^chore:/i,
        /^chore\([^)]*\):/i,
        /^docs:/i,
        /^docs\([^)]*\):/i,
        /^style:/i,
        /^style\([^)]*\):/i,
        /^refactor:/i,
        /^refactor\([^)]*\):/i,
        /^perf:/i,
        /^perf\([^)]*\):/i,
        /^test:/i,
        /^test\([^)]*\):/i,
        /resolve/i,
        /correct/i,
        /update/i,
        /clean/i,
        /optimize/i,
    ],
};

// Directories to exclude from version bump analysis
const EXCLUDED_DIRS = ['mio-session-extractor', 'scripts', 'dist'];

function getCurrentVersion() {
    if (!fs.existsSync(PACKAGE_JSON_PATH)) {
        throw new Error(`package.json not found: ${PACKAGE_JSON_PATH}`);
    }

    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    return packageJson.version;
}

function updateVersion(newVersion) {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    packageJson.version = newVersion;

    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n');
    log(`Updated version to ${newVersion} in package.json`);
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

function buildExcludePattern() {
    // Exclude extension directory and other non-webapp directories
    return EXCLUDED_DIRS.map((dir) => `':(exclude)${dir}/*'`).join(' ');
}

function analyzeCommits(since) {
    try {
        const excludePattern = buildExcludePattern();
        let gitCommand = `git log --oneline -- . ${excludePattern}`;
        if (since) {
            gitCommand = `git log ${since}..HEAD --oneline -- . ${excludePattern}`;
        }

        const commits = execSync(gitCommand, { encoding: 'utf8' }).trim();
        if (!commits) {
            log('No commits found for webapp');
            return { type: 'patch', reason: 'No commits found, defaulting to patch' };
        }

        const commitLines = commits.split('\n');
        log(`Analyzing ${commitLines.length} commits for webapp:`);
        commitLines.forEach((commit) => log(`  ${commit}`));

        // Analyze each commit for version bump indicators
        let maxBumpType = 'patch';
        let reasons = [];

        for (const commit of commitLines) {
            // Check for major version indicators
            for (const pattern of VERSION_PATTERNS.major) {
                if (pattern.test(commit)) {
                    maxBumpType = 'major';
                    reasons.push(`Major: "${commit.substring(0, 60)}..." matches ${pattern}`);
                    break;
                }
            }

            // Only check minor if we haven't found major
            if (maxBumpType !== 'major') {
                for (const pattern of VERSION_PATTERNS.minor) {
                    if (pattern.test(commit)) {
                        maxBumpType = 'minor';
                        reasons.push(`Minor: "${commit.substring(0, 60)}..." matches ${pattern}`);
                        break;
                    }
                }
            }

            // Track patch reasons for transparency
            if (maxBumpType === 'patch') {
                for (const pattern of VERSION_PATTERNS.patch) {
                    if (pattern.test(commit)) {
                        reasons.push(`Patch: "${commit.substring(0, 60)}..." matches ${pattern}`);
                        break;
                    }
                }
            }
        }

        // Analyze file changes for additional context
        try {
            let filesCommand = `git diff --name-only -- . ${excludePattern}`;
            if (since) {
                filesCommand = `git diff ${since}..HEAD --name-only -- . ${excludePattern}`;
            }

            const changedFiles = execSync(filesCommand, { encoding: 'utf8' }).trim();
            if (changedFiles) {
                const files = changedFiles.split('\n');
                log(`Changed files: ${files.join(', ')}`);

                // Check for API route changes (suggest minor bump)
                const apiChanges = files.some((f) => f.includes('/api/') || f.includes('src/app/api/'));
                if (apiChanges && maxBumpType === 'patch') {
                    maxBumpType = 'minor';
                    reasons.push('Minor: API route changes detected');
                }

                // Check for component changes (suggest patch for bug fixes, minor for new features)
                const componentChanges = files.some(
                    (f) => f.includes('/components/') || f.includes('src/components/')
                );
                if (componentChanges && maxBumpType === 'patch') {
                    reasons.push('Patch: Component changes detected');
                }
            }
        } catch (error) {
            log(`Warning: Could not analyze file changes: ${error.message}`);
        }

        const finalReason = reasons.length > 0 ? reasons.join('; ') : 'Default patch bump';
        log(`Analysis result: ${maxBumpType} (${finalReason})`);

        return { type: maxBumpType, reason: finalReason, commits: commitLines.length };
    } catch (error) {
        log(`Warning: Could not analyze commits: ${error.message}`);
        return { type: 'patch', reason: `Error analyzing commits: ${error.message}` };
    }
}

function commitVersionChange(version) {
    try {
        execSync(`git add ${PACKAGE_JSON_PATH}`, { stdio: 'inherit' });
        execSync(`git commit -m "chore: bump webapp version to ${version} [skip ci]"`, {
            stdio: 'inherit',
        });
        log(`Committed version change to git`);
    } catch (error) {
        log(`Warning: Could not commit version change: ${error.message}`);
    }
}

function showUsage() {
    console.log(`
Usage: node scripts/version-webapp.js [command] [version]

Commands:
  current                    Show current version
  set <version>             Set specific version (e.g., 2.1.1)
  auto [since]              Auto-detect version bump from commit messages
  patch                     Increment patch version (x.y.z -> x.y.z+1)
  minor                     Increment minor version (x.y.z -> x.y+1.0)
  major                     Increment major version (x.y.z -> x+1.0.0)
  analyze [since]           Analyze commits without bumping version

Options:
  --no-commit              Don't commit the version change to git
  --help, -h               Show this help message

Examples:
  node scripts/version-webapp.js current
  node scripts/version-webapp.js set 1.2.0
  node scripts/version-webapp.js auto
  node scripts/version-webapp.js auto v0.1.0
  node scripts/version-webapp.js analyze
  node scripts/version-webapp.js patch
  node scripts/version-webapp.js minor --no-commit

Auto-detection patterns:
  Major: BREAKING CHANGE, breaking:, feat!, fix!, API changes
  Minor: feat:, feature:, add:, new:, implement, enhance
  Patch: fix:, bug:, chore:, docs:, style:, refactor:

Note: This script excludes the ${EXCLUDED_DIRS.join(', ')} directories from analysis
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

            case 'auto':
                const since = args[1]; // Optional since parameter
                const analysis = analyzeCommits(since);
                const autoVersion = incrementVersion(currentVersion, analysis.type);
                log(`Auto-detected ${analysis.type} bump: ${currentVersion} -> ${autoVersion}`);
                log(`Reason: ${analysis.reason}`);
                updateVersion(autoVersion);
                if (shouldCommit) {
                    commitVersionChange(autoVersion);
                }
                break;

            case 'analyze':
                const analyzeSince = args[1]; // Optional since parameter
                const result = analyzeCommits(analyzeSince);
                log(`Recommended version bump: ${result.type}`);
                log(`Current version: ${currentVersion}`);
                log(`Suggested version: ${incrementVersion(currentVersion, result.type)}`);
                log(`Analysis: ${result.reason}`);
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

// ES module equivalent of require.main === module
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { getCurrentVersion, updateVersion, incrementVersion, validateVersion, analyzeCommits };
