import { NextRequest, NextResponse } from 'next/server';
import { getTranscript } from '@/lib/youtube/transcript';
import { parseYouTubeUrl } from '@/lib/youtube/parser';

export async function POST(request: NextRequest) {
    try {
        const { url } = await request.json();

        if (!url) {
            return NextResponse.json(
                { success: false, error: 'URL is required' },
                { status: 400 }
            );
        }

        const videoId = parseYouTubeUrl(url);
        if (!videoId) {
            return NextResponse.json(
                { success: false, error: 'Invalid YouTube URL' },
                { status: 400 }
            );
        }

        const transcript = await getTranscript(url);

        if (!transcript.fullText) {
            return NextResponse.json(
                { success: false, error: 'No transcript available for this video' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: transcript,
        });
    } catch (error) {
        console.error('Error getting transcript:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
