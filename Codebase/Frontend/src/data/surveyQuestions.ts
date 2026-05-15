// Canonical questionnaire. The instrument was revised on 2026-05-15:
// open-ended items were removed in their entirety; Section A is a
// respondent profile (categorical) attached to the sign-out submission;
// Sections B–F are 19 Likert items split across the per-run modal and
// the sign-out survey.

export interface SurveyQuestion {
  id: string;
  text: string;
  kind: 'star' | 'open';
}

export interface ProfileChoice {
  value: number;
  label: string;
}

export interface ProfileQuestion {
  id: string;
  text: string;
  choices: ProfileChoice[];
}

export interface OpenEndedGroups {
  perRun: SurveyQuestion[];
  signout: SurveyQuestion[];
}

// Section A — respondent profile, encoded as ordinal codes inside the
// existing `ratings` map on the sign-out submission. Excluded from
// Likert mean roll-ups by the stats consumer.
export const profile: ProfileQuestion[] = [
  {
    id: 'A.1',
    text: 'Current year level',
    choices: [
      { value: 1, label: 'First year' },
      { value: 2, label: 'Second year' },
      { value: 3, label: 'Third year' },
      { value: 4, label: 'Fourth year' },
      { value: 5, label: 'Others' }
    ]
  },
  {
    id: 'A.2',
    text: 'Programming experience',
    choices: [
      { value: 1, label: 'Less than 1 year' },
      { value: 2, label: '1–2 years' },
      { value: 3, label: '3–4 years' },
      { value: 4, label: 'More than 4 years' }
    ]
  },
  {
    id: 'A.3',
    text: 'Familiarity with C++',
    choices: [
      { value: 1, label: 'Not familiar' },
      { value: 2, label: 'Beginner' },
      { value: 3, label: 'Intermediate' },
      { value: 4, label: 'Advanced' }
    ]
  },
  {
    id: 'A.4',
    text: 'Familiarity with object-oriented programming',
    choices: [
      { value: 1, label: 'Not familiar' },
      { value: 2, label: 'Beginner' },
      { value: 3, label: 'Intermediate' },
      { value: 4, label: 'Advanced' }
    ]
  },
  {
    id: 'A.5',
    text: 'Familiarity with design patterns',
    choices: [
      { value: 1, label: 'Not familiar' },
      { value: 2, label: 'Beginner' },
      { value: 3, label: 'Intermediate' },
      { value: 4, label: 'Advanced' }
    ]
  }
];

// Pre-test gate retained as an empty array — the runtime gate skips
// itself when this is empty, matching the prior contract.
export const pretest: SurveyQuestion[] = [];

// Per-run survey — five items focused on the just-completed analysis.
export const perRun: SurveyQuestion[] = [
  { id: 'B.3', kind: 'star', text: 'The system helps me understand unfamiliar C++ source code.' },
  { id: 'B.4', kind: 'star', text: 'The system helps me identify important parts of the analyzed code.' },
  { id: 'B.5', kind: 'star', text: 'The system helps me connect design-pattern concepts to actual C++ code.' },
  { id: 'B.6', kind: 'star', text: 'The generated documentation helps me understand the structure, purpose, and important parts of the analyzed source code.' },
  { id: 'B.7', kind: 'star', text: 'The generated unit-test targets or testing focus areas help me recognize possible areas of the analyzed code that may require further checking.' }
];

// Sign-out Likert items — fourteen whole-system items spanning the
// five quality characteristics that aren't tied to a single run.
export const signoutStars: SurveyQuestion[] = [
  { id: 'B.1',  kind: 'star', text: 'The learning modules help me understand selected software design-pattern concepts.' },
  { id: 'B.2',  kind: 'star', text: 'The examples in the learning modules help me understand how design patterns may appear in code.' },
  { id: 'B.8',  kind: 'star', text: 'CodiNeo is useful as a learning support tool for DEVCON Luzon interns or novice developers.' },
  { id: 'C.9',  kind: 'star', text: 'The system interface is easy to understand.' },
  { id: 'C.10', kind: 'star', text: 'It is easy to access and navigate the learning modules.' },
  { id: 'C.11', kind: 'star', text: 'It is easy to enter, paste, or submit C++ code into the system.' },
  { id: 'C.12', kind: 'star', text: 'The analysis results are organized clearly.' },
  { id: 'C.13', kind: 'star', text: 'The detected design-pattern evidence and highlighted code structures are easy to understand.' },
  { id: 'D.14', kind: 'star', text: 'The system loads, responds, and generates analysis results within an acceptable time.' },
  { id: 'D.15', kind: 'star', text: 'The system responds quickly enough when I move between learning modules, analysis results, documentation outputs, and questionnaire sections.' },
  { id: 'E.16', kind: 'star', text: 'The system provides clear feedback when the submitted code cannot be analyzed properly.' },
  { id: 'E.17', kind: 'star', text: 'The system produces stable results when similar C++ inputs are analyzed.' },
  { id: 'F.18', kind: 'star', text: 'The system handles submitted code and user responses responsibly.' },
  { id: 'F.19', kind: 'star', text: 'The system protects user responses and submitted information from unauthorized disclosure.' }
];

// Open-ended groups retained as empty arrays so existing imports keep
// type-checking; the revised instrument has no open-ended items.
export const openEnded: OpenEndedGroups = {
  perRun: [],
  signout: []
};

// Data Privacy Act notice — verbatim from REFERENCE.md.
export const consentNotice =
  'In compliance with the Data Privacy Act of 2012 (Republic Act No. 10173), all information collected through this questionnaire will be treated with strict confidentiality and used solely for academic research purposes. Participation is voluntary, and respondents may refuse to answer any question or withdraw at any time. All responses will be analyzed and reported only in summarized form, and no personal information will be disclosed in the final study or related outputs. By proceeding with this questionnaire, you acknowledge that you have read and understood this notice and voluntarily consent to the collection and use of your responses for the stated research purpose.';

export const consentAcknowledgement =
  'By answering the questionnaire, I acknowledge that I have read and understood the Letter to the Participants and the Data Privacy Notice. I also voluntarily consent to the collection, use, and processing of my responses for the stated academic research purpose.';

export const consentVersion = '2026-05-15';
