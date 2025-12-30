import { getGeminiModel, rateLimitedRequest } from './client';
import { TranscriptAnalysis, CrucialPart, ClippingIdea, Transcript, TranscriptSegment } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Format seconds to timestamp string [HH:MM:SS] or [MM:SS]
 */
function formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `[${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
    }
    return `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
}

/**
 * Format transcript segments for analysis
 */
function formatTranscriptForAnalysis(segments: TranscriptSegment[]): string {
    return segments
        .map((seg) => `[${formatTimestamp(seg.start).replace('[', '').replace(']', '')}] ${seg.text}`)
        .join('\n');
}

/**
 * Analyze transcript and generate detailed analysis with crucial parts and clipping ideas
 */
export async function analyzeTranscriptDetailed(
    transcript: Transcript,
    videoDuration: number,
    videoTitle: string,
    videoUrl: string
): Promise<TranscriptAnalysis> {
    const model = getGeminiModel();

    // Prepare transcript with timestamps for context
    const formattedTranscript = formatTranscriptForAnalysis(transcript.segments);

    const prompt = `Anda adalah ahli content strategist untuk konten short-form viral (TikTok/Reels/Shorts). Analisis transkrip video berikut dan berikan analisis mendalam.

JUDUL VIDEO: ${videoTitle}
DURASI VIDEO: ${videoDuration} detik
URL VIDEO: ${videoUrl}

TRANSKRIP DENGAN TIMESTAMP:
${formattedTranscript}

TUGAS:
1. IDENTIFIKASI BAGIAN KRUSIAL (Inti Pembicaraan)
   - Temukan 2-5 bagian penting dari video yang berisi insight, filosofi, atau konsep utama
   - Untuk setiap bagian, berikan judul deskriptif dan kutipan penting (quote) yang sudah dirapikan agar enak dibaca
   - Jika memungkinkan, sertakan timestamp awal

2. REKOMENDASIKAN IDE CLIPPING
   - Temukan 3-6 momen yang berpotensi viral untuk dipotong sebagai clip pendek (15-60 detik)
   - Untuk setiap clip, berikan:
     * Judul yang catchy
     * Judul yang disarankan untuk postingan
     * Timestamp mulai dan akhir yang tepat
     * Hook statement (kalimat pembuka yang menarik perhatian)
     * Isi singkat tentang apa yang dibahas
     * Alasan kenapa ini berpotensi viral

Respond ONLY dengan valid JSON dalam format ini:
{
  "summary": "Ringkasan singkat tentang isi video (1-2 kalimat)",
  "crucialParts": [
    {
      "title": "Judul Bagian",
      "quote": "Kutipan penting yang sudah dirapikan...",
      "timestamp": "[00:11:28]"
    }
  ],
  "clippingIdeas": [
    {
      "title": "Judul Internal Clip",
      "suggestedTitle": "Judul untuk Postingan yang Menarik",
      "startTimeSeconds": 688,
      "endTimeSeconds": 720,
      "hook": "Kalimat pembuka yang menarik perhatian...",
      "content": "Penjelasan singkat isi clip",
      "reason": "Alasan kenapa berpotensi viral"
    }
  ]
}`;

    try {
        const result = await rateLimitedRequest(async () => {
            return await model.generateContent(prompt);
        });

        const response = await result.response;
        const text = response.text();

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('No JSON found in detailed analysis response:', text);
            return {
                crucialParts: [],
                clippingIdeas: [],
                videoLink: videoUrl,
            };
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Transform crucial parts
        const crucialParts: CrucialPart[] = (parsed.crucialParts || []).map((part: {
            title: string;
            quote: string;
            timestamp?: string;
        }) => ({
            id: uuidv4(),
            title: part.title,
            quote: part.quote,
            timestamp: part.timestamp,
        }));

        // Transform clipping ideas
        const clippingIdeas: ClippingIdea[] = (parsed.clippingIdeas || [])
            .filter((idea: { startTimeSeconds: number; endTimeSeconds: number }) => {
                const duration = idea.endTimeSeconds - idea.startTimeSeconds;
                return (
                    idea.startTimeSeconds >= 0 &&
                    idea.endTimeSeconds <= videoDuration &&
                    idea.startTimeSeconds < idea.endTimeSeconds &&
                    duration >= 15 &&
                    duration <= 90 // Allow slightly longer for detailed analysis
                );
            })
            .map((idea: {
                title: string;
                suggestedTitle: string;
                startTimeSeconds: number;
                endTimeSeconds: number;
                hook: string;
                content: string;
                reason?: string;
            }) => ({
                id: uuidv4(),
                title: idea.title,
                suggestedTitle: idea.suggestedTitle,
                timestamp: `${formatTimestamp(idea.startTimeSeconds)} - ${formatTimestamp(idea.endTimeSeconds)}`,
                startTime: idea.startTimeSeconds,
                endTime: idea.endTimeSeconds,
                duration: idea.endTimeSeconds - idea.startTimeSeconds,
                hook: idea.hook,
                content: idea.content,
                reason: idea.reason,
            }));

        return {
            crucialParts,
            clippingIdeas,
            videoLink: videoUrl,
            summary: parsed.summary,
        };
    } catch (error) {
        console.error('Error in detailed transcript analysis with Gemini:', error);
        throw new Error('Failed to analyze transcript. Please check your Gemini API key.');
    }
}
