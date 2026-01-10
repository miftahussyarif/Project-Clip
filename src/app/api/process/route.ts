import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { downloadVideo, getVideoInfo } from '@/lib/youtube/downloader';
import { parseYouTubeUrl } from '@/lib/youtube/parser';
import { processAllClips, createProject, addClipToProject, getProjectByVideoId } from '@/lib/video/processor';
import { ClipRecommendation, Transcript, VideoInfo } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Helper to format seconds to HH:MM:SS
function formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const maxDuration = 300; // 5 minutes timeout for processing

interface ProcessRequest {
    url?: string; // YouTube URL (optional if videoPath is provided)
    videoPath?: string; // Local video path from upload (optional if url is provided)
    videoInfo?: VideoInfo; // Video info for uploaded videos
    clips: ClipRecommendation[];
    transcript: Transcript | null;
    projectId?: string; // Optional: if provided, add clips to existing project
}

export async function POST(request: NextRequest) {
    try {
        const { url, videoPath, videoInfo: providedVideoInfo, clips, transcript: providedTranscript, projectId } = await request.json() as ProcessRequest;

        // Need either URL or videoPath
        if (!url && !videoPath) {
            return NextResponse.json(
                { success: false, error: 'Either YouTube URL or video path is required' },
                { status: 400 }
            );
        }

        if (!clips || clips.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Clips are required' },
                { status: 400 }
            );
        }

        // Create empty transcript if not provided (for manual input mode)
        const transcript: Transcript = providedTranscript || {
            segments: [],
            fullText: '',
            language: 'auto',
        };

        let finalVideoPath: string;
        let videoInfo: VideoInfo;
        let videoId: string;

        if (videoPath) {
            // Using uploaded video
            // Verify file exists
            try {
                await fs.access(videoPath);
            } catch {
                return NextResponse.json(
                    { success: false, error: 'Uploaded video file not found' },
                    { status: 400 }
                );
            }

            finalVideoPath = videoPath;
            videoId = providedVideoInfo?.id || uuidv4();
            videoInfo = providedVideoInfo || {
                id: videoId,
                title: path.basename(videoPath, path.extname(videoPath)),
                description: 'Uploaded video',
                duration: 0,
                thumbnail: '',
                channelName: 'Local Upload',
                viewCount: 0,
                publishedAt: new Date().toISOString(),
            };
        } else {
            // Using YouTube URL
            const parsedVideoId = parseYouTubeUrl(url!);
            if (!parsedVideoId) {
                return NextResponse.json(
                    { success: false, error: 'Invalid YouTube URL' },
                    { status: 400 }
                );
            }
            videoId = parsedVideoId;

            // Get video info for project creation
            videoInfo = await getVideoInfo(url!);

            // Download the video
            finalVideoPath = await downloadVideo(url!);
        }

        // Get or create project
        let currentProjectId = projectId;
        if (!currentProjectId) {
            // Check if project exists for this video, or create new one
            const existingProject = await getProjectByVideoId(videoId);
            if (existingProject) {
                currentProjectId = existingProject.id;
            } else {
                const projectUrl = url || `local://${path.basename(videoPath!)}`;
                const newProject = await createProject(videoInfo, projectUrl);
                currentProjectId = newProject.id;
            }
        }

        // Process all clips
        const results = await processAllClips(
            finalVideoPath,
            clips,
            transcript
        );

        // Add successful clips to project with metadata
        const successes = results.filter(r => !r.error);
        for (const result of successes) {
            const clipFilename = path.basename(result.outputPath);
            const clip = clips.find(c => c.id === result.clipId);
            if (clipFilename && currentProjectId && clip) {
                await addClipToProject(currentProjectId, clipFilename, {
                    title: clip.title,
                    hook: clip.hookStatement,
                    hookTimestamp: clip.hookStartTime && clip.hookEndTime
                        ? `[${formatTime(clip.hookStartTime)}] - [${formatTime(clip.hookEndTime)}]`
                        : undefined,
                    content: clip.description,
                    timestamp: `[${formatTime(clip.startTime)}] - [${formatTime(clip.endTime)}]`,
                    duration: clip.duration,
                });
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
                    downloadUrl: r.outputPath ? `/api/clips/${encodeURIComponent(path.basename(r.outputPath))}` : null,
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
