'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { VideoInfo, ClipRecommendation, Transcript, TranscriptAnalysis, CrucialPart, ClippingIdea } from '@/types';

type ProcessingStatus = 'idle' | 'fetching' | 'analyzing' | 'processing' | 'completed' | 'error';
type AnalysisMode = 'quick' | 'detailed' | 'manual';

interface ProcessResult {
    clipId: string;
    success: boolean;
    outputPath: string | null;
    downloadUrl: string | null;
    error?: string;
}

export default function Dashboard() {
    const [url, setUrl] = useState('');
    const [status, setStatus] = useState<ProcessingStatus>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('manual');

    const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
    const [recommendations, setRecommendations] = useState<ClipRecommendation[]>([]);
    const [transcript, setTranscript] = useState<Transcript | null>(null);
    const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
    const [processResults, setProcessResults] = useState<ProcessResult[]>([]);
    const [transcriptionMethod, setTranscriptionMethod] = useState<'youtube' | 'ai' | null>(null);

    // Detailed analysis state
    const [analysis, setAnalysis] = useState<TranscriptAnalysis | null>(null);

    // Manual input state
    const [manualAnalysisText, setManualAnalysisText] = useState('');
    const [parsedClips, setParsedClips] = useState<ClippingIdea[]>([]);
    const [selectedManualClips, setSelectedManualClips] = useState<Set<string>>(new Set());

    // Clips library state - Project-based
    interface ProjectClipDetail {
        filename: string;
        size: number;
        createdAt: string;
        downloadUrl: string;
    }
    interface ProjectWithClips {
        id: string;
        youtubeUrl: string;
        videoId: string;
        title: string;
        thumbnail: string;
        channelName: string;
        createdAt: string;
        clips: string[];
        clipDetails: ProjectClipDetail[];
    }
    interface ProjectsData {
        projects: ProjectWithClips[];
        uncategorizedClips: ProjectClipDetail[];
    }
    const [projectsData, setProjectsData] = useState<ProjectsData>({ projects: [], uncategorizedClips: [] });
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

    // Add clip to project modal state
    const [addClipModalOpen, setAddClipModalOpen] = useState(false);
    const [selectedProjectForNewClip, setSelectedProjectForNewClip] = useState<ProjectWithClips | null>(null);
    const [newClipAnalysisText, setNewClipAnalysisText] = useState('');

    // Fetch projects on mount and after processing
    const fetchProjects = useCallback(async () => {
        try {
            setLoadingProjects(true);
            const response = await fetch('/api/projects');
            const data = await response.json();
            if (data.success) {
                setProjectsData(data.data);
            }
        } catch (err) {
            console.error('Error fetching projects:', err);
        } finally {
            setLoadingProjects(false);
        }
    }, []);

    // Fetch projects on mount
    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    // Toggle project expand/collapse
    const toggleProjectExpand = (projectId: string) => {
        setExpandedProjects(prev => {
            const newSet = new Set(prev);
            if (newSet.has(projectId)) {
                newSet.delete(projectId);
            } else {
                newSet.add(projectId);
            }
            return newSet;
        });
    };

    // Open add clip modal for a project
    const openAddClipModal = (project: ProjectWithClips) => {
        setSelectedProjectForNewClip(project);
        setUrl(project.youtubeUrl);
        setNewClipAnalysisText('');
        setAddClipModalOpen(true);
    };

    // Close add clip modal
    const closeAddClipModal = () => {
        setAddClipModalOpen(false);
        setSelectedProjectForNewClip(null);
        setNewClipAnalysisText('');
    };

    // Delete a saved clip
    const handleDeleteClip = async (filename: string) => {
        if (!confirm('Are you sure you want to delete this clip?')) return;

        try {
            const response = await fetch(`/api/clips?filename=${encodeURIComponent(filename)}`, {
                method: 'DELETE',
            });
            const data = await response.json();
            if (data.success) {
                // Refetch projects to update the UI
                fetchProjects();
            } else {
                setError(data.error || 'Failed to delete clip');
            }
        } catch (err) {
            setError((err as Error).message);
        }
    };

    // Delete a project (clips become uncategorized)
    const handleDeleteProject = async (projectId: string) => {
        if (!confirm('Are you sure you want to delete this project? The clips will be moved to Uncategorized.')) return;

        try {
            const response = await fetch(`/api/projects?projectId=${encodeURIComponent(projectId)}`, {
                method: 'DELETE',
            });
            const data = await response.json();
            if (data.success) {
                // Refetch projects to update the UI
                fetchProjects();
            } else {
                setError(data.error || 'Failed to delete project');
            }
        } catch (err) {
            setError((err as Error).message);
        }
    };

    // Format file size
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleAnalyze = useCallback(async () => {
        if (!url.trim()) {
            setError('Please enter a YouTube URL');
            return;
        }

        setStatus('fetching');
        setStatusMessage('Getting video information...');
        setError(null);
        setProgress(10);
        setVideoInfo(null);
        setRecommendations([]);
        setProcessResults([]);
        setTranscriptionMethod(null);
        setAnalysis(null);

        try {
            setStatus('analyzing');
            setStatusMessage(analysisMode === 'detailed'
                ? 'Generating detailed analysis... This may take a few minutes.'
                : 'Analyzing video... This may take a few minutes if auto-transcription is needed.');
            setProgress(20);

            const progressInterval = setInterval(() => {
                setProgress(prev => Math.min(prev + 5, 85));
            }, 3000);

            const endpoint = analysisMode === 'detailed' ? '/api/transcribe-analyze' : '/api/analyze';
            const analyzeResponse = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });

            clearInterval(progressInterval);

            const analyzeData = await analyzeResponse.json();

            if (!analyzeData.success) {
                throw new Error(analyzeData.error || 'Failed to analyze video');
            }

            setVideoInfo(analyzeData.data.videoInfo);
            setTranscript(analyzeData.data.transcript);
            setTranscriptionMethod(analyzeData.data.transcriptionMethod || 'youtube');

            if (analysisMode === 'detailed') {
                setAnalysis(analyzeData.data.analysis);
            } else {
                setRecommendations(analyzeData.data.recommendations);
                setSelectedClips(new Set(analyzeData.data.recommendations.map((r: ClipRecommendation) => r.id)));
            }

            setProgress(100);
            setStatus('completed');
            setStatusMessage(analysisMode === 'detailed'
                ? 'Analysis complete! Review the results below.'
                : 'Analysis complete! Select clips to process.');

        } catch (err) {
            setError((err as Error).message);
            setStatus('error');
            setStatusMessage('');
            setProgress(0);
        }
    }, [url, analysisMode]);

    const handleParseManualAnalysis = useCallback(async () => {
        if (!manualAnalysisText.trim()) {
            setError('Please paste your transcript analysis');
            return;
        }

        if (!url.trim()) {
            setError('Please enter the YouTube URL first');
            return;
        }

        setStatus('analyzing');
        setStatusMessage('Parsing your analysis...');
        setError(null);
        setProgress(50);

        try {
            const response = await fetch('/api/parse-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ analysisText: manualAnalysisText }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to parse analysis');
            }

            setParsedClips(data.data.clippingIdeas);
            setSelectedManualClips(new Set(data.data.clippingIdeas.map((c: ClippingIdea) => c.id)));

            setProgress(100);
            setStatus('completed');
            setStatusMessage(`Parsed ${data.data.parsedCount} clips! Select clips to process.`);

        } catch (err) {
            setError((err as Error).message);
            setStatus('error');
            setStatusMessage('');
            setProgress(0);
        }
    }, [manualAnalysisText, url]);

    const handleProcessManualClips = useCallback(async () => {
        if (selectedManualClips.size === 0) {
            setError('Please select at least one clip to process');
            return;
        }

        if (!url.trim()) {
            setError('Please enter a YouTube URL');
            return;
        }

        const clipsToProcess = parsedClips
            .filter(c => selectedManualClips.has(c.id))
            .map(c => ({
                id: c.id,
                title: c.title,
                description: c.content,
                startTime: c.startTime,
                endTime: c.endTime,
                duration: c.duration,
                hookStatement: c.hook,
                viralScore: 8,
                transcript: '',
                hookStartTime: c.hookStartTime,
                hookEndTime: c.hookEndTime,
            }));

        setStatus('processing');
        setStatusMessage(`Processing ${clipsToProcess.length} clip(s)...`);
        setError(null);
        setProgress(0);
        setProcessResults([]);

        try {
            const response = await fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    clips: clipsToProcess,
                    transcript: null,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to process video');
            }

            setProcessResults(data.data.results);
            setProgress(100);
            setStatus('completed');
            setStatusMessage(`Successfully processed ${data.data.processed} clip(s)!`);

        } catch (err) {
            setError((err as Error).message);
            setStatus('error');
            setStatusMessage('');
        }
    }, [url, selectedManualClips, parsedClips]);

    const handleProcess = useCallback(async () => {
        if (selectedClips.size === 0) {
            setError('Please select at least one clip to process');
            return;
        }

        const clipsToProcess = recommendations.filter(r => selectedClips.has(r.id));

        setStatus('processing');
        setStatusMessage(`Processing ${clipsToProcess.length} clip(s)...`);
        setError(null);
        setProgress(0);
        setProcessResults([]);

        try {
            const response = await fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    clips: clipsToProcess,
                    transcript,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to process video');
            }

            setProcessResults(data.data.results);
            setProgress(100);
            setStatus('completed');
            setStatusMessage(`Successfully processed ${data.data.processed} clip(s)!`);

        } catch (err) {
            setError((err as Error).message);
            setStatus('error');
            setStatusMessage('');
        }
    }, [url, selectedClips, recommendations, transcript]);

    const toggleClipSelection = (clipId: string) => {
        setSelectedClips(prev => {
            const newSet = new Set(prev);
            if (newSet.has(clipId)) {
                newSet.delete(clipId);
            } else {
                newSet.add(clipId);
            }
            return newSet;
        });
    };

    const toggleManualClipSelection = (clipId: string) => {
        setSelectedManualClips(prev => {
            const newSet = new Set(prev);
            if (newSet.has(clipId)) {
                newSet.delete(clipId);
            } else {
                newSet.add(clipId);
            }
            return newSet;
        });
    };

    const selectAllClips = () => {
        setSelectedClips(new Set(recommendations.map(r => r.id)));
    };

    const deselectAllClips = () => {
        setSelectedClips(new Set());
    };

    const selectAllManualClips = () => {
        setSelectedManualClips(new Set(parsedClips.map(c => c.id)));
    };

    const deselectAllManualClips = () => {
        setSelectedManualClips(new Set());
    };

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getViralScoreColor = (score: number): string => {
        if (score >= 8) return '#10b981';
        if (score >= 6) return '#f59e0b';
        return '#ef4444';
    };

    const resetAnalysis = () => {
        setStatus('idle');
        setVideoInfo(null);
        setRecommendations([]);
        setAnalysis(null);
        setProcessResults([]);
        setParsedClips([]);
        setSelectedManualClips(new Set());
    };

    return (
        <div style={{ minHeight: '100vh' }}>
            {/* Header */}
            <header style={{
                padding: '1rem 0',
                background: 'rgba(15, 15, 35, 0.8)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                position: 'sticky',
                top: 0,
                zIndex: 50,
            }}>
                <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--gradient-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem',
                        }}>
                            ✂️
                        </div>
                        <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                            <span className="gradient-text">Clip</span>Genius
                        </span>
                    </Link>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Dashboard
                    </span>
                </div>
            </header>

            {/* Main Content */}
            <main className="container" style={{ padding: '2rem 1.5rem' }}>
                {/* URL Input Section */}
                <section className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>
                        🎬 YouTube Video Analyzer
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        Paste a YouTube video URL and choose your analysis mode.
                    </p>

                    {/* Mode Toggle */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => { setAnalysisMode('manual'); resetAnalysis(); }}
                            disabled={status === 'analyzing' || status === 'processing'}
                            style={{
                                padding: '0.75rem 1.25rem',
                                borderRadius: 'var(--radius-md)',
                                border: 'none',
                                background: analysisMode === 'manual' ? 'var(--gradient-primary)' : 'var(--bg-tertiary)',
                                color: analysisMode === 'manual' ? 'white' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontWeight: 600,
                                transition: 'all 0.2s ease',
                            }}
                        >
                            📋 Manual Input
                        </button>
                        <button
                            onClick={() => { setAnalysisMode('quick'); resetAnalysis(); }}
                            disabled={status === 'analyzing' || status === 'processing'}
                            style={{
                                padding: '0.75rem 1.25rem',
                                borderRadius: 'var(--radius-md)',
                                border: 'none',
                                background: analysisMode === 'quick' ? 'var(--gradient-primary)' : 'var(--bg-tertiary)',
                                color: analysisMode === 'quick' ? 'white' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontWeight: 600,
                                transition: 'all 0.2s ease',
                            }}
                        >
                            ⚡ Quick Clips
                        </button>
                        <button
                            onClick={() => { setAnalysisMode('detailed'); resetAnalysis(); }}
                            disabled={status === 'analyzing' || status === 'processing'}
                            style={{
                                padding: '0.75rem 1.25rem',
                                borderRadius: 'var(--radius-md)',
                                border: 'none',
                                background: analysisMode === 'detailed' ? 'var(--gradient-primary)' : 'var(--bg-tertiary)',
                                color: analysisMode === 'detailed' ? 'white' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontWeight: 600,
                                transition: 'all 0.2s ease',
                            }}
                        >
                            📝 AI Analysis
                        </button>
                    </div>

                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                        {analysisMode === 'manual'
                            ? 'Paste your own transcript analysis with timestamps. The app will process clips directly.'
                            : analysisMode === 'quick'
                                ? 'AI automatically identifies and extracts viral clips.'
                                : 'AI generates detailed analysis with crucial parts and clipping ideas.'}
                    </p>

                    {/* YouTube URL Input */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            YouTube Video URL *
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            style={{ width: '100%' }}
                            disabled={status === 'analyzing' || status === 'processing'}
                        />
                    </div>

                    {/* Manual Analysis Input */}
                    {analysisMode === 'manual' && (
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                Paste Transcript Analysis (with timestamps)
                            </label>
                            <textarea
                                className="input"
                                placeholder={`Paste your transcript analysis here. Example format:

#### Clip 1: "Ilmu Enggak Bisa Yatim Piatu"
* **Judul:** Cara Agar Ilmu Tidak Numpang Lewat
* **Timestamp:** [00:11:28] - [00:12:00]
* **Hook Timestamp:** [00:10:50] - [00:11:05] (optional, potong hook terlebih dahulu)
* **Durasi:** ±32 detik
* **Hook:** "Kuncinya sederhana kok, ilmu itu enggak bisa yatim piatu..."
* **Isi:** Penjelasan bahwa ilmu baru harus dikoneksikan dengan ilmu lama.

#### Clip 2: ...`}
                                value={manualAnalysisText}
                                onChange={(e) => setManualAnalysisText(e.target.value)}
                                style={{
                                    width: '100%',
                                    minHeight: '200px',
                                    resize: 'vertical',
                                    fontFamily: 'monospace',
                                    fontSize: '0.85rem',
                                }}
                                disabled={status === 'analyzing' || status === 'processing'}
                            />
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {analysisMode === 'manual' ? (
                            <button
                                className="btn btn-primary"
                                onClick={handleParseManualAnalysis}
                                disabled={status === 'analyzing' || status === 'processing' || !url.trim() || !manualAnalysisText.trim()}
                                style={{ opacity: (status === 'analyzing' || status === 'processing' || !url.trim() || !manualAnalysisText.trim()) ? 0.6 : 1 }}
                            >
                                {status === 'analyzing' ? '🔍 Parsing...' : '🔍 Parse & Preview Clips'}
                            </button>
                        ) : (
                            <button
                                className="btn btn-primary"
                                onClick={handleAnalyze}
                                disabled={status === 'analyzing' || status === 'processing' || !url.trim()}
                                style={{ opacity: (status === 'analyzing' || status === 'processing' || !url.trim()) ? 0.6 : 1 }}
                            >
                                {status === 'analyzing' ? '🔍 Analyzing...' : '🔍 Analyze Video'}
                            </button>
                        )}
                    </div>

                    {/* Error message */}
                    {error && (
                        <div style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 'var(--radius-md)',
                            color: '#ef4444',
                        }}>
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Progress indicator */}
                    {(status === 'fetching' || status === 'analyzing' || status === 'processing') && (
                        <div style={{ marginTop: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    {statusMessage}
                                </span>
                                <span style={{ color: 'var(--primary-400)', fontWeight: 600 }}>
                                    {progress}%
                                </span>
                            </div>
                            <div className="progress-bar">
                                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    )}
                </section>

                {/* Parsed Manual Clips */}
                {parsedClips.length > 0 && analysisMode === 'manual' && (
                    <section className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                    🎯 Parsed Clips
                                </h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    {parsedClips.length} clips extracted from your analysis
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-ghost" onClick={selectAllManualClips}>
                                    Select All
                                </button>
                                <button className="btn btn-ghost" onClick={deselectAllManualClips}>
                                    Deselect All
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {parsedClips.map((clip, index) => {
                                const isSelected = selectedManualClips.has(clip.id);
                                const result = processResults.find(r => r.clipId === clip.id);

                                return (
                                    <div
                                        key={clip.id}
                                        onClick={() => !result && toggleManualClipSelection(clip.id)}
                                        style={{
                                            padding: '1.5rem',
                                            background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-tertiary)',
                                            border: `2px solid ${isSelected ? 'var(--primary-500)' : 'transparent'}`,
                                            borderRadius: 'var(--radius-md)',
                                            cursor: result ? 'default' : 'pointer',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                                            <div style={{ flex: 1, minWidth: '200px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                    <span style={{
                                                        padding: '0.25rem 0.75rem',
                                                        background: 'var(--gradient-primary)',
                                                        borderRadius: 'var(--radius-full)',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 600,
                                                        color: 'white',
                                                    }}>
                                                        Clip {index + 1}
                                                    </span>
                                                    <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                                                        {clip.title}
                                                    </h3>
                                                </div>
                                                {clip.suggestedTitle !== clip.title && (
                                                    <p style={{ color: 'var(--primary-400)', fontWeight: 500, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                                                        📱 {clip.suggestedTitle}
                                                    </p>
                                                )}
                                                {clip.hook && (
                                                    <div style={{
                                                        padding: '0.75rem 1rem',
                                                        background: 'var(--bg-primary)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        fontSize: '0.85rem',
                                                        color: 'var(--text-muted)',
                                                        fontStyle: 'italic',
                                                        borderLeft: '3px solid var(--primary-500)',
                                                        marginBottom: '0.75rem',
                                                    }}>
                                                        &quot;{clip.hook}&quot;
                                                    </div>
                                                )}
                                                {clip.content && (
                                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                                        {clip.content}
                                                    </p>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                    ⏱️ {clip.timestamp}
                                                </div>
                                                {clip.hookTimestamp && (
                                                    <div style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.25rem',
                                                        padding: '0.25rem 0.75rem',
                                                        background: 'rgba(139, 92, 246, 0.15)',
                                                        borderRadius: 'var(--radius-full)',
                                                        fontSize: '0.8rem',
                                                        color: '#a78bfa',
                                                    }}>
                                                        🎣 Hook: {clip.hookTimestamp}
                                                    </div>
                                                )}
                                                <div style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    padding: '0.25rem 0.75rem',
                                                    background: 'rgba(16, 185, 129, 0.15)',
                                                    borderRadius: 'var(--radius-full)',
                                                    fontSize: '0.85rem',
                                                    color: '#34d399',
                                                }}>
                                                    📏 {clip.duration}s
                                                </div>

                                                {result && (
                                                    <div style={{ marginTop: '0.5rem' }}>
                                                        {result.success ? (
                                                            <a
                                                                href={result.downloadUrl || '#'}
                                                                className="btn btn-primary"
                                                                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                                                download
                                                            >
                                                                ⬇️ Download
                                                            </a>
                                                        ) : (
                                                            <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>
                                                                ❌ {result.error}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Process button */}
                        {processResults.length === 0 && (
                            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleProcessManualClips}
                                    disabled={selectedManualClips.size === 0 || status === 'processing'}
                                    style={{
                                        padding: '1rem 2rem',
                                        fontSize: '1.1rem',
                                        opacity: (selectedManualClips.size === 0 || status === 'processing') ? 0.6 : 1,
                                    }}
                                >
                                    {status === 'processing'
                                        ? '⏳ Processing...'
                                        : `🎬 Process ${selectedManualClips.size} Clip${selectedManualClips.size !== 1 ? 's' : ''}`}
                                </button>
                            </div>
                        )}
                    </section>
                )}

                {/* Video Info */}
                {videoInfo && (
                    <section className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                            <img
                                src={videoInfo.thumbnail}
                                alt={videoInfo.title}
                                style={{
                                    width: '280px',
                                    height: '158px',
                                    objectFit: 'cover',
                                    borderRadius: 'var(--radius-md)',
                                }}
                            />
                            <div style={{ flex: 1, minWidth: '250px' }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                                    {videoInfo.title}
                                </h2>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                                    <span>📺 {videoInfo.channelName}</span>
                                    <span>⏱️ {formatDuration(videoInfo.duration)}</span>
                                    <span>👁️ {videoInfo.viewCount.toLocaleString()} views</span>
                                </div>
                                {transcriptionMethod && (
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.4rem 0.75rem',
                                        borderRadius: 'var(--radius-full)',
                                        fontSize: '0.8rem',
                                        fontWeight: 500,
                                        background: transcriptionMethod === 'ai' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                        color: transcriptionMethod === 'ai' ? '#a78bfa' : '#34d399',
                                        border: `1px solid ${transcriptionMethod === 'ai' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                                    }}>
                                        {transcriptionMethod === 'ai' ? '🤖 AI Transcribed' : '📝 YouTube Captions'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* Detailed Analysis Results */}
                {analysis && analysisMode === 'detailed' && (
                    <>
                        {/* Summary */}
                        {analysis.summary && (
                            <section className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
                                    📋 Ringkasan Video
                                </h2>
                                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                    {analysis.summary}
                                </p>
                            </section>
                        )}

                        {/* Crucial Parts */}
                        {analysis.crucialParts.length > 0 && (
                            <section className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                                    📌 Bagian Krusial (Inti Pembicaraan)
                                </h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                    Transkrip bagian-bagian penting yang sudah dirapikan
                                </p>

                                <div style={{ display: 'grid', gap: '1.5rem' }}>
                                    {analysis.crucialParts.map((part: CrucialPart, index: number) => (
                                        <div key={part.id} style={{
                                            padding: '1.5rem',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                            borderLeft: '4px solid var(--primary-500)',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                                <span style={{
                                                    padding: '0.25rem 0.75rem',
                                                    background: 'var(--bg-secondary)',
                                                    borderRadius: 'var(--radius-full)',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                }}>
                                                    {index + 1}
                                                </span>
                                                <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                                                    {part.title}
                                                </h3>
                                                {part.timestamp && (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                        {part.timestamp}
                                                    </span>
                                                )}
                                            </div>
                                            <blockquote style={{
                                                margin: 0,
                                                padding: '1rem',
                                                background: 'var(--bg-primary)',
                                                borderRadius: 'var(--radius-sm)',
                                                fontStyle: 'italic',
                                                color: 'var(--text-secondary)',
                                                lineHeight: 1.8,
                                                whiteSpace: 'pre-wrap',
                                            }}>
                                                &ldquo;{part.quote}&rdquo;
                                            </blockquote>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Clipping Ideas */}
                        {analysis.clippingIdeas.length > 0 && (
                            <section className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                                    🎬 Ide Clipping & Timeline
                                </h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                    Rekomendasi potongan video yang berpotensi viral
                                </p>

                                <div style={{ display: 'grid', gap: '1.5rem' }}>
                                    {analysis.clippingIdeas.map((idea: ClippingIdea, index: number) => (
                                        <div key={idea.id} style={{
                                            padding: '1.5rem',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid rgba(99, 102, 241, 0.2)',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                        <span style={{
                                                            padding: '0.25rem 0.75rem',
                                                            background: 'var(--gradient-primary)',
                                                            borderRadius: 'var(--radius-full)',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 600,
                                                            color: 'white',
                                                        }}>
                                                            Clip {index + 1}
                                                        </span>
                                                        <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                                                            {idea.title}
                                                        </h3>
                                                    </div>
                                                    <p style={{ color: 'var(--primary-400)', fontWeight: 500, fontSize: '0.95rem' }}>
                                                        📱 {idea.suggestedTitle}
                                                    </p>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                                        ⏱️ {idea.timestamp}
                                                    </div>
                                                    <div style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.25rem',
                                                        padding: '0.25rem 0.75rem',
                                                        background: 'rgba(16, 185, 129, 0.15)',
                                                        borderRadius: 'var(--radius-full)',
                                                        fontSize: '0.85rem',
                                                        color: '#34d399',
                                                    }}>
                                                        📏 ±{idea.duration}s
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{
                                                padding: '0.75rem 1rem',
                                                background: 'var(--bg-primary)',
                                                borderRadius: 'var(--radius-sm)',
                                                marginBottom: '1rem',
                                                borderLeft: '3px solid var(--primary-500)',
                                            }}>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>Hook:</span>
                                                <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                                                    &ldquo;{idea.hook}&rdquo;
                                                </span>
                                            </div>

                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                                                <strong>Isi:</strong> {idea.content}
                                            </p>

                                            {idea.reason && (
                                                <p style={{
                                                    color: 'var(--text-muted)',
                                                    fontSize: '0.85rem',
                                                    padding: '0.5rem 0.75rem',
                                                    background: 'rgba(139, 92, 246, 0.1)',
                                                    borderRadius: 'var(--radius-sm)',
                                                }}>
                                                    💡 <em>{idea.reason}</em>
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Video Link */}
                                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                                    <a
                                        href={analysis.videoLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-secondary"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        🔗 Buka Video Asli
                                    </a>
                                </div>
                            </section>
                        )}
                    </>
                )}

                {/* Quick Clips Recommendations */}
                {recommendations.length > 0 && analysisMode === 'quick' && (
                    <section className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                    🎯 AI Recommendations
                                </h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    {recommendations.length} potential clips identified
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-ghost" onClick={selectAllClips}>
                                    Select All
                                </button>
                                <button className="btn btn-ghost" onClick={deselectAllClips}>
                                    Deselect All
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {recommendations.map((clip, index) => {
                                const isSelected = selectedClips.has(clip.id);
                                const result = processResults.find(r => r.clipId === clip.id);

                                return (
                                    <div
                                        key={clip.id}
                                        onClick={() => !result && toggleClipSelection(clip.id)}
                                        style={{
                                            padding: '1.5rem',
                                            background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-tertiary)',
                                            border: `2px solid ${isSelected ? 'var(--primary-500)' : 'transparent'}`,
                                            borderRadius: 'var(--radius-md)',
                                            cursor: result ? 'default' : 'pointer',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                                            <div style={{ flex: 1, minWidth: '200px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                    <span style={{
                                                        padding: '0.25rem 0.75rem',
                                                        background: 'var(--bg-secondary)',
                                                        borderRadius: 'var(--radius-full)',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 600,
                                                    }}>
                                                        #{index + 1}
                                                    </span>
                                                    <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                                                        {clip.title}
                                                    </h3>
                                                </div>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                                                    {clip.description}
                                                </p>
                                                <div style={{
                                                    padding: '0.75rem 1rem',
                                                    background: 'var(--bg-primary)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    fontSize: '0.85rem',
                                                    color: 'var(--text-muted)',
                                                    fontStyle: 'italic',
                                                    borderLeft: '3px solid var(--primary-500)',
                                                }}>
                                                    &quot;{clip.hookStatement}&quot;
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    padding: '0.5rem 1rem',
                                                    background: `${getViralScoreColor(clip.viralScore)}20`,
                                                    border: `1px solid ${getViralScoreColor(clip.viralScore)}40`,
                                                    borderRadius: 'var(--radius-full)',
                                                }}>
                                                    <span style={{ fontSize: '0.85rem' }}>🔥</span>
                                                    <span style={{ fontWeight: 700, color: getViralScoreColor(clip.viralScore) }}>
                                                        {clip.viralScore}/10
                                                    </span>
                                                </div>

                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                    ⏱️ {formatDuration(clip.startTime)} - {formatDuration(clip.endTime)}
                                                </div>

                                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                    📏 {clip.duration}s
                                                </div>

                                                {result && (
                                                    <div style={{ marginTop: '0.5rem' }}>
                                                        {result.success ? (
                                                            <a
                                                                href={result.downloadUrl || '#'}
                                                                className="btn btn-primary"
                                                                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                                                download
                                                            >
                                                                ⬇️ Download
                                                            </a>
                                                        ) : (
                                                            <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>
                                                                ❌ {result.error}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Process button */}
                        {processResults.length === 0 && (
                            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleProcess}
                                    disabled={selectedClips.size === 0 || status === 'processing'}
                                    style={{
                                        padding: '1rem 2rem',
                                        fontSize: '1.1rem',
                                        opacity: (selectedClips.size === 0 || status === 'processing') ? 0.6 : 1,
                                    }}
                                >
                                    {status === 'processing'
                                        ? '⏳ Processing...'
                                        : `🎬 Process ${selectedClips.size} Clip${selectedClips.size !== 1 ? 's' : ''}`}
                                </button>
                            </div>
                        )}
                    </section>
                )}

                {/* Empty state */}
                {status === 'idle' && !videoInfo && parsedClips.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        padding: '4rem 2rem',
                        color: 'var(--text-muted)',
                    }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎬</div>
                        <h3 style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            No video analyzed yet
                        </h3>
                        <p>
                            {analysisMode === 'manual'
                                ? 'Enter a YouTube URL and paste your transcript analysis above'
                                : 'Paste a YouTube URL above to get started'}
                        </p>
                    </div>
                )}

                {/* Project-based Clips Library */}
                <section className="glass-card" style={{ padding: '2rem', marginTop: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                📁 Clips Library
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                {projectsData.projects.length} project{projectsData.projects.length !== 1 ? 's' : ''} •
                                {projectsData.projects.reduce((acc, p) => acc + p.clipDetails.length, 0) + projectsData.uncategorizedClips.length} clip{(projectsData.projects.reduce((acc, p) => acc + p.clipDetails.length, 0) + projectsData.uncategorizedClips.length) !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <button
                            className="btn btn-ghost"
                            onClick={fetchProjects}
                            disabled={loadingProjects}
                        >
                            {loadingProjects ? '⏳ Loading...' : '🔄 Refresh'}
                        </button>
                    </div>

                    {projectsData.projects.length === 0 && projectsData.uncategorizedClips.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '3rem 2rem',
                            color: 'var(--text-muted)',
                        }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📂</div>
                            <p>No clips saved yet. Process some clips to see them here!</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {/* Project Cards */}
                            {projectsData.projects.map((project) => {
                                const isExpanded = expandedProjects.has(project.id);
                                return (
                                    <div
                                        key={project.id}
                                        style={{
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                            overflow: 'hidden',
                                            border: '1px solid rgba(255, 255, 255, 0.05)',
                                        }}
                                    >
                                        {/* Project Header - Clickable to expand */}
                                        <div
                                            onClick={() => toggleProjectExpand(project.id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '1rem',
                                                padding: '1rem 1.5rem',
                                                cursor: 'pointer',
                                                transition: 'background 0.2s ease',
                                            }}
                                        >
                                            <img
                                                src={project.thumbnail}
                                                alt={project.title}
                                                style={{
                                                    width: '80px',
                                                    height: '45px',
                                                    objectFit: 'cover',
                                                    borderRadius: 'var(--radius-sm)',
                                                    flexShrink: 0,
                                                }}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h4 style={{ fontWeight: 600, marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {project.title}
                                                </h4>
                                                <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                                                    <span>📺 {project.channelName}</span>
                                                    <span>🎬 {project.clipDetails.length} clip{project.clipDetails.length !== 1 ? 's' : ''}</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <button
                                                    className="btn btn-ghost"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openAddClipModal(project);
                                                    }}
                                                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                                                >
                                                    ➕ Add Clip
                                                </button>
                                                <button
                                                    className="btn btn-ghost"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteProject(project.id);
                                                    }}
                                                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: '#ef4444' }}
                                                >
                                                    🗑️
                                                </button>
                                                <span style={{
                                                    fontSize: '1.25rem',
                                                    transition: 'transform 0.2s ease',
                                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                }}>
                                                    ▼
                                                </span>
                                            </div>
                                        </div>

                                        {/* Expanded Clips List */}
                                        {isExpanded && (
                                            <div style={{
                                                padding: '0 1.5rem 1rem',
                                                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                            }}>
                                                {project.clipDetails.length === 0 ? (
                                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem 0', textAlign: 'center' }}>
                                                        No clips in this project yet.
                                                    </p>
                                                ) : (
                                                    <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
                                                        {project.clipDetails.map((clip) => (
                                                            <div
                                                                key={clip.filename}
                                                                style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    padding: '0.75rem 1rem',
                                                                    background: 'var(--bg-secondary)',
                                                                    borderRadius: 'var(--radius-sm)',
                                                                    gap: '1rem',
                                                                    flexWrap: 'wrap',
                                                                }}
                                                            >
                                                                <div style={{ flex: 1, minWidth: '200px' }}>
                                                                    <h5 style={{ fontWeight: 500, marginBottom: '0.15rem', fontSize: '0.9rem' }}>
                                                                        🎬 {clip.filename.replace(/_[a-f0-9]{8}\.mp4$/, '')}
                                                                    </h5>
                                                                    <div style={{ display: 'flex', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                                        <span>📏 {formatFileSize(clip.size)}</span>
                                                                        <span>📅 {new Date(clip.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                                    </div>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                    <a
                                                                        href={clip.downloadUrl}
                                                                        className="btn btn-primary"
                                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                                                                        download
                                                                    >
                                                                        ⬇️ Download
                                                                    </a>
                                                                    <button
                                                                        className="btn btn-ghost"
                                                                        onClick={() => handleDeleteClip(clip.filename)}
                                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: '#ef4444' }}
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Uncategorized Clips Section */}
                            {projectsData.uncategorizedClips.length > 0 && (
                                <div style={{
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '1rem 1.5rem',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                }}>
                                    <h4 style={{ fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                                        📂 Uncategorized Clips ({projectsData.uncategorizedClips.length})
                                    </h4>
                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                        {projectsData.uncategorizedClips.map((clip) => (
                                            <div
                                                key={clip.filename}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '0.75rem 1rem',
                                                    background: 'var(--bg-secondary)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    gap: '1rem',
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                <div style={{ flex: 1, minWidth: '200px' }}>
                                                    <h5 style={{ fontWeight: 500, marginBottom: '0.15rem', fontSize: '0.9rem' }}>
                                                        🎬 {clip.filename}
                                                    </h5>
                                                    <div style={{ display: 'flex', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                        <span>📏 {formatFileSize(clip.size)}</span>
                                                        <span>📅 {new Date(clip.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <a
                                                        href={clip.downloadUrl}
                                                        className="btn btn-primary"
                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                                                        download
                                                    >
                                                        ⬇️ Download
                                                    </a>
                                                    <button
                                                        className="btn btn-ghost"
                                                        onClick={() => handleDeleteClip(clip.filename)}
                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: '#ef4444' }}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </section>

                {/* Add Clip Modal */}
                {addClipModalOpen && selectedProjectForNewClip && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100,
                        padding: '1rem',
                    }}>
                        <div className="glass-card" style={{
                            maxWidth: '700px',
                            width: '100%',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            padding: '2rem',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                                        ➕ Add New Clip
                                    </h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        Add a new clip to: <strong>{selectedProjectForNewClip.title}</strong>
                                    </p>
                                </div>
                                <button
                                    onClick={closeAddClipModal}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '1.5rem',
                                        cursor: 'pointer',
                                        color: 'var(--text-muted)',
                                    }}
                                >
                                    ✕
                                </button>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    YouTube URL (auto-filled from project)
                                </label>
                                <input
                                    type="text"
                                    className="input"
                                    value={url}
                                    disabled
                                    style={{ width: '100%', opacity: 0.7 }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Paste Transcript Analysis (with timestamps)
                                </label>
                                <textarea
                                    className="input"
                                    placeholder={`Example format:

#### Clip 1: "Title"
* **Judul:** Your Clip Title
* **Timestamp:** [00:11:28] - [00:12:00]
* **Hook Timestamp:** [00:10:50] - [00:11:05]
* **Durasi:** ±32 detik
* **Hook:** "Your hook text..."
* **Isi:** Description of the content.`}
                                    value={newClipAnalysisText}
                                    onChange={(e) => setNewClipAnalysisText(e.target.value)}
                                    style={{
                                        width: '100%',
                                        minHeight: '200px',
                                        resize: 'vertical',
                                        fontFamily: 'monospace',
                                        fontSize: '0.85rem',
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button
                                    className="btn btn-ghost"
                                    onClick={closeAddClipModal}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={async () => {
                                        if (!newClipAnalysisText.trim()) {
                                            setError('Please paste your transcript analysis');
                                            return;
                                        }
                                        setManualAnalysisText(newClipAnalysisText);
                                        closeAddClipModal();
                                        // Trigger the parse flow
                                        setAnalysisMode('manual');
                                    }}
                                    disabled={!newClipAnalysisText.trim()}
                                >
                                    📋 Parse & Preview Clips
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
