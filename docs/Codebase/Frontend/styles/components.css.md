# components.css

- Source: Frontend/styles/components.css
- Kind: CSS stylesheet
- Lines: 591
- Role: Defines the visual system and component styling for the frontend prototype.
- Chronology: Applied during page render to define the frontend presentation layer.

## Notable Symbols
- /* ============================================================
   CodiNeo â€” Component Styles
   Page-specific and reusable components
   ============================================================ */

/* â”€â”€ Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.dashboard-header
- display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
}

/* â”€â”€ Analysis New Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.ready-card
- background: var(--bg-surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 40px 24px;
    text-align: center;
    margin: 20px 0;
}

.ready-play-icon
- width: 72px;
    height: 72px;
    margin: 0 auto 18px;
    color: var(--accent-green);
    filter: drop-shadow(0 0 12px rgba(192, 255, 0, 0.3));
}

.ready-title
- font-size: 20px;
    font-weight: 700;
    margin-bottom: 8px;
}

.ready-subtitle
- font-size: 14px;
    color: var(--text-secondary);
    max-width: 360px;
    margin: 0 auto;
}

/* â”€â”€ Results Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.results-project-header
- display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 8px;
}

.results-project-name
- font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.4px;
}

.results-timestamp
- font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 22px;
}

.results-actions
- display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

/* â”€â”€ Diff Viewer Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.diff-tab-bar
- display: flex;
    gap: 0;
    background: var(--bg-surface-2);
    border-radius: var(--radius-sm);
    padding: 4px;
    margin-bottom: 18px;
    width: fit-content;
}

.diff-tab
- padding: 8px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    border: none;
    background: none;
}

.diff-tab.active

## Direct Dependencies
- No direct dependency list was extracted from the file text.

## File Outline
### Responsibility

This stylesheet implements the visual layer of the frontend prototype. It is not executable in the same way as the JavaScript files, but it still participates in the flow by defining how the rendered route shell and components appear.

### Position In The Flow

Applied during page render to define the frontend presentation layer.

### Main Surface Area

Defines the visual system and component styling for the frontend prototype. The main surface area is easiest to track through symbols such as /* ============================================================
   CodiNeo â€” Component Styles
   Page-specific and reusable components
   ============================================================ */

/* â”€â”€ Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.dashboard-header, display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
}

/* â”€â”€ Analysis New Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.ready-card, background: var(--bg-surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 40px 24px;
    text-align: center;
    margin: 20px 0;
}

.ready-play-icon, and width: 72px;
    height: 72px;
    margin: 0 auto 18px;
    color: var(--accent-green);
    filter: drop-shadow(0 0 12px rgba(192, 255, 0, 0.3));
}

.ready-title.

## File Activity
```mermaid
flowchart TD
    Start([Start])
    N0[Style /* ============================================================
   CodiNeo â€” Component Styles
   Page-specific and reusable components
   ============================================================ */

/* â”€â”€ Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.dashboard-header]
    N1[Style display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
}

/* â”€â”€ Analysis New Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.ready-card]
    N2[Style background: var(--bg-surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 40px 24px;
    text-align: center;
    margin: 20px 0;
}

.ready-play-icon]
    N3[Style width: 72px;
    height: 72px;
    margin: 0 auto 18px;
    color: var(--accent-green);
    filter: drop-shadow(0 0 12px rgba(192, 255, 0, 0.3));
}

.ready-title]
    N4[Style font-size: 20px;
    font-weight: 700;
    margin-bottom: 8px;
}

.ready-subtitle]
    N5[Style font-size: 14px;
    color: var(--text-secondary);
    max-width: 360px;
    margin: 0 auto;
}

/* â”€â”€ Results Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.results-project-header]
    End([End])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> End
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.

