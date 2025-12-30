import { getGeminiModel, rateLimitedRequest } from './client';
import { ClipRecommendation, Transcript, TranscriptSegment } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Analyze transcript and generate clip recommendations using Gemini Pro
 */
export async function analyzeTranscript(
    transcript: Transcript,
    videoDuration: number,
    videoTitle: string
): Promise<ClipRecommendation[]> {
    const model = getGeminiModel();

    // Prepare transcript with timestamps for context
    const formattedTranscript = formatTranscriptForAnalysis(transcript.segments);

    const prompt = `You are an expert content strategist specializing in short-form viral content. Analyze this video transcript and identify the BEST moments for creating engaging short-form clips (15-60 seconds).

VIDEO TITLE: ${videoTitle}
VIDEO DURATION: ${videoDuration} seconds

TRANSCRIPT WITH TIMESTAMPS:
${formattedTranscript}

INSTRUCTIONS:
1. Find 3-7 potential viral moments based on:
   - Strong hooks or attention-grabbing statements
   - Emotional peaks (humor, surprise, insight, controversy)
   - Complete, standalone thoughts that make sense without context
   - Quotable or shareable moments
   - Educational insights or "aha" moments

2. For each clip, provide:
   - A catchy title for the clip
   - Brief description of why this moment is compelling
   - Exact start timestamp (in seconds)
   - Exact end timestamp (in seconds)
   - The hook statement (first impactful sentence)
   - Viral score (1-10, where 10 is extremely viral)

IMPORTANT RULES:
- Each clip must be between 15-60 seconds
- Clips must NOT overlap
- Start timestamps should begin at a natural speaking point
- End timestamps should conclude at a natural stopping point
- Consider pacing and engagement throughout

Respond ONLY with a valid JSON array in this exact format:
[
  {
    "title": "Catchy Clip Title",
    "description": "Why this moment is compelling",
    "startTime": 45,
    "endTime": 75,
    "hookStatement": "The opening hook sentence",
    "viralScore": 8
  }
]`;

    try {
        const result = await rateLimitedRequest(async () => {
            return await model.generateContent(prompt);
        });

        const response = await result.response;
        const text = response.text();

        // Extract JSON from response
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.error('No JSON array found in response:', text);
            return [];
        }

        const recommendations = JSON.parse(jsonMatch[0]);

        // Validate and transform recommendations
        return recommendations
            .filter((rec: { startTime: number; endTime: number }) => {
                const duration = rec.endTime - rec.startTime;
                return (
                    rec.startTime >= 0 &&
                    rec.endTime <= videoDuration &&
                    rec.startTime < rec.endTime &&
                    duration >= 15 &&
                    duration <= 60
                );
            })
            .map((rec: {
                title: string;
                description: string;
                startTime: number;
                endTime: number;
                hookStatement: string;
                viralScore: number;
            }) => ({
                id: uuidv4(),
                title: rec.title,
                description: rec.description,
                startTime: rec.startTime,
                endTime: rec.endTime,
                duration: rec.endTime - rec.startTime,
                hookStatement: rec.hookStatement,
                viralScore: Math.min(10, Math.max(1, rec.viralScore)),
                transcript: getSegmentTranscript(transcript.segments, rec.startTime, rec.endTime),
            }))
            .sort((a: ClipRecommendation, b: ClipRecommendation) => b.viralScore - a.viralScore);
    } catch (error) {
        console.error('Error analyzing transcript with Gemini:', error);
        throw new Error('Failed to analyze transcript. Please check your Gemini API key.');
    }
}

/**
 * Format transcript segments for analysis
 */
function formatTranscriptForAnalysis(segments: TranscriptSegment[]): string {
    return segments
        .map((seg) => `[${formatTime(seg.start)}] ${seg.text}`)
        .join('\n');
}

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get transcript text for a specific time range
 */
function getSegmentTranscript(
    segments: TranscriptSegment[],
    startTime: number,
    endTime: number
): string {
    return segments
        .filter((seg) => seg.start >= startTime && seg.start < endTime)
        .map((seg) => seg.text)
        .join(' ');
}

/**
 * Refine clip recommendation with additional context
 */
export async function refineClipRecommendation(
    clip: ClipRecommendation,
    transcript: Transcript
): Promise<ClipRecommendation> {
    const model = getGeminiModel();

    const contextStart = Math.max(0, clip.startTime - 30);
    const contextEnd = Math.min(
        transcript.segments[transcript.segments.length - 1]?.start +
        transcript.segments[transcript.segments.length - 1]?.duration || clip.endTime + 30,
        clip.endTime + 30
    );

    const contextTranscript = getSegmentTranscript(
        transcript.segments,
        contextStart,
        contextEnd
    );

    const prompt = `Review this clip selection and suggest improvements:

CLIP: "${clip.title}"
Current timestamps: ${formatTime(clip.startTime)} - ${formatTime(clip.endTime)}

CONTEXT TRANSCRIPT:
${contextTranscript}

Suggest:
1. Should the start time be adjusted for a better hook?
2. Should the end time be adjusted for a better conclusion?
3. Is there a better hook statement?

Respond with JSON:
{
  "adjustedStartTime": ${clip.startTime},
  "adjustedEndTime": ${clip.endTime},
  "betterHookStatement": "...",
  "reasoning": "..."
}`;

    try {
        const result = await rateLimitedRequest(async () => {
            return await model.generateContent(prompt);
        });

        const response = await result.response;
        const text = response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const refinement = JSON.parse(jsonMatch[0]);
            return {
                ...clip,
                startTime: refinement.adjustedStartTime || clip.startTime,
                endTime: refinement.adjustedEndTime || clip.endTime,
                duration: (refinement.adjustedEndTime || clip.endTime) -
                    (refinement.adjustedStartTime || clip.startTime),
                hookStatement: refinement.betterHookStatement || clip.hookStatement,
            };
        }
    } catch (error) {
        console.error('Error refining clip:', error);
    }

    return clip;
}
