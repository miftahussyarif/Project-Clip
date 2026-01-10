import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { ClipRecommendation, ProcessingJob, ClipJob, Transcript, ClipProject, ProjectsMetadata, VideoInfo, ClipMetadata } from '@/types';
import { processClipComplete, checkFFmpeg } from '@/lib/utils/ffmpeg';
import { generateSrt } from './captioner';
import { ensureDir, sanitizeFileName } from '@/lib/utils/helpers';

const TEMP_DIR = path.join(process.cwd(), 'temp');
const OUTPUT_DIR = path.join(process.cwd(), 'output');

/**
 * Process all clips for a video
 */
export async function processAllClips(
    videoPath: string,
    clips: ClipRecommendation[],
    transcript: Transcript,
    onProgress?: (clipId: string, progress: number, status: string) => void
): Promise<{ clipId: string; outputPath: string; error?: string }[]> {
    // Check FFmpeg
    const ffmpegAvailable = await checkFFmpeg();
    if (!ffmpegAvailable) {
        throw new Error('FFmpeg is not installed. Please install FFmpeg to process videos.');
    }

    await ensureDir(TEMP_DIR);
    await ensureDir(OUTPUT_DIR);

    const results: { clipId: string; outputPath: string; error?: string }[] = [];

    for (const clip of clips) {
        try {
            onProgress?.(clip.id, 10, 'Preparing...');

            // Only generate SRT if transcript has segments
            let srtPath: string | undefined;
            const hasTranscript = transcript.segments && transcript.segments.length > 0;

            if (hasTranscript) {
                srtPath = path.join(TEMP_DIR, `${clip.id}.srt`);
                await generateSrt(
                    transcript.segments,
                    clip.startTime,
                    clip.endTime,
                    srtPath
                );
            }

            onProgress?.(clip.id, 30, 'Processing video...');

            // Generate output filename
            const sanitizedTitle = sanitizeFileName(clip.title);
            const outputFileName = `${sanitizedTitle}_${clip.id.substring(0, 8)}.mp4`;
            const outputPath = path.join(OUTPUT_DIR, outputFileName);

            // Process the clip using startTime to endTime
            // Hook timestamps are stored as metadata only, not used for cutting
            await processClipComplete(
                videoPath,
                outputPath,
                clip.startTime,
                clip.endTime,
                srtPath, // Will be undefined if no transcript
                0.5 // Center focus for now
            );

            onProgress?.(clip.id, 90, 'Finalizing...');

            // Cleanup temp SRT if it was created
            if (srtPath) {
                try {
                    await fs.unlink(srtPath);
                } catch {
                    // Ignore cleanup errors
                }
            }

            onProgress?.(clip.id, 100, 'Completed');

            results.push({
                clipId: clip.id,
                outputPath,
            });

            // Add 1 second delay before processing next clip to reduce memory pressure
            // and allow each clip to be ready for download immediately
            if (clips.indexOf(clip) < clips.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error(`Error processing clip ${clip.id}:`, error);
            results.push({
                clipId: clip.id,
                outputPath: '',
                error: (error as Error).message,
            });
            onProgress?.(clip.id, 0, 'Error');
        }
    }

    return results;
}

/**
 * Process a single clip
 */
export async function processSingleClip(
    videoPath: string,
    clip: ClipRecommendation,
    transcript: Transcript,
    onProgress?: (progress: number, status: string) => void
): Promise<string> {
    const ffmpegAvailable = await checkFFmpeg();
    if (!ffmpegAvailable) {
        throw new Error('FFmpeg is not installed. Please install FFmpeg to process videos.');
    }

    await ensureDir(TEMP_DIR);
    await ensureDir(OUTPUT_DIR);

    onProgress?.(10, 'Generating captions...');

    // Generate SRT for this clip
    const srtPath = path.join(TEMP_DIR, `${clip.id}.srt`);
    await generateSrt(
        transcript.segments,
        clip.startTime,
        clip.endTime,
        srtPath
    );

    onProgress?.(30, 'Processing video...');

    // Generate output filename
    const sanitizedTitle = sanitizeFileName(clip.title);
    const outputFileName = `${sanitizedTitle}_${clip.id.substring(0, 8)}.mp4`;
    const outputPath = path.join(OUTPUT_DIR, outputFileName);

    // Process the clip
    await processClipComplete(
        videoPath,
        outputPath,
        clip.startTime,
        clip.endTime,
        srtPath,
        0.5
    );

    onProgress?.(90, 'Finalizing...');

    // Cleanup temp SRT
    try {
        await fs.unlink(srtPath);
    } catch {
        // Ignore cleanup errors
    }

    onProgress?.(100, 'Completed');

    return outputPath;
}

/**
 * Get list of processed clips
 */
export async function getProcessedClips(): Promise<{
    filename: string;
    path: string;
    size: number;
    createdAt: Date;
}[]> {
    await ensureDir(OUTPUT_DIR);

    const files = await fs.readdir(OUTPUT_DIR);
    const clips = [];

    for (const file of files) {
        if (file.endsWith('.mp4')) {
            const filePath = path.join(OUTPUT_DIR, file);
            const stats = await fs.stat(filePath);
            clips.push({
                filename: file,
                path: filePath,
                size: stats.size,
                createdAt: stats.birthtime,
            });
        }
    }

    return clips.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Delete a processed clip
 */
export async function deleteClip(filename: string): Promise<void> {
    const filePath = path.join(OUTPUT_DIR, filename);
    await fs.unlink(filePath);
}

/**
 * Get clip file path
 */
export function getClipPath(filename: string): string {
    return path.join(OUTPUT_DIR, filename);
}

const PROJECTS_FILE = path.join(OUTPUT_DIR, 'projects.json');

/**
 * Get all projects from metadata file
 */
export async function getProjects(): Promise<ClipProject[]> {
    await ensureDir(OUTPUT_DIR);

    try {
        const data = await fs.readFile(PROJECTS_FILE, 'utf-8');
        const metadata: ProjectsMetadata = JSON.parse(data);
        return metadata.projects || [];
    } catch {
        // File doesn't exist or is invalid, return empty array
        return [];
    }
}

/**
 * Save projects to metadata file
 */
async function saveProjects(projects: ClipProject[]): Promise<void> {
    await ensureDir(OUTPUT_DIR);
    const metadata: ProjectsMetadata = { projects };
    await fs.writeFile(PROJECTS_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
}

/**
 * Create a new project from video info
 */
export async function createProject(videoInfo: VideoInfo, youtubeUrl: string): Promise<ClipProject> {
    const projects = await getProjects();

    // Check if project already exists for this video
    const existingProject = projects.find(p => p.videoId === videoInfo.id);
    if (existingProject) {
        return existingProject;
    }

    const newProject: ClipProject = {
        id: uuidv4(),
        youtubeUrl,
        videoId: videoInfo.id,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        channelName: videoInfo.channelName,
        createdAt: new Date().toISOString(),
        clips: [],
    };

    projects.push(newProject);
    await saveProjects(projects);

    return newProject;
}

/**
 * Add a clip to an existing project with optional metadata
 */
export async function addClipToProject(projectId: string, clipFilename: string, metadata?: ClipMetadata): Promise<void> {
    const projects = await getProjects();
    const project = projects.find(p => p.id === projectId);

    if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
    }

    if (!project.clips.includes(clipFilename)) {
        project.clips.push(clipFilename);
    }

    // Store metadata if provided
    if (metadata) {
        if (!project.clipMetadata) {
            project.clipMetadata = {};
        }
        project.clipMetadata[clipFilename] = metadata;
    }

    await saveProjects(projects);
}

/**
 * Get project by ID
 */
export async function getProjectById(id: string): Promise<ClipProject | null> {
    const projects = await getProjects();
    return projects.find(p => p.id === id) || null;
}

/**
 * Get project by video ID
 */
export async function getProjectByVideoId(videoId: string): Promise<ClipProject | null> {
    const projects = await getProjects();
    return projects.find(p => p.videoId === videoId) || null;
}

/**
 * Get processed clips grouped by project
 */
export async function getProcessedClipsGroupedByProject(): Promise<{
    projects: (ClipProject & { clipDetails: { filename: string; size: number; createdAt: Date; downloadUrl: string; metadata?: ClipMetadata }[] })[];
    uncategorizedClips: { filename: string; size: number; createdAt: Date; downloadUrl: string }[];
}> {
    await ensureDir(OUTPUT_DIR);

    const projects = await getProjects();
    const files = await fs.readdir(OUTPUT_DIR);
    const clipFiles = files.filter(f => f.endsWith('.mp4'));

    // Get all clip filenames from projects
    const categorizedClips = new Set<string>();
    projects.forEach(p => p.clips.forEach(c => categorizedClips.add(c)));

    // Build project list with clip details
    const projectsWithDetails = await Promise.all(projects.map(async (project) => {
        const clipDetails = await Promise.all(
            project.clips
                .filter(clipFilename => clipFiles.includes(clipFilename))
                .map(async (clipFilename) => {
                    const filePath = path.join(OUTPUT_DIR, clipFilename);
                    try {
                        const stats = await fs.stat(filePath);
                        return {
                            filename: clipFilename,
                            size: stats.size,
                            createdAt: stats.birthtime,
                            downloadUrl: `/api/clips/${encodeURIComponent(clipFilename)}`,
                            metadata: project.clipMetadata?.[clipFilename],
                        };
                    } catch {
                        return null;
                    }
                })
        );

        return {
            ...project,
            clipDetails: clipDetails.filter((c): c is NonNullable<typeof c> => c !== null),
        };
    }));

    // Find uncategorized clips
    const uncategorizedClips = await Promise.all(
        clipFiles
            .filter(f => !categorizedClips.has(f))
            .map(async (filename) => {
                const filePath = path.join(OUTPUT_DIR, filename);
                const stats = await fs.stat(filePath);
                return {
                    filename,
                    size: stats.size,
                    createdAt: stats.birthtime,
                    downloadUrl: `/api/clips/${encodeURIComponent(filename)}`,
                };
            })
    );

    return {
        projects: projectsWithDetails.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
        uncategorizedClips: uncategorizedClips.sort((a, b) =>
            b.createdAt.getTime() - a.createdAt.getTime()
        ),
    };
}

/**
 * Delete a project (clips are kept and become uncategorized)
 */
export async function deleteProject(projectId: string): Promise<void> {
    const projects = await getProjects();
    const projectIndex = projects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) {
        throw new Error(`Project with ID ${projectId} not found`);
    }

    // Remove the project from the list (clips remain in output folder as uncategorized)
    projects.splice(projectIndex, 1);
    await saveProjects(projects);
}
