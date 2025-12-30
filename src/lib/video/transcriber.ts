import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Transcript, TranscriptSegment } from '@/types';

const execAsync = promisify(exec);
const TEMP_DIR = path.join(process.cwd(), 'temp');

/**
 * Initialize Gemini client for audio transcription
 */
function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        throw new Error('GEMINI_API_KEY is not configured. Please set it in .env.local');
    }
    return new GoogleGenerativeAI(apiKey);
}

/**
 * Ensure temp directory exists
 */
async function ensureTempDir(): Promise<void> {
    try {
        await fs.access(TEMP_DIR);
    } catch {
        await fs.mkdir(TEMP_DIR, { recursive: true });
    }
}

/**
 * Extract audio from video file
 */
export async function extractAudio(videoPath: string, outputPath: string): Promise<void> {
    // Extract audio as mp3 with reduced quality for faster processing
    const command = `ffmpeg -y -i "${videoPath}" -vn -acodec libmp3lame -ar 16000 -ac 1 -ab 64k "${outputPath}"`;
    await execAsync(command, { maxBuffer: 50 * 1024 * 1024 });
}

/**
 * Split audio into chunks for processing (Gemini has file size limits)
 */
export async function splitAudioIntoChunks(
    audioPath: string,
    chunkDurationSeconds: number = 120 // 2 minutes per chunk (smaller for reliability)
): Promise<string[]> {
    await ensureTempDir();

    // Get total duration
    const { stdout: durationOutput } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
    );
    const totalDuration = parseFloat(durationOutput.trim());

    const chunks: string[] = [];
    const baseName = path.basename(audioPath, path.extname(audioPath));

    if (totalDuration <= chunkDurationSeconds) {
        // Audio is short enough, no need to split
        return [audioPath];
    }

    // Split into chunks
    let startTime = 0;
    let chunkIndex = 0;

    while (startTime < totalDuration) {
        const chunkPath = path.join(TEMP_DIR, `${baseName}_chunk_${chunkIndex}.mp3`);
        const duration = Math.min(chunkDurationSeconds, totalDuration - startTime);

        const command = `ffmpeg -y -ss ${startTime} -i "${audioPath}" -t ${duration} -acodec libmp3lame -ar 16000 -ac 1 -ab 64k "${chunkPath}"`;
        await execAsync(command, { maxBuffer: 50 * 1024 * 1024 });

        chunks.push(chunkPath);
        startTime += chunkDurationSeconds;
        chunkIndex++;
    }

    return chunks;
}

/**
 * Transcribe audio using Gemini
 */
export async function transcribeWithGemini(audioPath: string): Promise<Transcript> {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Check file size (limit to ~4MB for chunks)
    const stats = await fs.stat(audioPath);
    console.log(`Audio file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    if (stats.size > 10 * 1024 * 1024) {
        throw new Error('Audio chunk too large. Consider smaller chunks.');
    }

    // Read audio file as base64
    const audioBuffer = await fs.readFile(audioPath);
    const audioBase64 = audioBuffer.toString('base64');

    // Determine mime type
    const ext = path.extname(audioPath).toLowerCase();
    const mimeType = ext === '.mp3' ? 'audio/mp3' : ext === '.wav' ? 'audio/wav' : 'audio/mpeg';

    const prompt = `You are a professional transcriber. Listen to this audio and transcribe it accurately.

For each distinct phrase or sentence, provide:
1. The exact text spoken
2. Approximate start time in seconds from the beginning
3. Approximate duration in seconds

Format your response ONLY as a valid JSON array like this:
[
  {"text": "first sentence", "start": 0.0, "duration": 3.5},
  {"text": "second sentence", "start": 3.5, "duration": 2.8}
]

Important rules:
- Transcribe ALL spoken words accurately
- Use proper capitalization and punctuation
- Estimate timestamps as accurately as possible based on when words are spoken
- Return ONLY the JSON array, no explanation or other text
- If the audio is in a non-English language, transcribe in that language`;

    try {
        console.log('Sending audio to Gemini for transcription...');

        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType,
                    data: audioBase64,
                },
            },
            { text: prompt },
        ]);

        const response = await result.response;
        const text = response.text();

        console.log('Gemini response received, parsing...');

        // Extract JSON from response
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.error('No JSON found in Gemini response:', text.substring(0, 500));
            // Try to create a simple transcript from the text
            if (text.trim()) {
                return {
                    segments: [{ text: text.trim(), start: 0, duration: 120 }],
                    fullText: text.trim(),
                    language: 'auto'
                };
            }
            return { segments: [], fullText: '', language: 'auto' };
        }

        try {
            const parsed = JSON.parse(jsonMatch[0]);
            const segments: TranscriptSegment[] = parsed.map((item: {
                text: string;
                start: number;
                duration: number;
            }) => ({
                text: item.text || '',
                start: item.start || 0,
                duration: item.duration || 0,
            })).filter((s: TranscriptSegment) => s.text.trim());

            console.log(`Successfully parsed ${segments.length} segments`);

            return {
                segments,
                fullText: segments.map(s => s.text).join(' '),
                language: 'auto',
            };
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            return { segments: [], fullText: '', language: 'auto' };
        }
    } catch (error: unknown) {
        const err = error as { message?: string; status?: number };
        console.error('Gemini transcription error:', err.message || error);

        if (err.message?.includes('API key')) {
            throw new Error('Invalid Gemini API key. Please check your .env.local file.');
        }
        if (err.message?.includes('quota') || err.message?.includes('limit')) {
            throw new Error('Gemini API quota exceeded. Please try again later.');
        }
        if (err.message?.includes('safety')) {
            throw new Error('Content blocked by safety filters.');
        }

        throw new Error(`Gemini transcription failed: ${err.message || 'Unknown error'}`);
    }
}

/**
 * Transcribe a video file by extracting audio and using Gemini
 */
export async function transcribeVideo(videoPath: string): Promise<Transcript> {
    await ensureTempDir();

    const videoId = path.basename(videoPath, path.extname(videoPath));
    const audioPath = path.join(TEMP_DIR, `${videoId}_audio.mp3`);

    console.log('Extracting audio from video...');
    await extractAudio(videoPath, audioPath);

    // Check if audio file was created successfully
    try {
        const audioStats = await fs.stat(audioPath);
        console.log(`Audio extracted: ${(audioStats.size / 1024 / 1024).toFixed(2)} MB`);
    } catch {
        throw new Error('Failed to extract audio from video');
    }

    console.log('Splitting audio into chunks...');
    const chunks = await splitAudioIntoChunks(audioPath, 120); // 2 minutes per chunk

    console.log(`Processing ${chunks.length} audio chunk(s)...`);

    const allSegments: TranscriptSegment[] = [];
    let timeOffset = 0;
    let successfulChunks = 0;

    for (let i = 0; i < chunks.length; i++) {
        console.log(`Transcribing chunk ${i + 1}/${chunks.length}...`);

        try {
            const chunkTranscript = await transcribeWithGemini(chunks[i]);

            // Adjust timestamps with offset
            const adjustedSegments = chunkTranscript.segments.map(seg => ({
                ...seg,
                start: seg.start + timeOffset,
            }));

            allSegments.push(...adjustedSegments);
            successfulChunks++;

            // Calculate offset for next chunk (2 minutes = 120 seconds)
            timeOffset += 120;

            // Clean up chunk file if it's not the original
            if (chunks[i] !== audioPath) {
                try {
                    await fs.unlink(chunks[i]);
                } catch {
                    // Ignore cleanup errors
                }
            }

            // Add delay between API calls to avoid rate limiting
            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error(`Error transcribing chunk ${i + 1}:`, error);
            timeOffset += 120; // Still increment offset
        }
    }

    // Clean up audio file
    try {
        await fs.unlink(audioPath);
    } catch {
        // Ignore cleanup errors
    }

    if (successfulChunks === 0) {
        throw new Error('Failed to transcribe any audio chunks');
    }

    console.log(`Transcription complete: ${allSegments.length} segments from ${successfulChunks} chunks`);

    return {
        segments: allSegments,
        fullText: allSegments.map(s => s.text).join(' '),
        language: 'auto',
    };
}

/**
 * Clean up transcription temp files
 */
export async function cleanupTranscriptionFiles(videoId: string): Promise<void> {
    try {
        const files = await fs.readdir(TEMP_DIR);
        for (const file of files) {
            if (file.includes(videoId) && (file.includes('_audio') || file.includes('_chunk'))) {
                await fs.unlink(path.join(TEMP_DIR, file));
            }
        }
    } catch {
        // Ignore cleanup errors
    }
}
