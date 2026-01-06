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
    const fs = await import('fs/promises');

    // Common executable names per platform
    const execName = isWindows() ? `${name}.exe` : name;

    console.log(`[Platform] Searching for executable: ${name} (platform: ${process.platform})`);

    // First, try simple PATH lookup
    try {
        const checkCmd = isWindows() ? `where ${name}` : `which ${name}`;
        const { stdout } = await execAsync(checkCmd);
        if (stdout.trim()) {
            const firstPath = stdout.trim().split('\n')[0].trim();
            console.log(`[Platform] Found ${name} in PATH: ${firstPath}`);
            return name; // Use simple name since it's in PATH
        }
    } catch {
        console.log(`[Platform] ${name} not found in PATH, searching common locations...`);
    }

    // Windows-specific search locations
    if (isWindows()) {
        const userProfile = process.env.USERPROFILE || 'C:\\Users\\Default';
        const appData = process.env.APPDATA || path.join(userProfile, 'AppData', 'Roaming');
        const localAppData = process.env.LOCALAPPDATA || path.join(userProfile, 'AppData', 'Local');

        const pythonVersions = ['Python314', 'Python313', 'Python312', 'Python311', 'Python310', 'Python39', 'Python38'];

        const windowsPaths: string[] = [];

        // Python user scripts (pip install --user) - in APPDATA\Roaming
        for (const pyVer of pythonVersions) {
            windowsPaths.push(path.join(appData, 'Python', pyVer, 'Scripts', execName));
        }

        // Python global scripts (pip install) - in LOCALAPPDATA\Programs
        for (const pyVer of pythonVersions) {
            windowsPaths.push(path.join(localAppData, 'Programs', 'Python', pyVer, 'Scripts', execName));
        }

        // Python in standard install locations
        for (const pyVer of pythonVersions) {
            windowsPaths.push(path.join('C:\\', pyVer, 'Scripts', execName));
            windowsPaths.push(path.join('C:\\', 'Program Files', pyVer, 'Scripts', execName));
        }

        // Chocolatey
        windowsPaths.push(path.join('C:\\', 'ProgramData', 'chocolatey', 'bin', execName));

        // Scoop
        windowsPaths.push(path.join(userProfile, 'scoop', 'shims', execName));
        windowsPaths.push(path.join(userProfile, 'scoop', 'apps', name, 'current', execName));

        // Common FFmpeg locations
        windowsPaths.push(path.join('C:\\', 'ffmpeg', 'bin', execName));
        windowsPaths.push(path.join('C:\\', 'Program Files', 'ffmpeg', 'bin', execName));
        windowsPaths.push(path.join('C:\\', 'Program Files (x86)', 'ffmpeg', 'bin', execName));
        windowsPaths.push(path.join(localAppData, 'Microsoft', 'WinGet', 'Packages', `*${name}*`, execName));

        // Common yt-dlp locations
        if (name === 'yt-dlp') {
            windowsPaths.push(path.join(userProfile, 'yt-dlp', execName));
            windowsPaths.push(path.join('C:\\', 'yt-dlp', execName));
        }

        for (const execPath of windowsPaths) {
            try {
                // First check if file exists
                await fs.access(execPath);
                console.log(`[Platform] Found ${name} file at: ${execPath}`);

                // Then verify it runs
                await execAsync(`"${execPath}" --version`);
                console.log(`[Platform] Verified ${name} works at: ${execPath}`);
                return `"${execPath}"`;
            } catch {
                // Continue searching
            }
        }

        console.log(`[Platform] ${name} not found in any known Windows location`);
    }

    // If not found anywhere, return the simple name and let it fail with a proper error
    console.log(`[Platform] Returning simple name '${name}' - may fail if not in PATH`);
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
