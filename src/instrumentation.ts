export async function register() {
    // Only run cleanup on server start in Node.js runtime
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Dynamic import to avoid Edge Runtime evaluation
        const { cleanupOldFiles } = await import('@/lib/utils/cleanup');

        console.log('[Startup] Running initial cleanup...');

        // Run cleanup on server start
        try {
            await cleanupOldFiles();
        } catch (error) {
            console.error('[Startup] Cleanup error:', error);
        }

        // Schedule cleanup every 24 hours
        const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

        setInterval(async () => {
            console.log('[Scheduled] Running periodic cleanup...');
            try {
                const { cleanupOldFiles: cleanup } = await import('@/lib/utils/cleanup');
                await cleanup();
            } catch (error) {
                console.error('[Scheduled] Cleanup error:', error);
            }
        }, CLEANUP_INTERVAL);

        console.log('[Startup] Cleanup scheduler initialized (runs every 24 hours)');
    }
}
