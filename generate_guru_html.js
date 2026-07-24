const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'index.html');
const destPath = path.join(__dirname, 'guru.html');

let html = fs.readFileSync(srcPath, 'utf8');

fs.writeFileSync(destPath, html, 'utf8');
console.log('guru.html successfully generated!');
