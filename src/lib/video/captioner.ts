import path from 'path';
import fs from 'fs/promises';
import { TranscriptSegment } from '@/types';

const TEMP_DIR = path.join(process.cwd(), 'temp');

/**
 * Generate SRT file from transcript segments
 */
export async function generateSrt(
    segments: TranscriptSegment[],
    startOffset: number,
    endTime: number,
    outputPath: string
): Promise<void> {
    const filteredSegments = segments.filter(
        seg => seg.start >= startOffset && seg.start < endTime
    );

    let srtContent = '';
    let counter = 1;

    for (const segment of filteredSegments) {
        // Adjust timing relative to clip start
        const adjustedStart = segment.start - startOffset;
        const adjustedEnd = adjustedStart + segment.duration;

        const startTimestamp = formatSrtTimestamp(adjustedStart);
        const endTimestamp = formatSrtTimestamp(adjustedEnd);

        srtContent += `${counter}\n`;
        srtContent += `${startTimestamp} --> ${endTimestamp}\n`;
        srtContent += `${segment.text}\n\n`;
        counter++;
    }

    await fs.writeFile(outputPath, srtContent, 'utf-8');
}

/**
 * Generate word-by-word SRT for karaoke effect
 */
export async function generateWordByWordSrt(
    segments: TranscriptSegment[],
    startOffset: number,
    endTime: number,
    outputPath: string
): Promise<void> {
    const filteredSegments = segments.filter(
        seg => seg.start >= startOffset && seg.start < endTime
    );

    let srtContent = '';
    let counter = 1;

    for (const segment of filteredSegments) {
        const words = segment.text.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) continue;

        const wordDuration = segment.duration / words.length;
        const segmentStart = segment.start - startOffset;

        for (let i = 0; i < words.length; i++) {
            const wordStart = segmentStart + (i * wordDuration);
            const wordEnd = wordStart + wordDuration;

            // Create highlighted version (current word in different style)
            const highlightedText = words.map((w, idx) =>
                idx === i ? `<font color="#FFFF00">${w}</font>` : w
            ).join(' ');

            srtContent += `${counter}\n`;
            srtContent += `${formatSrtTimestamp(wordStart)} --> ${formatSrtTimestamp(wordEnd)}\n`;
            srtContent += `${highlightedText}\n\n`;
            counter++;
        }
    }

    await fs.writeFile(outputPath, srtContent, 'utf-8');
}

/**
 * Format timestamp for SRT (HH:MM:SS,mmm)
 */
function formatSrtTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

/**
 * Generate ASS subtitle file with advanced styling
 */
export async function generateAssSubtitles(
    segments: TranscriptSegment[],
    startOffset: number,
    endTime: number,
    outputPath: string,
    style?: {
        fontName?: string;
        fontSize?: number;
        primaryColor?: string;
        outlineColor?: string;
        animation?: 'none' | 'fade' | 'pop';
    }
): Promise<void> {
    const {
        fontName = 'Arial',
        fontSize = 48,
        primaryColor = '&HFFFFFF',
        outlineColor = '&H000000',
        animation = 'none'
    } = style || {};

    const filteredSegments = segments.filter(
        seg => seg.start >= startOffset && seg.start < endTime
    );

    let assContent = `[Script Info]
Title: Auto-generated subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},&H000000FF,${outlineColor},&H80000000,1,0,0,0,100,100,0,0,1,3,2,2,40,40,100,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    for (const segment of filteredSegments) {
        const adjustedStart = segment.start - startOffset;
        const adjustedEnd = adjustedStart + segment.duration;

        const startTimestamp = formatAssTimestamp(adjustedStart);
        const endTimestamp = formatAssTimestamp(adjustedEnd);

        let text = segment.text;

        // Add animation effects
        if (animation === 'fade') {
            text = `{\\fad(200,200)}${text}`;
        } else if (animation === 'pop') {
            text = `{\\t(0,100,\\fscx110\\fscy110)\\t(100,200,\\fscx100\\fscy100)}${text}`;
        }

        assContent += `Dialogue: 0,${startTimestamp},${endTimestamp},Default,,0,0,0,,${text}\n`;
    }

    await fs.writeFile(outputPath, assContent, 'utf-8');
}

/**
 * Format timestamp for ASS (H:MM:SS.cc)
 */
function formatAssTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const centis = Math.round((seconds % 1) * 100);

    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
}
