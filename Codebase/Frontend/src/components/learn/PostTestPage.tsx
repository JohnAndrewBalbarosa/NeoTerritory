import React from 'react';

export default function PostTestPage() {
  return (
    <div className="nt-test-page" data-testid="post-test-page" style={{ padding: '4rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1.5rem', fontWeight: 700 }}>Post-Test</h1>
      <p style={{ fontSize: '1.2rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
        Congratulations on completing the module! Please take this post-test to measure your learning progress and mastery of the patterns covered.
      </p>
      <div style={{ marginTop: '3rem', padding: '2rem', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
        <p><em>Test questions will be loaded here...</em></p>
      </div>
    </div>
  );
}
