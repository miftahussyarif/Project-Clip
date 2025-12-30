import { exec } from 'child_process';
import { promisify } from 'util';
import { Transcript, TranscriptSegment } from '@/types';
import { parseYouTubeUrl } from './parser';

const execAsync = promisify(exec);
const YT_DLP = '/usr/local/bin/yt-dlp'; // Use explicit path for latest version

/**
 * Get transcript/subtitles from YouTube video using yt-dlp
 */
export async function getTranscript(url: string): Promise<Transcript> {
    const videoId = parseYouTubeUrl(url);
    if (!videoId) {
        throw new Error('Invalid YouTube URL');
    }

    try {
        // Try to get auto-generated subtitles first, then manual
        const { stdout } = await execAsync(
            `${YT_DLP} --write-auto-sub --write-sub --sub-lang en,id --skip-download --sub-format json3 --print-json "https://www.youtube.com/watch?v=${videoId}" 2>/dev/null || echo "{}"`,
            { maxBuffer: 10 * 1024 * 1024 }
        );

        // Parse the JSON output to get subtitle info
        let subtitleData;
        try {
            subtitleData = JSON.parse(stdout);
        } catch {
            subtitleData = {};
        }

        // Try to extract subtitles from automatic_captions or subtitles
        const captions = subtitleData.automatic_captions || subtitleData.subtitles || {};

        // Prefer English, fallback to Indonesian, then any available
        const langPriority = ['en', 'id', 'en-US', 'en-GB'];
        let selectedLang = '';
        let subtitleUrl = '';

        for (const lang of langPriority) {
            if (captions[lang]) {
                selectedLang = lang;
                // Find json3 format or vtt
                const formats = captions[lang];
                const json3 = formats.find((f: { ext: string }) => f.ext === 'json3');
                const vtt = formats.find((f: { ext: string }) => f.ext === 'vtt');
                subtitleUrl = json3?.url || vtt?.url || formats[0]?.url;
                break;
            }
        }

        if (!subtitleUrl && Object.keys(captions).length > 0) {
            selectedLang = Object.keys(captions)[0];
            const formats = captions[selectedLang];
            subtitleUrl = formats[0]?.url;
        }

        if (!subtitleUrl) {
            // Try alternative method using youtube-transcript-api equivalent
            return await getTranscriptFallback(videoId);
        }

        // Fetch the subtitle content
        const response = await fetch(subtitleUrl);
        const subtitleContent = await response.text();

        // Parse based on format
        if (subtitleUrl.includes('json3')) {
            return parseJson3Transcript(subtitleContent, selectedLang);
        } else {
            return parseVttTranscript(subtitleContent, selectedLang);
        }
    } catch (error) {
        console.error('Error getting transcript:', error);
        return await getTranscriptFallback(videoId);
    }
}

/**
 * Fallback method to get transcript using yt-dlp subtitle download
 */
async function getTranscriptFallback(videoId: string): Promise<Transcript> {
    try {
        // Use yt-dlp to download subtitles to a temp file
        const tempFile = `/tmp/${videoId}_subs`;

        await execAsync(
            `${YT_DLP} --write-auto-sub --write-sub --sub-lang en,id --skip-download --convert-subs srt -o "${tempFile}" "https://www.youtube.com/watch?v=${videoId}" 2>/dev/null`,
            { maxBuffer: 10 * 1024 * 1024 }
        );

        // Try to read the subtitle file
        const { stdout: srtContent } = await execAsync(`cat ${tempFile}*.srt 2>/dev/null || echo ""`);

        if (srtContent) {
            // Clean up
            await execAsync(`rm -f ${tempFile}*.srt ${tempFile}*.vtt 2>/dev/null`);
            return parseSrtTranscript(srtContent, 'en');
        }

        throw new Error('No subtitles available');
    } catch (error) {
        console.error('Fallback transcript error:', error);
        return {
            segments: [],
            fullText: '',
            language: 'unknown'
        };
    }
}

/**
 * Parse JSON3 subtitle format
 */
function parseJson3Transcript(content: string, language: string): Transcript {
    try {
        const data = JSON.parse(content);
        const segments: TranscriptSegment[] = [];

        if (data.events) {
            for (const event of data.events) {
                if (event.segs) {
                    const text = event.segs.map((s: { utf8: string }) => s.utf8 || '').join('');
                    if (text.trim()) {
                        segments.push({
                            text: text.trim(),
                            start: (event.tStartMs || 0) / 1000,
                            duration: (event.dDurationMs || 0) / 1000
                        });
                    }
                }
            }
        }

        return {
            segments,
            fullText: segments.map(s => s.text).join(' '),
            language
        };
    } catch {
        return { segments: [], fullText: '', language };
    }
}

/**
 * Parse VTT subtitle format
 */
function parseVttTranscript(content: string, language: string): Transcript {
    const segments: TranscriptSegment[] = [];
    const lines = content.split('\n');
    let currentSegment: Partial<TranscriptSegment> = {};

    for (const line of lines) {
        // Match timestamp line: 00:00:00.000 --> 00:00:05.000
        const timestampMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);

        if (timestampMatch) {
            const start = parseTimestamp(timestampMatch[1]);
            const end = parseTimestamp(timestampMatch[2]);
            currentSegment = {
                start,
                duration: end - start
            };
        } else if (line.trim() && !line.startsWith('WEBVTT') && !line.match(/^\d+$/)) {
            // This is text content
            const cleanText = line.replace(/<[^>]*>/g, '').trim();
            if (cleanText && currentSegment.start !== undefined) {
                segments.push({
                    text: cleanText,
                    start: currentSegment.start,
                    duration: currentSegment.duration || 0
                });
            }
        }
    }

    return {
        segments,
        fullText: segments.map(s => s.text).join(' '),
        language
    };
}

/**
 * Parse SRT subtitle format
 */
function parseSrtTranscript(content: string, language: string): Transcript {
    const segments: TranscriptSegment[] = [];
    const blocks = content.split(/\n\n+/);

    for (const block of blocks) {
        const lines = block.trim().split('\n');
        if (lines.length >= 2) {
            // Find timestamp line
            const timestampLine = lines.find(l => l.includes('-->'));
            if (timestampLine) {
                const timestampMatch = timestampLine.match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/);
                if (timestampMatch) {
                    const start = parseTimestamp(timestampMatch[1].replace(',', '.'));
                    const end = parseTimestamp(timestampMatch[2].replace(',', '.'));

                    // Get text lines (everything after timestamp)
                    const textStartIndex = lines.indexOf(timestampLine) + 1;
                    const text = lines.slice(textStartIndex).join(' ').replace(/<[^>]*>/g, '').trim();

                    if (text) {
                        segments.push({
                            text,
                            start,
                            duration: end - start
                        });
                    }
                }
            }
        }
    }

    return {
        segments,
        fullText: segments.map(s => s.text).join(' '),
        language
    };
}

/**
 * Parse timestamp string to seconds
 */
function parseTimestamp(timestamp: string): number {
    const parts = timestamp.split(':');
    if (parts.length === 3) {
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        const seconds = parseFloat(parts[2]);
        return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
}
