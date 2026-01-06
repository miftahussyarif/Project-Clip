/**
 * Platform-specific utilities for cross-platform compatibility (Linux/Windows)
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Detect if running on Windows
 */
export function isWindows(): boolean {
    return process.platform === 'win32';
}

/**
 * Get the correct temp directory for the current OS
 */
export function getTempDir(): string {
    return os.tmpdir();
}

/**
 * Get the null device for redirecting output (cross-platform)
 * Windows: NUL, Unix: /dev/null
 */
export function getNullDevice(): string {
    return isWindows() ? 'NUL' : '/dev/null';
}

/**
 * Redirect stderr to null in a cross-platform way
 * Returns the shell operator to append to commands
 */
export function suppressStderr(): string {
    return isWindows() ? '2>NUL' : '2>/dev/null';
}

/**
 * Find executable path - checks common locations and PATH
 * Windows: checks pip user scripts, common install locations
 * Linux: relies on PATH
 */
export async function findExecutable(name: string): Promise<string> {
    // Common executable names per platform
    const execName = isWindows() ? `${name}.exe` : name;

    // First, try simple PATH lookup
    try {
        const checkCmd = isWindows() ? `where ${name}` : `which ${name}`;
        const { stdout } = await execAsync(checkCmd);
        if (stdout.trim()) {
            const firstPath = stdout.trim().split('\n')[0].trim();
            console.log(`Found ${name} at: ${firstPath}`);
            return name; // Use simple name since it's in PATH
        }
    } catch {
        // Not in PATH, continue searching
    }

    // Windows-specific search locations
    if (isWindows()) {
        const windowsPaths = [
            // Python user scripts (pip install --user)
            path.join(process.env.APPDATA || '', 'Python', 'Python314', 'Scripts', execName),
            path.join(process.env.APPDATA || '', 'Python', 'Python313', 'Scripts', execName),
            path.join(process.env.APPDATA || '', 'Python', 'Python312', 'Scripts', execName),
            path.join(process.env.APPDATA || '', 'Python', 'Python311', 'Scripts', execName),
            path.join(process.env.APPDATA || '', 'Python', 'Python310', 'Scripts', execName),
            // Python global scripts
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python314', 'Scripts', execName),
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python313', 'Scripts', execName),
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'Scripts', execName),
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'Scripts', execName),
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python310', 'Scripts', execName),
            // Chocolatey
            path.join('C:', 'ProgramData', 'chocolatey', 'bin', execName),
            // Scoop
            path.join(process.env.USERPROFILE || '', 'scoop', 'shims', execName),
            // Common FFmpeg locations
            path.join('C:', 'ffmpeg', 'bin', execName),
            path.join('C:', 'Program Files', 'ffmpeg', 'bin', execName),
        ];

        for (const execPath of windowsPaths) {
            try {
                await execAsync(`"${execPath}" --version`);
                console.log(`Found ${name} at: ${execPath}`);
                return `"${execPath}"`;
            } catch {
                // Continue searching
            }
        }
    }

    // If not found anywhere, return the simple name and let it fail with a proper error
    return name;
}

/**
 * Get yt-dlp command/path
 */
let ytDlpPath: string | null = null;

export async function getYtDlpPath(): Promise<string> {
    if (ytDlpPath) return ytDlpPath;
    ytDlpPath = await findExecutable('yt-dlp');
    return ytDlpPath;
}

/**
 * Get ffmpeg command/path
 */
let ffmpegPath: string | null = null;

export async function getFFmpegPath(): Promise<string> {
    if (ffmpegPath) return ffmpegPath;
    ffmpegPath = await findExecutable('ffmpeg');
    return ffmpegPath;
}

/**
 * Get ffprobe command/path
 */
let ffprobePath: string | null = null;

export async function getFFprobePath(): Promise<string> {
    if (ffprobePath) return ffprobePath;
    ffprobePath = await findExecutable('ffprobe');
    return ffprobePath;
}

/**
 * Delete file(s) cross-platform
 */
export async function deleteFiles(patterns: string[]): Promise<void> {
    const fs = await import('fs/promises');
    for (const pattern of patterns) {
        try {
            // Simple file deletion
            await fs.unlink(pattern);
        } catch {
            // Ignore errors (file might not exist)
        }
    }
}

/**
 * Read file content cross-platform (replacement for `cat` command)
 */
export async function readFileContent(filePath: string): Promise<string> {
    const fs = await import('fs/promises');
    try {
        return await fs.readFile(filePath, 'utf-8');
    } catch {
        return '';
    }
}

/**
 * Find files matching a pattern in a directory
 * Cross-platform replacement for glob patterns
 */
export async function findMatchingFiles(directory: string, prefix: string, extension: string): Promise<string[]> {
    const fs = await import('fs/promises');
    try {
        const files = await fs.readdir(directory);
        return files
            .filter(f => f.startsWith(prefix) && f.endsWith(extension))
            .map(f => path.join(directory, f));
    } catch {
        return [];
    }
}
