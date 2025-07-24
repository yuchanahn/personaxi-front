import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const buildDir = 'build';
const urlsToCache = ['/', '/index.html', '/manifest.json'];

function collectFiles(dir, prefix = '') {
    readdirSync(dir).forEach((file) => {
        const fullPath = join(dir, file);
        if (statSync(fullPath).isDirectory()) {
            collectFiles(fullPath, `${prefix}/${file}`);
        } else {
            urlsToCache.push(`${prefix}/${file}`);
        }
    });
}

collectFiles(join(buildDir, '_app'));
console.log(JSON.stringify(urlsToCache, null, 2)); // JSON 형식으로 출력