#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOOKS_SOURCE_DIR = path.join(__dirname, 'hooks');
const GIT_HOOKS_DIR = path.join(process.cwd(), '.git', 'hooks');

function log(message) {
    console.log(`[SETUP-HOOKS] ${message}`);
}

function logSuccess(message) {
    console.log(`\x1b[32m[SETUP-HOOKS]\x1b[0m ${message}`);
}

function logError(message) {
    console.log(`\x1b[31m[SETUP-HOOKS]\x1b[0m ${message}`);
}

function checkGitRepo() {
    if (!fs.existsSync(path.join(process.cwd(), '.git'))) {
        logError('Not a git repository. Please run this from the root of a git repository.');
        process.exit(1);
    }
}

function installHook(hookName) {
    const sourcePath = path.join(HOOKS_SOURCE_DIR, hookName);
    const targetPath = path.join(GIT_HOOKS_DIR, hookName);

    if (!fs.existsSync(sourcePath)) {
        logError(`Hook source not found: ${sourcePath}`);
        return false;
    }

    // Check if hook already exists
    if (fs.existsSync(targetPath)) {
        // Backup existing hook
        const backupPath = `${targetPath}.backup-${Date.now()}`;
        log(`Backing up existing ${hookName} to ${path.basename(backupPath)}`);
        fs.copyFileSync(targetPath, backupPath);
    }

    // Copy hook
    fs.copyFileSync(sourcePath, targetPath);

    // Make executable
    fs.chmodSync(targetPath, 0o755);

    logSuccess(`Installed ${hookName} hook`);
    return true;
}

function uninstallHook(hookName) {
    const targetPath = path.join(GIT_HOOKS_DIR, hookName);

    if (!fs.existsSync(targetPath)) {
        log(`Hook ${hookName} not installed, skipping`);
        return;
    }

    // Check if it's our hook by comparing content
    const targetContent = fs.readFileSync(targetPath, 'utf8');
    if (targetContent.includes('[PRE-PUSH]')) {
        fs.unlinkSync(targetPath);
        logSuccess(`Uninstalled ${hookName} hook`);

        // Restore backup if exists
        const backups = fs
            .readdirSync(GIT_HOOKS_DIR)
            .filter((f) => f.startsWith(`${hookName}.backup-`))
            .sort()
            .reverse();

        if (backups.length > 0) {
            const latestBackup = path.join(GIT_HOOKS_DIR, backups[0]);
            fs.copyFileSync(latestBackup, targetPath);
            fs.chmodSync(targetPath, 0o755);
            log(`Restored backup: ${backups[0]}`);
        }
    } else {
        log(`${hookName} exists but is not managed by this script, skipping`);
    }
}

function listHooks() {
    log('Available hooks:');
    const hooks = fs.readdirSync(HOOKS_SOURCE_DIR);

    for (const hook of hooks) {
        const targetPath = path.join(GIT_HOOKS_DIR, hook);
        const installed = fs.existsSync(targetPath);
        const status = installed ? '\x1b[32m✓ installed\x1b[0m' : '\x1b[33m○ not installed\x1b[0m';
        console.log(`  ${hook.padEnd(20)} ${status}`);
    }
}

function showUsage() {
    console.log(`
Usage: node scripts/setup-hooks.js [command]

Commands:
  install              Install all git hooks
  uninstall            Uninstall all git hooks
  list                 List available hooks and their status
  help, -h, --help     Show this help message

Examples:
  node scripts/setup-hooks.js install
  node scripts/setup-hooks.js list
  pnpm run setup-hooks install

What the hooks do:
  pre-push: Automatically version bump webapp and/or extension based on
            changes being pushed to main branch. Analyzes commit messages
            and file changes to determine the appropriate version bump.
`);
}

function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'install';

    if (command === 'help' || command === '-h' || command === '--help') {
        showUsage();
        return;
    }

    checkGitRepo();

    switch (command) {
        case 'install':
            log('Installing git hooks...');
            const hooks = fs.readdirSync(HOOKS_SOURCE_DIR);
            let installed = 0;

            for (const hook of hooks) {
                if (installHook(hook)) {
                    installed++;
                }
            }

            logSuccess(`Installed ${installed} hook(s)`);
            log('\nThe pre-push hook will:');
            log('  • Auto-version webapp when pushing to main (if changes detected)');
            log('  • Auto-version extension when pushing to main (if changes detected)');
            log('  • Amend your commit with the version bump automatically');
            log('\nYou can disable this by running: pnpm run setup-hooks uninstall');
            break;

        case 'uninstall':
            log('Uninstalling git hooks...');
            const allHooks = fs.readdirSync(HOOKS_SOURCE_DIR);

            for (const hook of allHooks) {
                uninstallHook(hook);
            }

            logSuccess('Git hooks uninstalled');
            break;

        case 'list':
            listHooks();
            break;

        default:
            logError(`Unknown command: ${command}`);
            showUsage();
            process.exit(1);
    }
}

// ES module equivalent of require.main === module
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { installHook, uninstallHook, listHooks };
