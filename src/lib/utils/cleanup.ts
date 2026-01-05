import fs from 'fs/promises';
import path from 'path';

const TEMP_DIR = path.join(process.cwd(), 'temp');
const OUTPUT_DIR = path.join(process.cwd(), 'output');

// Files older than this will be deleted (in milliseconds)
const MAX_FILE_AGE_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

interface CleanupResult {
    tempFilesDeleted: number;
    outputFilesDeleted: number;
    bytesFreed: number;
    errors: string[];
}

/**
 * Clean up old temporary and output files
 * Deletes files older than MAX_FILE_AGE_MS (2 days by default)
 */
export async function cleanupOldFiles(): Promise<CleanupResult> {
    const result: CleanupResult = {
        tempFilesDeleted: 0,
        outputFilesDeleted: 0,
        bytesFreed: 0,
        errors: [],
    };

    const now = Date.now();

    // Clean temp directory
    try {
        const tempFiles = await fs.readdir(TEMP_DIR);
        for (const file of tempFiles) {
            try {
                const filePath = path.join(TEMP_DIR, file);
                const stats = await fs.stat(filePath);
                const fileAge = now - stats.mtimeMs;

                if (fileAge > MAX_FILE_AGE_MS) {
                    await fs.unlink(filePath);
                    result.tempFilesDeleted++;
                    result.bytesFreed += stats.size;
                    console.log(`[Cleanup] Deleted temp file: ${file}`);
                }
            } catch (err) {
                result.errors.push(`Failed to delete temp/${file}: ${(err as Error).message}`);
            }
        }
    } catch (err) {
        // Directory might not exist
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            result.errors.push(`Failed to read temp directory: ${(err as Error).message}`);
        }
    }

    // Clean output directory
    try {
        const outputFiles = await fs.readdir(OUTPUT_DIR);
        for (const file of outputFiles) {
            // Skip projects.json file
            if (file === 'projects.json') continue;

            try {
                const filePath = path.join(OUTPUT_DIR, file);
                const stats = await fs.stat(filePath);
                const fileAge = now - stats.mtimeMs;

                if (fileAge > MAX_FILE_AGE_MS) {
                    await fs.unlink(filePath);
                    result.outputFilesDeleted++;
                    result.bytesFreed += stats.size;
                    console.log(`[Cleanup] Deleted output file: ${file}`);
                }
            } catch (err) {
                result.errors.push(`Failed to delete output/${file}: ${(err as Error).message}`);
            }
        }
    } catch (err) {
        // Directory might not exist
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            result.errors.push(`Failed to read output directory: ${(err as Error).message}`);
        }
    }

    // Clean /tmp directory for subtitle files
    try {
        const tmpFiles = await fs.readdir('/tmp');
        for (const file of tmpFiles) {
            // Only clean our subtitle temp files
            if (!file.includes('_subs')) continue;

            try {
                const filePath = path.join('/tmp', file);
                const stats = await fs.stat(filePath);
                const fileAge = now - stats.mtimeMs;

                if (fileAge > MAX_FILE_AGE_MS) {
                    await fs.unlink(filePath);
                    result.bytesFreed += stats.size;
                    console.log(`[Cleanup] Deleted tmp file: ${file}`);
                }
            } catch {
                // Ignore errors for /tmp files
            }
        }
    } catch {
        // Ignore /tmp access errors
    }

    console.log(`[Cleanup] Complete: ${result.tempFilesDeleted} temp, ${result.outputFilesDeleted} output files deleted. Freed ${(result.bytesFreed / 1024 / 1024).toFixed(2)} MB`);

    return result;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
