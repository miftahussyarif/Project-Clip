import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * Check if FFmpeg is installed
 */
export async function checkFFmpeg(): Promise<boolean> {
    try {
        await execAsync('ffmpeg -version');
        return true;
    } catch {
        return false;
    }
}

/**
 * Get video dimensions
 */
export async function getVideoDimensions(
    inputPath: string
): Promise<{ width: number; height: number }> {
    const { stdout } = await execAsync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${inputPath}"`
    );
    const [width, height] = stdout.trim().split('x').map(Number);
    return { width, height };
}

/**
 * Get video duration in seconds
 */
export async function getVideoDuration(inputPath: string): Promise<number> {
    const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`
    );
    return parseFloat(stdout.trim());
}

/**
 * Format seconds to FFmpeg timestamp (HH:MM:SS.mmm)
 */
export function formatFFmpegTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
}

/**
 * Cut video segment
 */
export async function cutVideo(
    inputPath: string,
    outputPath: string,
    startTime: number,
    endTime: number
): Promise<void> {
    const duration = endTime - startTime;
    const startTimestamp = formatFFmpegTimestamp(startTime);

    // Use -ss before -i for fast seeking, then accurate trimming
    const command = `ffmpeg -y -ss ${startTimestamp} -i "${inputPath}" -t ${duration} -c:v libx264 -c:a aac -avoid_negative_ts make_zero "${outputPath}"`;

    await execAsync(command, { maxBuffer: 50 * 1024 * 1024 });
}

/**
 * Convert video to portrait (9:16) with smart cropping
 */
export async function convertToPortrait(
    inputPath: string,
    outputPath: string,
    focusX?: number // 0-1, where to focus horizontally (0.5 = center)
): Promise<void> {
    const { width, height } = await getVideoDimensions(inputPath);

    // Target portrait dimensions (1080x1920)
    const targetWidth = 1080;
    const targetHeight = 1920;
    const targetRatio = targetWidth / targetHeight; // 0.5625

    const sourceRatio = width / height;

    let cropWidth: number;
    let cropHeight: number;
    let cropX: number;
    let cropY: number;

    if (sourceRatio > targetRatio) {
        // Source is wider - crop horizontally
        cropHeight = height;
        cropWidth = Math.round(height * targetRatio);
        cropY = 0;

        // Use focus point or center
        const maxCropX = width - cropWidth;
        const focusPoint = focusX !== undefined ? focusX : 0.5;
        cropX = Math.round(maxCropX * focusPoint);
        cropX = Math.max(0, Math.min(cropX, maxCropX));
    } else {
        // Source is taller or equal - crop vertically
        cropWidth = width;
        cropHeight = Math.round(width / targetRatio);
        cropX = 0;
        cropY = Math.round((height - cropHeight) / 2);
    }

    // Crop and scale to 1080x1920
    const command = `ffmpeg -y -i "${inputPath}" -vf "crop=${cropWidth}:${cropHeight}:${cropX}:${cropY},scale=${targetWidth}:${targetHeight}" -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k "${outputPath}"`;

    await execAsync(command, { maxBuffer: 50 * 1024 * 1024 });
}

/**
 * Add subtitles to video (burn-in)
 */
export async function addSubtitles(
    inputPath: string,
    outputPath: string,
    srtPath: string,
    style?: {
        fontName?: string;
        fontSize?: number;
        primaryColor?: string;
        outlineColor?: string;
        bold?: boolean;
    }
): Promise<void> {
    const {
        fontName = 'Arial',
        fontSize = 24,
        primaryColor = '&HFFFFFF', // White in ASS format
        outlineColor = '&H000000', // Black
        bold = true,
    } = style || {};

    // ASS style formatting
    const boldValue = bold ? 1 : 0;
    const forceStyle = `FontName=${fontName},FontSize=${fontSize},PrimaryColour=${primaryColor},OutlineColour=${outlineColor},Bold=${boldValue},Alignment=2,MarginV=50`;

    const command = `ffmpeg -y -i "${inputPath}" -vf "subtitles='${srtPath}':force_style='${forceStyle}'" -c:v libx264 -crf 23 -preset medium -c:a copy "${outputPath}"`;

    await execAsync(command, { maxBuffer: 50 * 1024 * 1024 });
}

/**
 * Combine multiple processing steps efficiently
 */
export async function processClipComplete(
    inputPath: string,
    outputPath: string,
    startTime: number,
    endTime: number,
    srtPath?: string,
    focusX?: number
): Promise<void> {
    const duration = endTime - startTime;
    const startTimestamp = formatFFmpegTimestamp(startTime);

    const { width, height } = await getVideoDimensions(inputPath);

    // Calculate crop for portrait
    const targetWidth = 1080;
    const targetHeight = 1920;
    const targetRatio = targetWidth / targetHeight;
    const sourceRatio = width / height;

    let cropWidth: number;
    let cropHeight: number;
    let cropX: number;
    let cropY: number;

    if (sourceRatio > targetRatio) {
        cropHeight = height;
        cropWidth = Math.round(height * targetRatio);
        cropY = 0;
        const maxCropX = width - cropWidth;
        const focusPoint = focusX !== undefined ? focusX : 0.5;
        cropX = Math.round(maxCropX * focusPoint);
        cropX = Math.max(0, Math.min(cropX, maxCropX));
    } else {
        cropWidth = width;
        cropHeight = Math.round(width / targetRatio);
        cropX = 0;
        cropY = Math.round((height - cropHeight) / 2);
    }

    // Build filter chain
    let filterChain = `crop=${cropWidth}:${cropHeight}:${cropX}:${cropY},scale=${targetWidth}:${targetHeight}`;

    // Add subtitles if provided
    if (srtPath) {
        // Escape special characters in path
        const escapedSrtPath = srtPath.replace(/'/g, "'\\''").replace(/:/g, '\\:');
        filterChain += `,subtitles='${escapedSrtPath}':force_style='FontName=Arial,FontSize=28,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Bold=1,Alignment=2,MarginV=60,Outline=2,Shadow=1'`;
    }

    const command = `ffmpeg -y -ss ${startTimestamp} -i "${inputPath}" -t ${duration} -vf "${filterChain}" -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k -r 30 "${outputPath}"`;

    await execAsync(command, { maxBuffer: 100 * 1024 * 1024 });
}

/**
 * Get video info for processing
 */
export async function getVideoInfo(inputPath: string): Promise<{
    width: number;
    height: number;
    duration: number;
    fps: number;
}> {
    const { stdout } = await execAsync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration -show_entries format=duration -of json "${inputPath}"`
    );

    const data = JSON.parse(stdout);
    const stream = data.streams?.[0] || {};
    const format = data.format || {};

    // Parse frame rate (e.g., "30/1" or "30000/1001")
    let fps = 30;
    if (stream.r_frame_rate) {
        const [num, den] = stream.r_frame_rate.split('/').map(Number);
        fps = den ? num / den : num;
    }

    return {
        width: stream.width || 1920,
        height: stream.height || 1080,
        duration: parseFloat(stream.duration || format.duration || '0'),
        fps: Math.round(fps),
    };
}

/**
 * Concatenate multiple video files into one
 */
export async function concatenateVideos(
    inputPaths: string[],
    outputPath: string
): Promise<void> {
    if (inputPaths.length === 0) {
        throw new Error('No input files provided for concatenation');
    }

    if (inputPaths.length === 1) {
        // Just copy the single file
        await fs.copyFile(inputPaths[0], outputPath);
        return;
    }

    // Create a temporary file list for FFmpeg concat demuxer
    const listPath = outputPath.replace('.mp4', '_concat_list.txt');
    const listContent = inputPaths.map(p => `file '${p}'`).join('\n');
    await fs.writeFile(listPath, listContent);

    try {
        const command = `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}"`;
        await execAsync(command, { maxBuffer: 100 * 1024 * 1024 });
    } finally {
        // Cleanup list file
        try {
            await fs.unlink(listPath);
        } catch {
            // Ignore cleanup errors
        }
    }
}

/**
 * Concatenate two video files with a fade-to-black transition
 * Uses xfade filter with fadeblack effect
 */
export async function concatenateWithFadeToBlack(
    inputPaths: string[],
    outputPath: string,
    fadeDuration: number = 0.5 // Duration of fade in seconds
): Promise<void> {
    if (inputPaths.length === 0) {
        throw new Error('No input files provided for concatenation');
    }

    if (inputPaths.length === 1) {
        // Just copy the single file
        await fs.copyFile(inputPaths[0], outputPath);
        return;
    }

    // For two videos, use xfade filter with fadeblack effect
    // The fadeblack effect creates: video1 -> fade to black -> fade from black -> video2
    const [firstVideo, secondVideo] = inputPaths;

    // Get duration of first video to calculate offset for xfade
    const firstDuration = await getVideoDuration(firstVideo);

    // Offset is where the transition starts (end of first video minus fade duration)
    const offset = Math.max(0, firstDuration - fadeDuration);

    // Use xfade with fadeblack effect for fade-to-black transition
    // fadeblack: fades current video to black, then fades in the next video from black
    const command = `ffmpeg -y -i "${firstVideo}" -i "${secondVideo}" -filter_complex "[0:v][1:v]xfade=transition=fadeblack:duration=${fadeDuration}:offset=${offset}[v];[0:a][1:a]acrossfade=d=${fadeDuration}[a]" -map "[v]" -map "[a]" -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k "${outputPath}"`;

    await execAsync(command, { maxBuffer: 100 * 1024 * 1024 });
}

/**
 * Process a clip with a hook segment prepended
 * The hook is cut first, then the main clip, then both are concatenated
 * with a fade-to-black transition (500ms) between them
 */
export async function processClipWithHook(
    inputPath: string,
    outputPath: string,
    hookStart: number,
    hookEnd: number,
    mainStart: number,
    mainEnd: number,
    srtPath?: string,
    focusX?: number
): Promise<void> {
    const { width, height } = await getVideoDimensions(inputPath);

    // Calculate crop for portrait
    const targetWidth = 1080;
    const targetHeight = 1920;
    const targetRatio = targetWidth / targetHeight;
    const sourceRatio = width / height;

    let cropWidth: number;
    let cropHeight: number;
    let cropX: number;
    let cropY: number;

    if (sourceRatio > targetRatio) {
        cropHeight = height;
        cropWidth = Math.round(height * targetRatio);
        cropY = 0;
        const maxCropX = width - cropWidth;
        const focusPoint = focusX !== undefined ? focusX : 0.5;
        cropX = Math.round(maxCropX * focusPoint);
        cropX = Math.max(0, Math.min(cropX, maxCropX));
    } else {
        cropWidth = width;
        cropHeight = Math.round(width / targetRatio);
        cropX = 0;
        cropY = Math.round((height - cropHeight) / 2);
    }

    // Build base filter chain (crop and scale)
    const baseFilter = `crop=${cropWidth}:${cropHeight}:${cropX}:${cropY},scale=${targetWidth}:${targetHeight}`;

    // Get temp directory from output path
    const tempDir = outputPath.substring(0, outputPath.lastIndexOf('/'));
    const baseName = outputPath.substring(outputPath.lastIndexOf('/') + 1, outputPath.lastIndexOf('.'));

    // Process hook segment
    const hookPath = `${tempDir}/${baseName}_hook_temp.mp4`;
    const hookDuration = hookEnd - hookStart;
    const hookStartTimestamp = formatFFmpegTimestamp(hookStart);
    const hookCommand = `ffmpeg -y -ss ${hookStartTimestamp} -i "${inputPath}" -t ${hookDuration} -vf "${baseFilter}" -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k -r 30 "${hookPath}"`;
    await execAsync(hookCommand, { maxBuffer: 100 * 1024 * 1024 });

    // Process main clip segment
    const mainPath = `${tempDir}/${baseName}_main_temp.mp4`;
    const mainDuration = mainEnd - mainStart;
    const mainStartTimestamp = formatFFmpegTimestamp(mainStart);

    // For main clip, add subtitles if provided
    let mainFilter = baseFilter;
    if (srtPath) {
        const escapedSrtPath = srtPath.replace(/'/g, "'\\''").replace(/:/g, '\\:');
        mainFilter += `,subtitles='${escapedSrtPath}':force_style='FontName=Arial,FontSize=28,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Bold=1,Alignment=2,MarginV=60,Outline=2,Shadow=1'`;
    }

    const mainCommand = `ffmpeg -y -ss ${mainStartTimestamp} -i "${inputPath}" -t ${mainDuration} -vf "${mainFilter}" -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k -r 30 "${mainPath}"`;
    await execAsync(mainCommand, { maxBuffer: 100 * 1024 * 1024 });

    // Concatenate hook + main clip with fade-to-black transition (500ms / 0.5 seconds)
    await concatenateWithFadeToBlack([hookPath, mainPath], outputPath, 0.5);

    // Cleanup temp files
    try {
        await fs.unlink(hookPath);
        await fs.unlink(mainPath);
    } catch {
        // Ignore cleanup errors
    }
}
