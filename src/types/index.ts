// Clip recommendation from Gemini AI
export interface ClipRecommendation {
    id: string;
    title: string;
    description: string;
    startTime: number; // in seconds
    endTime: number; // in seconds
    duration: number; // in seconds
    hookStatement: string;
    viralScore: number; // 1-10
    transcript: string;
    hookStartTime?: number; // Optional hook start time in seconds
    hookEndTime?: number; // Optional hook end time in seconds
}

// Video information from YouTube
export interface VideoInfo {
    id: string;
    title: string;
    description: string;
    duration: number; // in seconds
    thumbnail: string;
    channelName: string;
    viewCount: number;
    publishedAt: string;
}

// Transcript segment
export interface TranscriptSegment {
    text: string;
    start: number; // in seconds
    duration: number; // in seconds
}

// Full transcript
export interface Transcript {
    segments: TranscriptSegment[];
    fullText: string;
    language: string;
}

// Processing job
export interface ProcessingJob {
    id: string;
    videoId: string;
    videoInfo: VideoInfo;
    status: 'pending' | 'downloading' | 'analyzing' | 'processing' | 'rendering' | 'completed' | 'error';
    progress: number; // 0-100
    clips: ClipJob[];
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}

// Individual clip job
export interface ClipJob {
    id: string;
    recommendation: ClipRecommendation;
    status: 'pending' | 'cutting' | 'framing' | 'captioning' | 'rendering' | 'completed' | 'error';
    progress: number;
    outputPath?: string;
    error?: string;
}

// API Response types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// Caption style options
export interface CaptionStyle {
    fontFamily: string;
    fontSize: number;
    fontColor: string;
    backgroundColor: string;
    position: 'top' | 'center' | 'bottom';
    animation: 'none' | 'fade' | 'word-highlight' | 'karaoke';
}

// Video processing options
export interface ProcessingOptions {
    outputFormat: 'mp4';
    outputResolution: '1080x1920'; // Portrait 1080p
    outputFps: 30;
    captionStyle: CaptionStyle;
    smartFraming: boolean;
}

// Store state
export interface ClipStore {
    currentJob: ProcessingJob | null;
    jobs: ProcessingJob[];
    isProcessing: boolean;

    // Actions
    setCurrentJob: (job: ProcessingJob | null) => void;
    addJob: (job: ProcessingJob) => void;
    updateJob: (id: string, updates: Partial<ProcessingJob>) => void;
    updateClip: (jobId: string, clipId: string, updates: Partial<ClipJob>) => void;
    setProcessing: (value: boolean) => void;
}

// Detailed transcript analysis types
export interface CrucialPart {
    id: string;
    title: string;
    quote: string;
    timestamp?: string; // Optional timestamp like [00:11:28]
}

export interface ClippingIdea {
    id: string;
    title: string;
    suggestedTitle: string;
    timestamp: string; // e.g., "[00:11:28] - [00:12:00]"
    startTime: number; // in seconds
    endTime: number; // in seconds
    duration: number; // in seconds
    hook: string;
    hookTimestamp?: string; // e.g., "[00:05:30] - [00:05:45]"
    hookStartTime?: number; // Optional hook start time in seconds
    hookEndTime?: number; // Optional hook end time in seconds
    hookIsNotAtStart?: boolean; // True if hook timestamp differs from clip start time
    content: string;
    reason?: string;
}

export interface TranscriptAnalysis {
    crucialParts: CrucialPart[];
    clippingIdeas: ClippingIdea[];
    videoLink: string;
    summary?: string;
}

// Project/Source video for clip library
export interface ClipProject {
    id: string;
    youtubeUrl: string;
    videoId: string;
    title: string;
    thumbnail: string;
    channelName: string;
    createdAt: string;
    clips: string[]; // List of clip filenames
}

// Saved clip with project reference
export interface SavedClip {
    filename: string;
    path: string;
    size: number;
    createdAt: string;
    projectId?: string;
    downloadUrl: string;
}

// Projects metadata file structure
export interface ProjectsMetadata {
    projects: ClipProject[];
}
