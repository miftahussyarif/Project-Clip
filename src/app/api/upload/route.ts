import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = path.join(process.cwd(), 'temp', 'uploads');

export const config = {
    api: {
        bodyParser: false,
    },
};

export async function POST(request: NextRequest) {
    try {
        // Ensure upload directory exists
        await mkdir(UPLOAD_DIR, { recursive: true });

        const formData = await request.formData();
        const file = formData.get('video') as File | null;

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'No video file provided' },
                { status: 400 }
            );
        }

        // Validate file type
        const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
        if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
            return NextResponse.json(
                { success: false, error: 'Invalid file type. Supported: MP4, WebM, MOV, AVI, MKV' },
                { status: 400 }
            );
        }

        // Generate unique filename
        const ext = path.extname(file.name) || '.mp4';
        const filename = `upload_${uuidv4()}${ext}`;
        const filepath = path.join(UPLOAD_DIR, filename);

        // Write file to disk
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filepath, buffer);

        // Extract basic video info
        const videoInfo = {
            id: uuidv4(),
            title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
            description: 'Uploaded video',
            duration: 0, // Will be determined during processing
            thumbnail: '',
            channelName: 'Local Upload',
            viewCount: 0,
            publishedAt: new Date().toISOString(),
        };

        return NextResponse.json({
            success: true,
            data: {
                videoPath: filepath,
                filename: file.name,
                size: file.size,
                videoInfo,
            },
        });
    } catch (error) {
        console.error('Error uploading video:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
