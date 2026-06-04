import React from 'react';

export default function PostTest2Page() {
  return (
    <div className="nt-test-page" data-testid="post-test-2-page" style={{ padding: '4rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1.5rem', fontWeight: 700 }}>Post-Test (Part 2)</h1>
      <p style={{ fontSize: '1.2rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
        This is the second part of the post-test. Please answer these additional questions to complete your evaluation.
      </p>
      <div style={{ marginTop: '3rem', padding: '2rem', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
        <p><em>Additional test questions will be loaded here...</em></p>
      </div>
    </div>
  );
}
