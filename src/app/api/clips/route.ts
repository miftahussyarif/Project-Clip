import { NextRequest, NextResponse } from 'next/server';
import { getProcessedClips, getClipPath, deleteClip } from '@/lib/video/processor';
import fs from 'fs/promises';
import path from 'path';

// GET - List all processed clips
export async function GET() {
    try {
        const clips = await getProcessedClips();

        return NextResponse.json({
            success: true,
            data: clips.map(clip => ({
                ...clip,
                downloadUrl: `/api/clips/${encodeURIComponent(clip.filename)}`,
            })),
        });
    } catch (error) {
        console.error('Error listing clips:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}

// DELETE - Delete a clip
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const filename = searchParams.get('filename');

        if (!filename) {
            return NextResponse.json(
                { success: false, error: 'Filename is required' },
                { status: 400 }
            );
        }

        await deleteClip(filename);

        return NextResponse.json({
            success: true,
            message: 'Clip deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting clip:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
