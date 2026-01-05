import { NextResponse } from 'next/server';
import { cleanupOldFiles, formatBytes } from '@/lib/utils/cleanup';

/**
 * POST - Trigger manual cleanup
 */
export async function POST() {
    try {
        const result = await cleanupOldFiles();

        return NextResponse.json({
            success: true,
            data: {
                tempFilesDeleted: result.tempFilesDeleted,
                outputFilesDeleted: result.outputFilesDeleted,
                bytesFreed: formatBytes(result.bytesFreed),
                errors: result.errors,
            },
            message: `Cleanup complete. Deleted ${result.tempFilesDeleted + result.outputFilesDeleted} files, freed ${formatBytes(result.bytesFreed)}.`,
        });
    } catch (error) {
        console.error('Cleanup error:', error);
        return NextResponse.json(
            { success: false, error: 'Cleanup failed' },
            { status: 500 }
        );
    }
}

/**
 * GET - Get storage status
 */
export async function GET() {
    try {
        const fs = await import('fs/promises');
        const path = await import('path');

        const TEMP_DIR = path.join(process.cwd(), 'temp');
        const OUTPUT_DIR = path.join(process.cwd(), 'output');

        let tempSize = 0;
        let tempCount = 0;
        let outputSize = 0;
        let outputCount = 0;

        // Get temp folder stats
        try {
            const tempFiles = await fs.readdir(TEMP_DIR);
            for (const file of tempFiles) {
                try {
                    const stats = await fs.stat(path.join(TEMP_DIR, file));
                    tempSize += stats.size;
                    tempCount++;
                } catch {
                    // Ignore individual file errors
                }
            }
        } catch {
            // Directory doesn't exist
        }

        // Get output folder stats
        try {
            const outputFiles = await fs.readdir(OUTPUT_DIR);
            for (const file of outputFiles) {
                if (file === 'projects.json') continue;
                try {
                    const stats = await fs.stat(path.join(OUTPUT_DIR, file));
                    outputSize += stats.size;
                    outputCount++;
                } catch {
                    // Ignore individual file errors
                }
            }
        } catch {
            // Directory doesn't exist
        }

        return NextResponse.json({
            success: true,
            data: {
                temp: {
                    files: tempCount,
                    size: formatBytes(tempSize),
                    sizeBytes: tempSize,
                },
                output: {
                    files: outputCount,
                    size: formatBytes(outputSize),
                    sizeBytes: outputSize,
                },
                total: {
                    files: tempCount + outputCount,
                    size: formatBytes(tempSize + outputSize),
                    sizeBytes: tempSize + outputSize,
                },
            },
        });
    } catch (error) {
        console.error('Storage status error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get storage status' },
            { status: 500 }
        );
    }
}
