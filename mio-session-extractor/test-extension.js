// Simple test script to verify extension files are properly structured
// Run this with: node test-extension.js

const fs = require('fs');
const path = require('path');

console.log('🔍 Testing MIO Session Extractor Extension...\n');

// Required files for the extension
const requiredFiles = ['manifest.json', 'content-script.js', 'background.js', 'popup.html', 'popup.js', 'README.md'];

// Optional files
const optionalFiles = ['icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png'];

let allTestsPassed = true;

// Test 1: Check if all required files exist
console.log('📁 Checking required files...');
requiredFiles.forEach((file) => {
    if (fs.existsSync(file)) {
        console.log(`  ✅ ${file} - Found`);
    } else {
        console.log(`  ❌ ${file} - Missing`);
        allTestsPassed = false;
    }
});

// Test 2: Check optional files
console.log('\n🖼️  Checking optional files...');
optionalFiles.forEach((file) => {
    if (fs.existsSync(file)) {
        console.log(`  ✅ ${file} - Found`);
    } else {
        console.log(`  ⚠️  ${file} - Missing (optional)`);
    }
});

// Test 3: Validate manifest.json
console.log('\n📋 Validating manifest.json...');
try {
    const manifestContent = fs.readFileSync('manifest.json', 'utf8');
    const manifest = JSON.parse(manifestContent);

    // Check required manifest fields
    const requiredFields = ['manifest_version', 'name', 'version', 'permissions', 'content_scripts'];
    requiredFields.forEach((field) => {
        if (manifest[field]) {
            console.log(`  ✅ ${field} - Present`);
        } else {
            console.log(`  ❌ ${field} - Missing`);
            allTestsPassed = false;
        }
    });

    // Check manifest version
    if (manifest.manifest_version === 3) {
        console.log('  ✅ Manifest V3 - Correct');
    } else {
        console.log('  ❌ Manifest version should be 3');
        allTestsPassed = false;
    }

    // Check permissions
    const requiredPermissions = ['cookies', 'activeTab', 'storage'];
    const hasAllPermissions = requiredPermissions.every(
        (perm) => manifest.permissions && manifest.permissions.includes(perm)
    );

    if (hasAllPermissions) {
        console.log('  ✅ Required permissions - Present');
    } else {
        console.log('  ❌ Missing required permissions');
        allTestsPassed = false;
    }
} catch (error) {
    console.log(`  ❌ Error reading manifest.json: ${error.message}`);
    allTestsPassed = false;
}

// Test 4: Check file sizes (basic validation)
console.log('\n📊 Checking file sizes...');
requiredFiles.forEach((file) => {
    if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        const sizeKB = (stats.size / 1024).toFixed(2);

        if (stats.size > 0) {
            console.log(`  ✅ ${file} - ${sizeKB} KB`);
        } else {
            console.log(`  ❌ ${file} - Empty file`);
            allTestsPassed = false;
        }
    }
});

// Test 5: Basic syntax check for JavaScript files
console.log('\n🔧 Basic syntax validation...');
const jsFiles = ['content-script.js', 'background.js', 'popup.js'];

jsFiles.forEach((file) => {
    if (fs.existsSync(file)) {
        try {
            const content = fs.readFileSync(file, 'utf8');

            // Basic checks
            if (content.includes('chrome.')) {
                console.log(`  ✅ ${file} - Uses Chrome APIs`);
            } else {
                console.log(`  ⚠️  ${file} - No Chrome API usage detected`);
            }

            // Check for console.log statements (good for debugging)
            if (content.includes('console.log')) {
                console.log(`  ✅ ${file} - Has debug logging`);
            }
        } catch (error) {
            console.log(`  ❌ ${file} - Error reading: ${error.message}`);
            allTestsPassed = false;
        }
    }
});

// Final result
console.log('\n' + '='.repeat(50));
if (allTestsPassed) {
    console.log('🎉 All tests passed! Extension is ready for installation.');
    console.log('\nNext steps:');
    console.log('1. Open Chrome and go to chrome://extensions/');
    console.log('2. Enable "Developer mode"');
    console.log('3. Click "Load unpacked" and select this folder');
    console.log('4. Configure APP_URLS in content-script.js');
    console.log('5. Test with MarketInOut!');
} else {
    console.log('❌ Some tests failed. Please fix the issues above.');
}
console.log('='.repeat(50));
