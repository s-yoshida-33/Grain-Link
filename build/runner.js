#!/usr/bin/env node

/**
 * Tauri Build Runner
 * 環境変数を読み込んで PowerShell スクリプトを実行
 */

import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const script = args[0] || 'sign-and-build.ps1';
const additionalArgs = args.slice(1).join(' ');

console.log('[*] Tauri Build Runner');
console.log(`[*] Script: ${script}`);
console.log('[*] Reading environment variables...');

// Use absolute path for PowerShell script
const scriptPath = path.join(__dirname, script);
const psCommand = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" ${additionalArgs}`;

console.log(`[*] Executing: ${psCommand}`);
console.log('');

exec(psCommand, (error, stdout, stderr) => {
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    
    if (error) {
        console.error(`[!] Error: ${error.message}`);
        process.exit(1);
    }
});
