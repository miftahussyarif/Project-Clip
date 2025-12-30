/**
 * Parse YouTube URL to extract video ID
 */
export function parseYouTubeUrl(url: string): string | null {
    const patterns = [
        // Standard watch URL: https://www.youtube.com/watch?v=VIDEO_ID
        /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        // Short URL: https://youtu.be/VIDEO_ID
        /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        // Embed URL: https://www.youtube.com/embed/VIDEO_ID
        /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        // Mobile URL: https://m.youtube.com/watch?v=VIDEO_ID
        /(?:m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        // Shorts URL: https://www.youtube.com/shorts/VIDEO_ID
        /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        // Live URL: https://www.youtube.com/live/VIDEO_ID
        /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    // Check if the input is already a video ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
        return url;
    }

    return null;
}

/**
 * Validate if a string is a valid YouTube URL or video ID
 */
export function isValidYouTubeUrl(url: string): boolean {
    return parseYouTubeUrl(url) !== null;
}

/**
 * Get thumbnail URL from video ID
 */
export function getThumbnailUrl(videoId: string, quality: 'default' | 'medium' | 'high' | 'maxres' = 'maxres'): string {
    const qualityMap = {
        default: 'default',
        medium: 'mqdefault',
        high: 'hqdefault',
        maxres: 'maxresdefault',
    };
    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

/**
 * Format duration from seconds to HH:MM:SS
 */
export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format timestamp for FFmpeg (HH:MM:SS.mmm)
 */
export function formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
}
