import { NextRequest, NextResponse } from 'next/server';
import { getVideoInfo, downloadVideo } from '@/lib/youtube/downloader';
import { getTranscript } from '@/lib/youtube/transcript';
import { analyzeTranscript } from '@/lib/gemini/analyzer';
import { parseYouTubeUrl } from '@/lib/youtube/parser';
import { transcribeVideo } from '@/lib/video/transcriber';

export const maxDuration = 300; // 5 minutes timeout for auto-transcription

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

        // Step 1: Get video info
        const videoInfo = await getVideoInfo(url);

        // Step 2: Try to get transcript from YouTube
        let transcript = await getTranscript(url);
        let transcriptionMethod = 'youtube';

        // Step 3: If no transcript available, use AI auto-transcription
        if (!transcript.fullText) {
            console.log('No YouTube transcript available. Using AI auto-transcription...');

            try {
                // Download video first
                const videoPath = await downloadVideo(url);

                // Transcribe using Gemini AI
                transcript = await transcribeVideo(videoPath);
                transcriptionMethod = 'ai';

                if (!transcript.fullText) {
                    return NextResponse.json(
                        { success: false, error: 'Failed to transcribe video. Please try a different video.' },
                        { status: 400 }
                    );
                }

                console.log(`AI transcription complete: ${transcript.segments.length} segments`);
            } catch (transcribeError) {
                console.error('Auto-transcription error:', transcribeError);
                return NextResponse.json(
                    { success: false, error: 'Failed to auto-transcribe video. ' + (transcribeError as Error).message },
                    { status: 400 }
                );
            }
        }

        // Step 4: Analyze with Gemini
        const recommendations = await analyzeTranscript(
            transcript,
            videoInfo.duration,
            videoInfo.title
        );

        if (recommendations.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Could not identify any suitable clips in this video.' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                videoInfo,
                transcript,
                recommendations,
                transcriptionMethod, // 'youtube' or 'ai'
            },
        });
    } catch (error) {
        console.error('Error analyzing video:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
