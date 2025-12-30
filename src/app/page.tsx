'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <main>
      {/* Navigation */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: '1rem 0',
        background: 'rgba(15, 15, 35, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
            }}>
              ✂️
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              <span className="gradient-text">Clip</span>Genius
            </span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link href="/dashboard" className="btn btn-primary">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        paddingTop: '80px',
      }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <div style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.8s ease-out',
          }}>
            {/* Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              marginBottom: '2rem',
              fontSize: '0.9rem',
              color: 'var(--primary-300)',
            }}>
              <span>✨</span>
              <span>Powered by Gemini AI</span>
            </div>

            {/* Headline */}
            <h1 style={{
              fontSize: 'clamp(2.5rem, 8vw, 4.5rem)',
              fontWeight: 800,
              lineHeight: 1.1,
              marginBottom: '1.5rem',
            }}>
              Transform Videos into
              <br />
              <span className="gradient-text">Viral Clips</span> Instantly
            </h1>

            {/* Subheadline */}
            <p style={{
              fontSize: 'clamp(1rem, 2vw, 1.25rem)',
              color: 'var(--text-secondary)',
              maxWidth: '600px',
              margin: '0 auto 2.5rem',
            }}>
              AI analyzes your YouTube videos to find the most engaging moments,
              auto-crops for portrait mode, and adds captions — all in one click.
            </p>

            {/* CTA Buttons */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/dashboard" className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
                🚀 Start Clipping
              </Link>
              <a href="#how-it-works" className="btn btn-secondary" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
                Learn More
              </a>
            </div>
          </div>

          {/* Preview mockup */}
          <div style={{
            marginTop: '4rem',
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
            transition: 'all 0.8s ease-out 0.3s',
          }}>
            <div className="glass-card" style={{
              maxWidth: '900px',
              margin: '0 auto',
              padding: '1.5rem',
              borderRadius: 'var(--radius-xl)',
            }}>
              <div style={{
                background: 'linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                display: 'flex',
                gap: '2rem',
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}>
                {/* Input preview */}
                <div style={{
                  flex: 1,
                  minWidth: '280px',
                  textAlign: 'left',
                }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    📎 Paste YouTube URL
                  </p>
                  <div style={{
                    background: 'var(--bg-primary)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    color: 'var(--text-secondary)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}>
                    https://youtube.com/watch?v=...
                  </div>
                </div>

                {/* Arrow */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  color: 'var(--primary-400)',
                }}>
                  →
                </div>

                {/* Output preview */}
                <div style={{
                  flex: 1,
                  minWidth: '280px',
                  textAlign: 'left',
                }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    🎬 AI-Generated Clips
                  </p>
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                  }}>
                    {[1, 2, 3].map((i) => (
                      <div key={i} style={{
                        width: '80px',
                        height: '140px',
                        background: `linear-gradient(135deg, hsl(${220 + i * 20}, 70%, 45%) 0%, hsl(${260 + i * 20}, 70%, 35%) 100%)`,
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}>
                        Clip {i}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 700, marginBottom: '1rem' }}>
              Everything You Need
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
              Powerful features to create viral content effortlessly
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}>
            {[
              {
                icon: '🧠',
                title: 'AI-Powered Analysis',
                description: 'Gemini AI analyzes your video to find the most viral-worthy moments based on engagement patterns.',
              },
              {
                icon: '📐',
                title: 'Smart Cropping',
                description: 'Automatically converts landscape videos to portrait 9:16 format with intelligent subject tracking.',
              },
              {
                icon: '💬',
                title: 'Auto Captions',
                description: 'Stylish, animated captions are automatically generated and synchronized with your video.',
              },
              {
                icon: '🎯',
                title: 'Viral Score',
                description: 'Each clip gets a viral potential score to help you choose the best content.',
              },
              {
                icon: '⚡',
                title: 'Fast Processing',
                description: 'Efficient video processing pipeline delivers your clips in minutes, not hours.',
              },
              {
                icon: '📱',
                title: 'Platform Ready',
                description: 'Export in 1080x1920 MP4 format, perfect for TikTok, YouTube Shorts, and Instagram Reels.',
              },
            ].map((feature, index) => (
              <div key={index} className="glass-card" style={{
                padding: '2rem',
                transition: 'all 0.3s ease',
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--gradient-glow)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.75rem',
                  marginBottom: '1.25rem',
                }}>
                  {feature.icon}
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                  {feature.title}
                </h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 700, marginBottom: '1rem' }}>
              How It Works
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
              Three simple steps to viral content
            </p>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '3rem',
            maxWidth: '800px',
            margin: '0 auto',
          }}>
            {[
              {
                step: '01',
                title: 'Paste YouTube URL',
                description: 'Simply paste any YouTube video link. Our system supports all video formats and durations.',
                icon: '📎',
              },
              {
                step: '02',
                title: 'AI Analyzes Video',
                description: 'Gemini AI examines the transcript to identify the most engaging, shareable moments.',
                icon: '🔍',
              },
              {
                step: '03',
                title: 'Download Clips',
                description: 'Get your portrait-formatted clips with captions, ready to upload anywhere.',
                icon: '⬇️',
              },
            ].map((item, index) => (
              <div key={index} style={{
                display: 'flex',
                gap: '2rem',
                alignItems: 'flex-start',
              }}>
                <div style={{
                  flexShrink: 0,
                  width: '80px',
                  height: '80px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--gradient-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{
                    fontSize: '0.85rem',
                    color: 'var(--primary-400)',
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                  }}>
                    STEP {item.step}
                  </div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                    {item.title}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '1.05rem' }}>
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section">
        <div className="container" style={{ textAlign: 'center' }}>
          <div className="glass-card" style={{
            padding: '4rem 2rem',
            maxWidth: '800px',
            margin: '0 auto',
            background: 'var(--gradient-glow)',
          }}>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 700, marginBottom: '1rem' }}>
              Ready to Create Viral Clips?
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.1rem' }}>
              Start transforming your YouTube videos into engaging short-form content today.
            </p>
            <Link href="/dashboard" className="btn btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem' }}>
              🎬 Start Free Now
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '2rem 0',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
      }}>
        <div className="container" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              <span className="gradient-text">Clip</span>Genius
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            © 2024 ClipGenius. Powered by Gemini AI.
          </p>
        </div>
      </footer>
    </main>
  );
}
