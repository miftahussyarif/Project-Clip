import { NextRequest, NextResponse } from 'next/server';
import { downloadVideo, getVideoInfo } from '@/lib/youtube/downloader';
import { parseYouTubeUrl } from '@/lib/youtube/parser';
import { processAllClips, createProject, addClipToProject, getProjectByVideoId } from '@/lib/video/processor';
import { ClipRecommendation, Transcript } from '@/types';

export const maxDuration = 300; // 5 minutes timeout for processing

export async function POST(request: NextRequest) {
    try {
        const { url, clips, transcript: providedTranscript, projectId } = await request.json() as {
            url: string;
            clips: ClipRecommendation[];
            transcript: Transcript | null;
            projectId?: string; // Optional: if provided, add clips to existing project
        };

        if (!url || !clips || clips.length === 0) {
            return NextResponse.json(
                { success: false, error: 'URL and clips are required' },
                { status: 400 }
            );
        }

        // Create empty transcript if not provided (for manual input mode)
        const transcript: Transcript = providedTranscript || {
            segments: [],
            fullText: '',
            language: 'auto',
        };

        const videoId = parseYouTubeUrl(url);
        if (!videoId) {
            return NextResponse.json(
                { success: false, error: 'Invalid YouTube URL' },
                { status: 400 }
            );
        }

        // Get video info for project creation
        const videoInfo = await getVideoInfo(url);

        // Get or create project
        let currentProjectId = projectId;
        if (!currentProjectId) {
            // Check if project exists for this video, or create new one
            const existingProject = await getProjectByVideoId(videoId);
            if (existingProject) {
                currentProjectId = existingProject.id;
            } else {
                const newProject = await createProject(videoInfo, url);
                currentProjectId = newProject.id;
            }
        }

        // Step 1: Download the video
        const videoPath = await downloadVideo(url);

        // Step 2: Process all clips
        const results = await processAllClips(
            videoPath,
            clips,
            transcript
        );

        // Step 3: Add successful clips to project
        const successes = results.filter(r => !r.error);
        for (const result of successes) {
            const clipFilename = result.outputPath.split('/').pop();
            if (clipFilename && currentProjectId) {
                await addClipToProject(currentProjectId, clipFilename);
            }
        }

        // Check for any errors
        const errors = results.filter(r => r.error);

        return NextResponse.json({
            success: true,
            data: {
                processed: successes.length,
                failed: errors.length,
                projectId: currentProjectId,
                results: results.map(r => ({
                    clipId: r.clipId,
                    success: !r.error,
                    outputPath: r.outputPath,
                    downloadUrl: r.outputPath ? `/api/clips/${encodeURIComponent(r.outputPath.split('/').pop() || '')}` : null,
                    error: r.error,
                })),
            },
        });
    } catch (error) {
        console.error('Error processing video:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}

