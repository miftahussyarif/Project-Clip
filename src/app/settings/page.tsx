'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CookieStatus {
    exists: boolean;
    size: number;
    lastModified: string | null;
}

export default function SettingsPage() {
    const [cookieContent, setCookieContent] = useState('');
    const [cookieStatus, setCookieStatus] = useState<CookieStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchCookieStatus();
    }, []);

    const fetchCookieStatus = async () => {
        try {
            const response = await fetch('/api/settings/cookies');
            const data = await response.json();
            if (data.success) {
                setCookieStatus(data.data);
            }
        } catch (error) {
            console.error('Error fetching cookie status:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        if (!cookieContent.trim()) {
            setMessage({ type: 'error', text: 'Please paste your cookies content' });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            const response = await fetch('/api/settings/cookies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cookies: cookieContent }),
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ type: 'success', text: 'Cookies saved successfully!' });
                setCookieContent('');
                fetchCookieStatus();
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to save cookies' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete the cookies file?')) return;

        try {
            const response = await fetch('/api/settings/cookies', {
                method: 'DELETE',
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ type: 'success', text: 'Cookies deleted successfully!' });
                fetchCookieStatus();
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to delete cookies' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error. Please try again.' });
        }
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
        } catch {
            console.error('Logout failed');
        }
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
                    <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Link href="/dashboard" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textDecoration: 'none' }}>
                            ← Dashboard
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="btn btn-ghost"
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                        >
                            🚪 Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container" style={{ padding: '2rem 1.5rem', maxWidth: '800px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                    ⚙️ Settings
                </h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    Manage your application settings and YouTube cookies.
                </p>

                {/* Cookie Settings Card */}
                <section className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
                        🍪 YouTube Cookies
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                        Cookies are required to bypass YouTube&apos;s bot detection on VPS/server environments.
                        Export cookies from your browser using a cookie editor extension.
                    </p>

                    {/* Cookie Status */}
                    {loading ? (
                        <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                            Loading cookie status...
                        </div>
                    ) : (
                        <div style={{
                            padding: '1rem',
                            background: cookieStatus?.exists ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${cookieStatus?.exists ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            borderRadius: 'var(--radius-md)',
                            marginBottom: '1.5rem',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.25rem' }}>
                                    {cookieStatus?.exists ? '✅' : '❌'}
                                </span>
                                <div>
                                    <div style={{ fontWeight: 600, color: cookieStatus?.exists ? '#10b981' : '#ef4444' }}>
                                        {cookieStatus?.exists ? 'Cookies Active' : 'No Cookies Configured'}
                                    </div>
                                    {cookieStatus?.exists && cookieStatus.lastModified && (
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            Last updated: {new Date(cookieStatus.lastModified).toLocaleString()}
                                            {' • '}Size: {(cookieStatus.size / 1024).toFixed(1)} KB
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Message */}
                    {message && (
                        <div style={{
                            padding: '0.75rem 1rem',
                            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            borderRadius: 'var(--radius-md)',
                            color: message.type === 'success' ? '#10b981' : '#ef4444',
                            marginBottom: '1rem',
                        }}>
                            {message.type === 'success' ? '✅' : '⚠️'} {message.text}
                        </div>
                    )}

                    {/* Cookie Input Form */}
                    <form onSubmit={handleSave}>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                color: 'var(--text-secondary)',
                                fontSize: '0.9rem',
                            }}>
                                Paste Cookies (Netscape format)
                            </label>
                            <textarea
                                className="input"
                                placeholder={`# Netscape HTTP Cookie File
# Export cookies from your browser using Cookie Editor extension
# and paste the content here

.youtube.com	TRUE	/	TRUE	...`}
                                value={cookieContent}
                                onChange={(e) => setCookieContent(e.target.value)}
                                style={{
                                    width: '100%',
                                    minHeight: '200px',
                                    resize: 'vertical',
                                    fontFamily: 'monospace',
                                    fontSize: '0.8rem',
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={saving || !cookieContent.trim()}
                                style={{ opacity: (saving || !cookieContent.trim()) ? 0.6 : 1 }}
                            >
                                {saving ? '💾 Saving...' : '💾 Save Cookies'}
                            </button>

                            {cookieStatus?.exists && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="btn btn-ghost"
                                    style={{ color: '#ef4444' }}
                                >
                                    🗑️ Delete Cookies
                                </button>
                            )}
                        </div>
                    </form>

                    {/* Instructions */}
                    <div style={{
                        marginTop: '2rem',
                        padding: '1rem',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                    }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>How to export cookies:</strong>
                        <ol style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', lineHeight: 1.8 }}>
                            <li>Install <strong>Cookie Editor</strong> extension in your browser</li>
                            <li>Open <strong>youtube.com</strong> and login with your Google account</li>
                            <li>Click the Cookie Editor icon → <strong>Export</strong> → <strong>Netscape</strong></li>
                            <li>Paste the exported content above</li>
                        </ol>
                        <p style={{ marginTop: '0.75rem', color: '#f59e0b' }}>
                            ⚠️ Use a secondary YouTube account for safety. Cookies expire periodically.
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
}
