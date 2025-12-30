import { NextRequest, NextResponse } from 'next/server';
import { ClippingIdea } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Parse timestamp string to seconds
 * Supports formats: [00:11:28], 00:11:28, [11:28], 11:28
 */
function parseTimestamp(timestamp: string): number {
    // Remove brackets
    const clean = timestamp.replace(/[\[\]]/g, '').trim();
    const parts = clean.split(':').map(p => parseInt(p, 10));

    if (parts.length === 3) {
        // HH:MM:SS
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        // MM:SS
        return parts[0] * 60 + parts[1];
    }
    return 0;
}

/**
 * Extract clipping ideas from manually inputted analysis text
 * Supports multiple formats including:
 * - Standard format: **Timestamp:** [00:11:28] - [00:12:00]
 * - Indonesian format: Timeline Full Clip: [00:11:28] s.d. [00:12:03]
 * - Markdown format with Detail Hook section:
 *   * **Timeline Full Clip:** `[00:02:40]` – `[00:03:10]`
 *   * **Detail Hook:**
 *     * **Timestamp Hook:** `[00:02:40]` – `[00:02:50]`
 *     * **Text Hook:** *"..."*
 * - Plain text format (numbered list):
 *   1. Clip: Title (Category)
 *   Judul Clip: Title Here
 *   Durasi: ± 30 Detik
 *   Timeline Full Clip: [00:02:40] – [00:03:10]
 *   Detail Hook:
 *   Timestamp Hook: [00:02:40] – [00:02:50]
 *   Text Hook: "..."
 */
function parseManualAnalysis(text: string): ClippingIdea[] {
    const clips: ClippingIdea[] = [];

    // Pattern to match clip sections
    // Support formats like:
    // #### **1. Clip: Title (Category)**
    // #### Clip 1: Title
    // Clip 1: "Title"
    // Clip: Title
    // 1. Clip: Title (plain text format)

    // Split by clip sections - improved to handle markdown headers with #### **1. Clip:
    const clipSections = text.split(/(?=#{1,4}\s*\*{0,2}\s*\d+\.\s*Clip\s*:)|(?=(?<!#)\d+\.\s*Clip\s*:)/im);

    for (const section of clipSections) {
        if (!section.trim()) continue;

        // Skip section if it doesn't contain any timestamp-like pattern
        if (!/\d{1,2}:\d{2}/.test(section)) continue;

        try {
            // Extract suggested title from "* **Judul Clip:** Title" or "Judul Clip: Title"
            // Priority: Judul Clip > Judul Ide > Judul > header title
            const suggestedTitleMatch =
                // Bullet with bold: * **Judul Clip:** Title (most specific first)
                section.match(/\*\s*\*\*Judul\s*Clip\s*:\*\*\s*(.+?)(?:\n|$)/i) ||
                // Bold only: **Judul Clip:** Title
                section.match(/\*\*Judul\s*Clip\s*:\*\*\s*(.+?)(?:\n|$)/i) ||
                // Plain text format: Judul Clip: Title (or variations with spaces/underscores)
                section.match(/Judul[\s_]*Clip[\s_]*[:：]\s*([^\n]+)/i) ||
                // Judul Ide format - bullet with bold
                section.match(/\*\s*\*\*Judul\s*Ide\s*:\*\*\s*(.+?)(?:\n|$)/i) ||
                // Judul Ide format - bold only
                section.match(/\*\*Judul\s*Ide\s*:\*\*\s*(.+?)(?:\n|$)/i) ||
                // Judul Ide format - plain text
                section.match(/Judul[\s_]*Ide[\s_]*[:：]\s*([^\n]+)/i);

            // Clean title: remove quotes, asterisks, backticks and trailing period
            const suggestedTitle = suggestedTitleMatch?.[1]?.replace(/["""*`]/g, '').replace(/\.\s*$/, '').trim() || '';

            // Extract title from header: #### **1. Clip: Title (Category)** OR plain: 1. Clip: Title (Category)
            const headerMatch =
                // Markdown header format: #### **1. Clip: Title**
                section.match(/^#{1,4}\s*\*{0,2}\s*\d+\.\s*Clip\s*:\s*(.+?)(?:\*{0,2}\s*$|\n)/im) ||
                // Plain numbered format: 1. Clip: Title (Category)
                section.match(/^\d+\.\s*Clip\s*:\s*(.+?)(?:\n|$)/im);
            let title = headerMatch?.[1]?.replace(/["""*]/g, '').trim() || '';

            // If title contains pattern like "Title (Category)", extract just the title
            const parenthesisMatch = title.match(/^(.+?)\s*\([^)]+\)\s*$/);
            if (parenthesisMatch) {
                title = parenthesisMatch[1].trim();
            }

            // Always prioritize suggestedTitle (Judul Clip) if available
            if (suggestedTitle) {
                title = suggestedTitle;
            } else if (!title) {
                title = 'Untitled Clip';
            }

            // Extract timestamp - support multiple formats with backticks and plain text:
            // - * **Timeline Full Clip:** `[00:02:40]` – `[00:03:15]` (markdown with bullet and backticks)
            // - **Timeline Full Clip:** `[00:11:28]` – `[00:12:03]` (markdown with backticks)
            // - **Estimasi Timeline Full Clip:** `[02:10]` – `[02:55]` (markdown)
            // - Timeline Full Clip: [00:16:09] – [00:16:44] (plain text)
            // - `[00:11:28]` – `[00:12:03]`
            const timestampMatch =
                // Bullet + Bold + Backticks: * **Timeline Full Clip:** `[00:02:40]` – `[00:03:15]`
                section.match(/\*\s*\*\*(?:Estimasi\s*)?Timeline\s*Full\s*Clip\s*:\*\*\s*`\[(\d{1,2}:\d{2}(?::\d{2})?)\]`\s*[-–—]\s*`\[(\d{1,2}:\d{2}(?::\d{2})?)\]`/i) ||
                // Bold + Backticks: **Timeline Full Clip:** `[00:02:40]` – `[00:03:15]`
                section.match(/\*\*(?:Estimasi\s*)?Timeline\s*Full\s*Clip\s*:\*\*\s*`\[(\d{1,2}:\d{2}(?::\d{2})?)\]`\s*[-–—]\s*`\[(\d{1,2}:\d{2}(?::\d{2})?)\]`/i) ||
                // General format with optional backticks and brackets
                section.match(/(?:Estimasi\s*)?Timeline\s*Full\s*Clip\s*:?\*?\*?\s*`?\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?`?\s*[-–—]\s*`?\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?`?/i) ||
                // **Timestamp:** format with backticks
                section.match(/\*\*Timestamp\s*:\*\*\s*`?\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?`?\s*[-–—]\s*`?\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?`?/i) ||
                // Plain timestamp format
                section.match(/Timestamp\s*:\s*`?\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?`?\s*[-–—]\s*`?\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?`?/i) ||
                // Bracket format with s.d. or dashes
                section.match(/`?\[(\d{1,2}:\d{2}(?::\d{2})?)\]`?\s*(?:s\.?d\.?|[-–—])\s*`?\[(\d{1,2}:\d{2}(?::\d{2})?)\]`?/);

            if (!timestampMatch) continue; // Skip if no timestamp found

            const startTime = parseTimestamp(timestampMatch[1]);
            const endTime = parseTimestamp(timestampMatch[2]);

            if (startTime >= endTime) continue; // Skip invalid timestamps

            // Extract duration - support multiple formats:
            // - Plain text: Durasi: ± 30 Detik (new format)
            // - Bullet/bold: * **Durasi:** ± 35 Detik
            // - Also supports: Durasi Total:, Durasi Clip:
            const durationMatch =
                // Plain text format (new): Durasi: ± 30 Detik
                section.match(/^Durasi\s*:\s*[±~≈]?\s*(\d+)\s*(?:detik|seconds|sec|s)/im) ||
                // Markdown format: * **Durasi:** ± 35 Detik
                section.match(/(?:\*\s*)?\*\*Durasi\s*(?:Total|Clip)?\s*:\*\*\s*[±~≈]?\s*(\d+)\s*(?:detik|seconds|sec|s)/i) ||
                // Plain inline format
                section.match(/Durasi\s*(?:Total|Clip)?\s*:\s*[±~≈]?\s*(\d+)\s*(?:detik|seconds|sec|s)/i);
            const duration = durationMatch ? parseInt(durationMatch[1], 10) : (endTime - startTime);

            // Extract hook text - support italic format: * **Text Hook:** *"..."* and plain: Text Hook: "..."
            const hookMatch =
                // Bullet with bold and italic: * **Text Hook:** *"..."*
                section.match(/\*\s*\*\*Text\s*Hook\s*:\*\*\s*\*[""](.+?)[""]\*(?:\n|$)/i) ||
                // Bullet with bold: * **Text Hook:** *"..."* (without closing italic)
                section.match(/\*\s*\*\*Text\s*Hook\s*:\*\*\s*\*?[""]?(.+?)[""]?\*?(?:\n|$)/i) ||
                // Bold with italic: **Text Hook:** *"..."*
                section.match(/\*\*Text\s*Hook\s*:\*\*\s*\*[""](.+?)[""]\*(?:\n|$)/i) ||
                // Bold only: **Text Hook:** "..."
                section.match(/\*\*Text\s*Hook\s*:\*\*\s*\*?[""]?(.+?)[""]?\*?(?:\n|$)/i) ||
                // Plain text format with quotes: Text Hook: "..."
                section.match(/^Text\s*Hook\s*:\s*\*?[""](.+?)[""]?\*?(?:\n|$)/im) ||
                // Plain: Text Hook: text
                section.match(/Text\s*Hook\s*:\s*\*?[""]?(.+?)[""]?\*?(?:\n|$)/i) ||
                // Kalimat Hook format - bullet with bold
                section.match(/\*\s*\*\*(?:Kalimat\s*)?Hook\s*:\*\*\s*\*?[""]?(.+?)[""]?\*?(?:\n|$)/i) ||
                // Kalimat Hook format - plain
                section.match(/(?:Kalimat\s*)?Hook\s*:\s*\*?[""]?(.+?)[""]?\*?(?:\n|$)/i);
            const hook = hookMatch?.[1]?.replace(/[""\"*]/g, '').trim() || '';

            // Extract hook timestamp - support bullet/bold format with backticks and plain text
            // * **Timestamp Hook:** `[00:02:43]` – `[00:02:53]`
            // * **Timestamp Hook:** Cari di area `[02:10]` – `[02:15]`
            // Timestamp Hook: [00:02:40] – [00:02:50] (plain format)
            const hookTimestampMatch =
                // Bullet + Bold + Backticks: * **Timestamp Hook:** `[00:02:43]` – `[00:02:53]`
                section.match(/\*\s*\*\*Timestamp\s*Hook\s*:\*\*\s*(?:Cari\s*di\s*area\s*)?`\[(\d{1,2}:\d{2}(?::\d{2})?)\]`\s*[-–—]\s*`\[(\d{1,2}:\d{2}(?::\d{2})?)\]`/i) ||
                // Bold + Backticks: **Timestamp Hook:** `[00:02:43]` – `[00:02:53]`
                section.match(/\*\*Timestamp\s*Hook\s*:\*\*\s*(?:Cari\s*di\s*area\s*)?`\[(\d{1,2}:\d{2}(?::\d{2})?)\]`\s*[-–—]\s*`\[(\d{1,2}:\d{2}(?::\d{2})?)\]`/i) ||
                // General with optional backticks: Timestamp Hook: `[...]` – `[...]` or [...]–[...]
                section.match(/Timestamp\s*Hook\s*:?\*?\*?\s*(?:Cari\s*di\s*area\s*)?`?\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?`?\s*[-–—]\s*`?\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?`?/i) ||
                // Hook Timestamp alternative order
                section.match(/Hook\s*Timestamp\s*:\s*(?:Cari\s*di\s*area\s*)?`?\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?`?\s*[-–—]\s*`?\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?`?/i);

            let hookTimestamp: string | undefined;
            let hookStartTime: number | undefined;
            let hookEndTime: number | undefined;
            let hookIsNotAtStart = false;

            if (hookTimestampMatch) {
                hookStartTime = parseTimestamp(hookTimestampMatch[1]);
                hookEndTime = parseTimestamp(hookTimestampMatch[2]);
                if (hookStartTime < hookEndTime) {
                    hookTimestamp = `[${hookTimestampMatch[1]}] - [${hookTimestampMatch[2]}]`;

                    // Detect if hook is NOT at the beginning of the clip
                    // Hook is considered "not at start" if hook start time differs from clip start time
                    hookIsNotAtStart = hookStartTime !== startTime;
                } else {
                    // Invalid hook timestamp, ignore it
                    hookStartTime = undefined;
                    hookEndTime = undefined;
                }
            }

            // Extract content/isi - support multiple formats
            // * **Isi Konten:** Description... (markdown)
            // Isi Konten: Description... (plain text)
            const contentMatch =
                // Plain text format (new): Isi Konten: text (capture until next numbered clip or double newline)
                section.match(/^Isi\s*Konten\s*:\s*([^\n]+(?:\n(?!\d+\.\s*Clip)[^\n]+)*)(?=\n\n|\n\d+\.\s*Clip|$)/im) ||
                // Bullet with bold: * **Isi Konten:** text (capture until next major section or end)
                section.match(/\*\s*\*\*Isi\s*Konten\s*:\*\*\s*([\s\S]+?)(?=\n#{1,4}\s|\n\*\s*\*\*\w|\n\n#{1,4}|$)/i) ||
                // Bold only: **Isi Konten:** text
                section.match(/\*\*Isi\s*Konten\s*:\*\*\s*([\s\S]+?)(?=\n#{1,4}\s|\n\*\s*\*\*\w|\n\n#{1,4}|$)/i) ||
                // Plain (inline): Isi Konten: text
                section.match(/Isi\s*Konten\s*:\s*([\s\S]+?)(?=\n#{1,4}\s|\n\n#{1,4}|$)/i) ||
                // Isi Clip format
                section.match(/(?:\*\s*)?\*\*Isi(?:\s*Clip)?\s*:\*\*\s*([\s\S]+?)(?=\n#{1,4}\s|\n\*\s*\*\*\w|\n\n#{1,4}|$)/i) ||
                section.match(/Isi(?:\s*Clip)?\s*:\s*([\s\S]+?)(?=\n#{1,4}\s|\n\n#{1,4}|$)/i);
            const content = contentMatch?.[1]?.replace(/[*]/g, '').trim() || '';

            // Extract reason - support multiple formats
            // * **Mengapa Bagus:** Reason... (markdown)
            // Mengapa Bagus: Reason... (plain text)
            const reasonMatch =
                // Plain text format (new): Mengapa Bagus: text (capture until next field or double newline)
                section.match(/^Mengapa\s*Bagus\s*:\s*([^\n]+(?:\n(?!Durasi|Timeline|Detail|Timestamp|Text|Isi)[^\n]+)*)(?=\n\n|\nDurasi|\nTimeline|$)/im) ||
                // Bullet with bold: * **Mengapa Bagus:** text
                section.match(/\*\s*\*\*Mengapa\s*Bagus\s*:\*\*\s*(.+?)(?:\n\*|\n#{1,4}|$)/i) ||
                // Bold only: **Mengapa Bagus:** text
                section.match(/\*\*Mengapa\s*Bagus\s*:\*\*\s*(.+?)(?:\n\*|\n#{1,4}|$)/i) ||
                // Plain (inline): Mengapa Bagus: text
                section.match(/Mengapa\s*Bagus\s*:\s*(.+?)(?:\n\*|\n#{1,4}|$)/i) ||
                // Alasan format
                section.match(/(?:\*\s*)?\*\*Alasan\s*:\*\*\s*(.+?)(?:\n\*|\n#{1,4}|$)/i) ||
                section.match(/Alasan\s*:\s*(.+?)(?:\n\*|\n#{1,4}|$)/i) ||
                // Why/Reason/berpotensi viral
                section.match(/(?:Why|Reason|berpotensi viral)[:\s]*(.+?)(?:\n\n|$)/i);
            const reason = reasonMatch?.[1]?.replace(/[*]/g, '').trim();

            clips.push({
                id: uuidv4(),
                title,
                suggestedTitle: suggestedTitle || title,
                timestamp: `[${timestampMatch[1]}] - [${timestampMatch[2]}]`,
                startTime,
                endTime,
                duration,
                hook,
                hookTimestamp,
                hookStartTime,
                hookEndTime,
                hookIsNotAtStart,
                content,
                reason,
            });
        } catch {
            // Skip malformed sections
            continue;
        }
    }

    return clips;
}

/**
 * Extract YouTube URL from text
 */
function extractYouTubeUrl(text: string): string | null {
    const urlMatch = text.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return urlMatch ? urlMatch[0] : null;
}

export async function POST(request: NextRequest) {
    try {
        const { analysisText } = await request.json();

        if (!analysisText || !analysisText.trim()) {
            return NextResponse.json(
                { success: false, error: 'Analysis text is required' },
                { status: 400 }
            );
        }

        // Parse clipping ideas from text
        const clippingIdeas = parseManualAnalysis(analysisText);

        if (clippingIdeas.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Could not parse any clipping ideas from the text. Make sure to include timestamps in format [MM:SS] - [MM:SS]' },
                { status: 400 }
            );
        }

        // Try to extract video URL from the text
        const videoUrl = extractYouTubeUrl(analysisText);

        return NextResponse.json({
            success: true,
            data: {
                clippingIdeas,
                videoUrl,
                parsedCount: clippingIdeas.length,
            },
        });
    } catch (error) {
        console.error('Error parsing manual analysis:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
