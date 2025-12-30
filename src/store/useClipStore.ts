import { create } from 'zustand';
import { ClipStore, ProcessingJob, ClipJob } from '@/types';

export const useClipStore = create<ClipStore>((set, get) => ({
    currentJob: null,
    jobs: [],
    isProcessing: false,

    setCurrentJob: (job) => set({ currentJob: job }),

    addJob: (job) => set((state) => ({
        jobs: [job, ...state.jobs],
        currentJob: job,
    })),

    updateJob: (id, updates) => set((state) => ({
        jobs: state.jobs.map((job) =>
            job.id === id ? { ...job, ...updates, updatedAt: new Date() } : job
        ),
        currentJob: state.currentJob?.id === id
            ? { ...state.currentJob, ...updates, updatedAt: new Date() }
            : state.currentJob,
    })),

    updateClip: (jobId, clipId, updates) => set((state) => {
        const updateClips = (clips: ClipJob[]) =>
            clips.map((clip) =>
                clip.id === clipId ? { ...clip, ...updates } : clip
            );

        return {
            jobs: state.jobs.map((job) =>
                job.id === jobId
                    ? { ...job, clips: updateClips(job.clips), updatedAt: new Date() }
                    : job
            ),
            currentJob: state.currentJob?.id === jobId
                ? { ...state.currentJob, clips: updateClips(state.currentJob.clips), updatedAt: new Date() }
                : state.currentJob,
        };
    }),

    setProcessing: (value) => set({ isProcessing: value }),
}));
