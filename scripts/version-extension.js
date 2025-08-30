#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSION_DIR = 'mio-session-extractor';
const MANIFEST_PATH = path.join(EXTENSION_DIR, 'manifest.json');

function log(message) {
    console.log(`[VERSION] ${message}`);
}

// Enhanced commit analysis patterns
const VERSION_PATTERNS = {
    major: [
        /BREAKING\s*CHANGE/i,
        /breaking:/i,
        /feat!/,
        /fix!/,
        /^major:/i,
        /^feat\([^)]*\)!:/i, // feat(scope)!: breaking change
        /^fix\([^)]*\)!:/i, // fix(scope)!: breaking change
        /API\s*change/i,
        /major\s*refactor/i,
        /remove\s*support/i,
        /drop\s*support/i,
        /incompatible/i,
    ],
    minor: [
        /^feat:/i,
        /^feat\([^)]*\):/i, // feat(scope): new feature
        /^feature:/i,
        /^feature\([^)]*\):/i, // feature(scope): new feature
        /^add:/i,
        /^add\([^)]*\):/i, // add(scope): addition
        /^new:/i,
        /^new\([^)]*\):/i, // new(scope): new feature
        /^minor:/i,
        /^minor\([^)]*\):/i, // minor(scope): minor change
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
        /^fix\([^)]*\):/i, // fix(scope): bug fix
        /^bug:/i,
        /^bug\([^)]*\):/i, // bug(scope): bug fix
        /^patch:/i,
        /^patch\([^)]*\):/i, // patch(scope): patch
        /^hotfix:/i,
        /^hotfix\([^)]*\):/i, // hotfix(scope): hotfix
        /^chore:/i,
        /^chore\([^)]*\):/i, // chore(scope): maintenance
        /^docs:/i,
        /^docs\([^)]*\):/i, // docs(scope): documentation
        /^style:/i,
        /^style\([^)]*\):/i, // style(scope): formatting
        /^refactor:/i,
        /^refactor\([^)]*\):/i, // refactor(scope): code refactoring
        /^perf:/i,
        /^perf\([^)]*\):/i, // perf(scope): performance
        /^test:/i,
        /^test\([^)]*\):/i, // test(scope): testing
        /resolve/i,
        /correct/i,
        /update/i,
        /clean/i,
        /optimize/i,
    ],
};

// File patterns that suggest different version bump types
const FILE_IMPACT_PATTERNS = {
    major: [/manifest\.json.*version/, /package\.json.*version/, /API/i, /interface/i, /schema/i],
    minor: [/\.js$/, /\.ts$/, /\.tsx$/, /component/i, /feature/i, /service/i],
    patch: [/\.md$/, /\.css$/, /config/i, /test/i, /spec/i],
};

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

function analyzeCommits(since) {
    try {
        let gitCommand = `git log --oneline -- ${EXTENSION_DIR}/`;
        if (since) {
            gitCommand = `git log ${since}..HEAD --oneline -- ${EXTENSION_DIR}/`;
        }

        const commits = execSync(gitCommand, { encoding: 'utf8' }).trim();
        if (!commits) {
            log('No commits found for extension directory');
            return { type: 'patch', reason: 'No commits found, defaulting to patch' };
        }

        const commitLines = commits.split('\n');
        log(`Analyzing ${commitLines.length} commits:`);
        commitLines.forEach((commit) => log(`  ${commit}`));

        // Analyze each commit for version bump indicators
        let maxBumpType = 'patch';
        let reasons = [];

        for (const commit of commitLines) {
            const message = commit.toLowerCase();

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
            let filesCommand = `git diff --name-only -- ${EXTENSION_DIR}/`;
            if (since) {
                filesCommand = `git diff ${since}..HEAD --name-only -- ${EXTENSION_DIR}/`;
            }

            const changedFiles = execSync(filesCommand, { encoding: 'utf8' }).trim();
            if (changedFiles) {
                const files = changedFiles.split('\n');
                log(`Changed files: ${files.join(', ')}`);

                // Analyze file impact
                for (const file of files) {
                    if (maxBumpType !== 'major') {
                        for (const pattern of FILE_IMPACT_PATTERNS.major) {
                            if (pattern.test(file)) {
                                maxBumpType = 'major';
                                reasons.push(`Major: File change "${file}" suggests major impact`);
                                break;
                            }
                        }
                    }

                    if (maxBumpType === 'patch') {
                        for (const pattern of FILE_IMPACT_PATTERNS.minor) {
                            if (pattern.test(file)) {
                                maxBumpType = 'minor';
                                reasons.push(`Minor: File change "${file}" suggests minor impact`);
                                break;
                            }
                        }
                    }
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
  auto [since]              Auto-detect version bump from commit messages
  patch                     Increment patch version (x.y.z -> x.y.z+1)
  minor                     Increment minor version (x.y.z -> x.y+1.0)
  major                     Increment major version (x.y.z -> x+1.0.0)
  analyze [since]           Analyze commits without bumping version

Options:
  --no-commit              Don't commit the version change to git
  --help, -h               Show this help message

Examples:
  node scripts/version-extension.js current
  node scripts/version-extension.js set 2.2.0
  node scripts/version-extension.js auto
  node scripts/version-extension.js auto v1.2.0
  node scripts/version-extension.js analyze
  node scripts/version-extension.js patch
  node scripts/version-extension.js minor --no-commit

Auto-detection patterns:
  Major: BREAKING CHANGE, breaking:, feat!, fix!, API changes
  Minor: feat:, feature:, add:, new:, implement, enhance
  Patch: fix:, bug:, chore:, docs:, style:, refactor:
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

if (require.main === module) {
    main();
}

module.exports = {
    getCurrentVersion,
    updateVersion,
    incrementVersion,
    validateVersion,
    analyzeCommits,
};
