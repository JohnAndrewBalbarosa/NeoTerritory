import React from 'react';

export default function PreTestPage() {
  return (
    <div className="nt-test-page" data-testid="pre-test-page" style={{ padding: '4rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ backgroundColor: '#22c55e', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '4px', display: 'inline-block', marginBottom: '1rem', fontSize: '0.8rem', fontWeight: 'bold' }}>LIVE</div>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1.5rem', fontWeight: 700 }}>Pre-Test</h1>
      <p style={{ fontSize: '1.2rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
        Welcome to the pre-test. Please answer the following questions to assess your baseline knowledge of C++ design patterns.
      </p>
      <div style={{ marginTop: '3rem', padding: '2rem', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
        <p><em>Test questions will be loaded here...</em></p>
      </div>
    </div>
  );
}
