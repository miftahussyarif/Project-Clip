import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream, statSync } from 'fs';

const OUTPUT_DIR = path.join(process.cwd(), 'output');

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        const { filename } = await params;
        const decodedFilename = decodeURIComponent(filename);

        // Security: Prevent directory traversal
        if (decodedFilename.includes('..') || decodedFilename.includes('/')) {
            return NextResponse.json(
                { success: false, error: 'Invalid filename' },
                { status: 400 }
            );
        }

        const filePath = path.join(OUTPUT_DIR, decodedFilename);

        // Check if file exists
        try {
            await fs.access(filePath);
        } catch {
            return NextResponse.json(
                { success: false, error: 'Clip not found' },
                { status: 404 }
            );
        }

        // Get file stats
        const stats = statSync(filePath);
        const fileBuffer = await fs.readFile(filePath);

        // Return the video file
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Length': stats.size.toString(),
                'Content-Disposition': `attachment; filename="${decodedFilename}"`,
            },
        });
    } catch (error) {
        console.error('Error serving clip:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
