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


sizes.forEach((size) => {
    const svgContent = createSVGIcon(size, iconColor);
    const svgPath = `icons/icon${size}.svg`;

    // Create icons directory if it doesn't exist
    if (!fs.existsSync('icons')) {
        fs.mkdirSync('icons');
    }

    // Write SVG file
    fs.writeFileSync(svgPath, svgContent);
});


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
} catch (error) {
}
