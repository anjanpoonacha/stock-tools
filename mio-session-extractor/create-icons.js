// Simple script to create basic PNG icons for the extension
// This creates simple colored squares as placeholders

const fs = require('fs');

// Create a simple SVG that we can convert to PNG
function createSVGIcon(size, color = '#1a73e8') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${color}" rx="4"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${Math.floor(
      size / 3
  )}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">MIO</text>
</svg>`;
}

// Create SVG files first
const sizes = [16, 48, 128];
const iconColor = '#1a73e8'; // Google Blue

console.log('Creating extension icons...');

sizes.forEach((size) => {
    const svgContent = createSVGIcon(size, iconColor);
    const svgPath = `icons/icon${size}.svg`;

    // Create icons directory if it doesn't exist
    if (!fs.existsSync('icons')) {
        fs.mkdirSync('icons');
    }

    // Write SVG file
    fs.writeFileSync(svgPath, svgContent);
    console.log(`✅ Created ${svgPath}`);
});

console.log('\n📝 SVG icons created successfully!');
console.log('\nTo convert to PNG (optional):');
console.log('1. Install a tool like "svg2png" or use online converters');
console.log('2. Or use the SVG files directly (Chrome supports SVG icons)');
console.log('3. Update manifest.json to use .svg instead of .png if needed');

// Update manifest.json to use SVG icons
try {
    const manifestPath = 'manifest.json';
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);

    // Update icons to use SVG
    manifest.icons = {
        16: 'icons/icon16.svg',
        48: 'icons/icon48.svg',
        128: 'icons/icon128.svg',
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t'));
    console.log('✅ Updated manifest.json to use SVG icons');
} catch (error) {
    console.log('⚠️  Could not update manifest.json:', error.message);
}
