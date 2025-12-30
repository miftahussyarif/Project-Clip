import { NextRequest, NextResponse } from 'next/server';
import { getVideoInfo } from '@/lib/youtube/downloader';
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

        const videoInfo = await getVideoInfo(url);

        return NextResponse.json({
            success: true,
            data: videoInfo,
        });
    } catch (error) {
        console.error('Error getting video info:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
