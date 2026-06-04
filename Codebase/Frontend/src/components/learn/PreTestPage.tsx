import React from 'react';
import { useAppStore } from '../../store/appState';
import { navigate } from '../../logic/router';

export default function PreTestPage() {
  const setPreTestCompleted = useAppStore((s) => s.setPreTestCompleted);

  const handleFinish = () => {
    setPreTestCompleted(true);
    navigate('/patterns/learn');
  };

  return (
    <div className="nt-test-page" data-testid="pre-test-page" style={{ padding: '4rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ backgroundColor: '#22c55e', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '4px', display: 'inline-block', marginBottom: '1rem', fontSize: '0.8rem', fontWeight: 'bold' }}>LIVE</div>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1.5rem', fontWeight: 700 }}>Baseline Assessment: Pre-Test</h1>
      <p style={{ fontSize: '1.2rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
        Welcome to NeoTerritory LMS. Before you begin the learning path, please complete this baseline assessment. 
        This will help us measure your progress as you go through the modules.
      </p>
      
      <div style={{ marginTop: '3rem', padding: '2rem', border: '1px solid var(--border-subtle)', borderRadius: '12px', background: 'var(--bg-card)' }}>
        <p style={{ marginBottom: '2rem' }}><em>[Placeholder] In a real LMS, this would contain baseline questions about C++ Design Patterns...</em></p>
        
        <button 
          className="nt-lesson-button nt-lesson-button--primary"
          onClick={handleFinish}
          style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
        >
          Finish Pre-test & Start Learning
        </button>
      </div>
    </div>
  );
}
