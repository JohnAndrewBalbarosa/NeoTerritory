// Survey question wording — copied verbatim from docs/Questionnaire/REFERENCE.md.
// Do NOT paraphrase. Section IDs (B.3, C.13, etc.) are preserved as `id`
// so the payload tells the DB which question was answered.

export interface SurveyQuestion {
  id: string;
  text: string;
  kind: 'star' | 'open';
}

export interface OpenEndedGroups {
  perRun: SurveyQuestion[];
  signout: SurveyQuestion[];
}

// Questionnaire A — Pre-Test (Respondent Profile).
// The validated wording for A is NOT yet in REFERENCE.md (export was missing
// Section A's title block). Leaving empty so the gate auto-skips. Once the
// validated text is pasted into REFERENCE.md, populate this array.
export const pretest: SurveyQuestion[] = [];

// Per-Run Quality Survey — star ratings (B.3 – B.7).
export const perRun: SurveyQuestion[] = [
  { id: 'B.3', kind: 'star', text: 'The generated documentation is clear and understandable.' },
  { id: 'B.4', kind: 'star', text: 'The documentation explains the purpose of the analyzed code.' },
  { id: 'B.5', kind: 'star', text: 'The detected design-pattern evidence helps me connect design-pattern concepts to actual C++ code.' },
  { id: 'B.6', kind: 'star', text: 'The explanations help me understand why certain code structures may relate to a design pattern.' },
  { id: 'B.7', kind: 'star', text: 'The generated unit-test targets help me identify what parts of the code may need testing.' }
];

// Sign-Out Survey — star ratings.
export const signoutStars: SurveyQuestion[] = [
  { id: 'B.1',  kind: 'star', text: 'The system helps me understand unfamiliar C++ source code.' },
  { id: 'B.2',  kind: 'star', text: 'The system helps me identify important parts of the analyzed code.' },
  { id: 'B.8',  kind: 'star', text: 'The unit-test targets help me understand the expected behavior of the analyzed code.' },
  { id: 'B.9',  kind: 'star', text: 'The system would be useful during internship onboarding.' },
  { id: 'B.10', kind: 'star', text: 'Overall, the system is useful for code understanding, documentation, and design-pattern learning.' },
  { id: 'C.11', kind: 'star', text: 'The system interface is easy to understand.' },
  { id: 'C.12', kind: 'star', text: 'It is easy to enter or paste C++ code into the system.' },
  { id: 'C.13', kind: 'star', text: 'I can understand what the system is trying to show after analysis.' },
  { id: 'C.14', kind: 'star', text: 'The displayed results are organized clearly.' },
  { id: 'C.15', kind: 'star', text: 'The system is easy to use even with minimal assistance.' },
  { id: 'D.16', kind: 'star', text: 'The system loads and responds within an acceptable time.' },
  { id: 'D.17', kind: 'star', text: 'The system generates analysis results without noticeable delays.' },
  { id: 'D.18', kind: 'star', text: 'The system remains responsive while processing submitted C++ code.' },
  { id: 'E.19', kind: 'star', text: 'The system works consistently when analyzing valid C++ code.' },
  { id: 'E.20', kind: 'star', text: 'The system provides clear feedback when the submitted code cannot be analyzed properly.' },
  { id: 'E.21', kind: 'star', text: 'The system produces stable results when similar C++ inputs are analyzed.' },
  { id: 'F.22', kind: 'star', text: 'I feel that the system handles submitted code and user responses responsibly.' },
  { id: 'F.23', kind: 'star', text: 'The system provides enough assurance that submitted information will be used only for the intended academic purpose.' },
  { id: 'F.24', kind: 'star', text: 'The system protects user responses and submitted information from unauthorized disclosure.' }
];

// Open-ended groups.
export const openEnded: OpenEndedGroups = {
  perRun: [
    { id: 'B.G.3', kind: 'open', text: 'Did the generated documentation help you understand the code? Why or why not?' },
    { id: 'B.G.4', kind: 'open', text: 'Did the detected design-pattern evidence help you understand the code structure? Why or why not?' }
  ],
  signout: [
    { id: 'B.G.1', kind: 'open', text: 'Which part of the system helped you understand the code the most?' },
    { id: 'B.G.2', kind: 'open', text: 'Which part of the system was confusing or difficult to understand?' },
    { id: 'B.G.5', kind: 'open', text: 'What improvements would make the system more useful for interns or novice developers?' }
  ]
};

// Data Privacy Act notice — verbatim from REFERENCE.md.
export const consentNotice =
  'In compliance with the Data Privacy Act of 2012 (Republic Act No. 10173), all information collected through this questionnaire will be treated with strict confidentiality and used solely for academic research purposes. Participation is voluntary, and respondents may refuse to answer any question or withdraw at any time. All responses will be analyzed and reported only in summarized form, and no personal information will be disclosed in the final study or related outputs. By proceeding with this questionnaire, you acknowledge that you have read and understood this notice and voluntarily consent to the collection and use of your responses for the stated research purpose.';

export const consentAcknowledgement =
  'I have read and understood this notice and voluntarily consent.';

export const consentVersion = '2026-05-01';
