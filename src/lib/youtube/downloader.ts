import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { VideoInfo } from '@/types';
import { parseYouTubeUrl } from './parser';

const execAsync = promisify(exec);

const TEMP_DIR = path.join(process.cwd(), 'temp');
const YT_DLP = '/usr/local/bin/yt-dlp'; // Use explicit path for latest version

/**
 * Ensure temp directory exists
 */
async function ensureTempDir(): Promise<void> {
    try {
        await fs.access(TEMP_DIR);
    } catch {
        await fs.mkdir(TEMP_DIR, { recursive: true });
    }
}

/**
 * Check if yt-dlp is installed
 */
async function checkYtDlp(): Promise<boolean> {
    try {
        await execAsync(`${YT_DLP} --version`);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get video information using yt-dlp
 */
export async function getVideoInfo(url: string): Promise<VideoInfo> {
    const videoId = parseYouTubeUrl(url);
    if (!videoId) {
        throw new Error('Invalid YouTube URL');
    }

    const isInstalled = await checkYtDlp();
    if (!isInstalled) {
        throw new Error('yt-dlp is not installed. Please install it with: sudo apt install yt-dlp');
    }

    try {
        const { stdout, stderr } = await execAsync(
            `${YT_DLP} --dump-json --no-download "https://www.youtube.com/watch?v=${videoId}"`,
            { maxBuffer: 10 * 1024 * 1024 }
        );

        if (stderr) {
            console.log('yt-dlp stderr:', stderr);
        }

        const data = JSON.parse(stdout);

        return {
            id: videoId,
            title: data.title || 'Untitled',
            description: data.description || '',
            duration: data.duration || 0,
            thumbnail: data.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            channelName: data.uploader || data.channel || 'Unknown',
            viewCount: data.view_count || 0,
            publishedAt: data.upload_date || '',
        };
    } catch (error: unknown) {
        const err = error as { stderr?: string; message?: string };
        console.error('Error getting video info:', err.stderr || err.message || error);

        if (err.stderr?.includes('Video unavailable') || err.stderr?.includes('Private video')) {
            throw new Error('This video is unavailable or private');
        }
        if (err.stderr?.includes('Sign in to confirm your age')) {
            throw new Error('This video requires age verification and cannot be processed');
        }

        throw new Error(`Failed to get video info: ${err.stderr || err.message || 'Unknown error'}`);
    }
}

/**
 * Download video using yt-dlp
 */
export async function downloadVideo(
    url: string,
    onProgress?: (progress: number) => void
): Promise<string> {
    await ensureTempDir();

    const videoId = parseYouTubeUrl(url);
    if (!videoId) {
        throw new Error('Invalid YouTube URL');
    }

    const isInstalled = await checkYtDlp();
    if (!isInstalled) {
        throw new Error('yt-dlp is not installed. Please install it with: sudo apt install yt-dlp');
    }

    const outputPath = path.join(TEMP_DIR, `${videoId}.mp4`);

    // Check if already downloaded
    try {
        await fs.access(outputPath);
        const stats = await fs.stat(outputPath);
        if (stats.size > 0) {
            console.log(`Video already downloaded: ${outputPath}`);
            return outputPath;
        }
        // File exists but is empty, delete it
        await fs.unlink(outputPath);
    } catch {
        // File doesn't exist, proceed with download
    }

    console.log(`Downloading video ${videoId}...`);

    try {
        // Use a simpler format selection that works better
        const command = `${YT_DLP} -f "best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best" --merge-output-format mp4 --no-playlist -o "${outputPath}" "https://www.youtube.com/watch?v=${videoId}"`;

        console.log('Running command:', command);

        const { stdout, stderr } = await execAsync(command, {
            maxBuffer: 100 * 1024 * 1024,
            timeout: 300000 // 5 minute timeout
        });

        if (stdout) console.log('yt-dlp stdout:', stdout);
        if (stderr) console.log('yt-dlp stderr:', stderr);

        // Verify file exists and has content
        const stats = await fs.stat(outputPath);
        if (stats.size === 0) {
            throw new Error('Downloaded file is empty');
        }

        console.log(`Download complete: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return outputPath;
    } catch (error: unknown) {
        const err = error as { stderr?: string; stdout?: string; message?: string; code?: string };
        console.error('Download error details:', {
            stderr: err.stderr,
            stdout: err.stdout,
            message: err.message,
            code: err.code
        });

        // Clean up partial download
        try {
            await fs.unlink(outputPath);
        } catch {
            // Ignore cleanup error
        }

        if (err.stderr?.includes('Video unavailable') || err.stderr?.includes('Private video')) {
            throw new Error('This video is unavailable or private');
        }
        if (err.stderr?.includes('Sign in to confirm your age')) {
            throw new Error('This video requires age verification');
        }
        if (err.stderr?.includes('This video is not available')) {
            throw new Error('This video is not available in your region');
        }
        if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
            throw new Error('Download timed out. Try a shorter video or check your connection');
        }

        throw new Error(`Failed to download video: ${err.stderr || err.message || 'Unknown error'}`);
    }
}

/**
 * Clean up temporary video file
 */
export async function cleanupVideo(videoId: string): Promise<void> {
    const filePath = path.join(TEMP_DIR, `${videoId}.mp4`);
    try {
        await fs.unlink(filePath);
    } catch {
        // File might not exist, ignore error
    }
}
