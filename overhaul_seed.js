const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'Codebase/Backend/src/db/seeds/learningModules.seed.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const patternNames = [
  'Singleton', 'Factory Method', 'Abstract Factory', 'Factory', 'Builder', 'Prototype', 'Adapter', 'Bridge',
  'Composite', 'Decorator', 'Facade', 'Flyweight', 'Proxy',
  'Chain of Responsibility', 'Command', 'Interpreter', 'Iterator',
  'Mediator', 'Memento', 'Observer', 'State', 'Strategy',
  'Template Method', 'Visitor', 'Method Chaining'
];

const patternRegex = new RegExp(patternNames.join('|'), 'i');

const highLevels = ["applying", "analyzing", "evaluating", "creating"];
const lowLevels = ["remembering", "understanding"];

function cleanFoundations(module) {
  if (!module.theoreticalExam || !module.theoreticalExam.questions) return;

  module.theoreticalExam.questions = module.theoreticalExam.questions.filter(q => {
    const questionMentions = patternRegex.test(q.question);
    const optionsMention = q.options && q.options.some(o => patternRegex.test(o));
    return !questionMentions && !optionsMention;
  });

  const currentCount = module.theoreticalExam.questions.length;
  if (currentCount < 10) {
    const needed = 10 - currentCount;
    const foundationQuestions = [
      (m) => ({
        question: `Why is the concept of "${m.title}" important for software engineering foundations?`,
        options: [
          "It provides a conceptual framework for managing complexity without relying on specific implementations.",
          "It is the only way to write high-performance code.",
          "It is required by the C++ language standard.",
          "It eliminates the need for any further design decisions."
        ],
        correctIndex: 0,
        explanation: "Foundational principles provide the 'why' behind software organization.",
        taxonomy: "remembering"
      }),
      (m) => ({
        question: `How does "${m.title}" contribute to the long-term maintainability of a software system?`,
        options: [
          "By establishing clear boundaries and responsibilities within the architecture.",
          "By ensuring the code is obfuscated to prevent unauthorized changes.",
          "By requiring that all code be written in a single file.",
          "By making the use of comments mandatory."
        ],
        correctIndex: 0,
        explanation: "Good foundations lead to maintainable code through clear structure.",
        taxonomy: "understanding"
      }),
      (m) => ({
        question: `What is a primary goal of studying "${m.title}" in the context of design principles?`,
        options: [
          "To understand the abstract shapes and relationships that recur in well-designed systems.",
          "To memorize specific API calls for a particular library.",
          "To learn how to bypass type safety in C++.",
          "To ensure that every class uses multiple inheritance."
        ],
        correctIndex: 0,
        explanation: "Principles focus on recurring abstract shapes and relationships.",
        taxonomy: "understanding"
      }),
      (m) => ({
        question: `Which of the following best describes the relationship between "${m.title}" and software quality?`,
        options: [
          "It serves as a guideline for creating robust and flexible software components.",
          "It guarantees that the software will be bug-free.",
          "It is only relevant for small, academic projects.",
          "It focuses exclusively on visual aesthetics of the code."
        ],
        correctIndex: 0,
        explanation: "Foundational concepts are guidelines for robust software.",
        taxonomy: "remembering"
      })
    ];

    for (let i = 0; i < needed; i++) {
      const qGen = foundationQuestions[i % foundationQuestions.length];
      module.theoreticalExam.questions.push(qGen(module));
    }
  }

  if (module.sections) {
    module.sections.forEach(s => {
      if (s.bullets) {
        s.bullets = s.bullets.filter(b => !patternRegex.test(b));
      }
    });
  }
}

function overhaulPatternModule(module) {
  if (!module.theoreticalExam || !module.theoreticalExam.questions) {
    module.theoreticalExam = { kind: "theoretical", questions: [] };
  }

  const questions = module.theoreticalExam.questions;
  const existingLow = questions.filter(q => lowLevels.includes(q.taxonomy));
  const existingHighMCQ = questions.filter(q => highLevels.includes(q.taxonomy));

  let newQuestions = [];
  
  const lowQuestionGens = [
    (m) => ({
      question: `What is the primary intent of the ${m.title} pattern?`,
      options: [
        `To provide a ${m.category} solution that improves structural integrity.`,
        "To reduce the lines of code by exactly half.",
        "To replace all other patterns in the system.",
        "To bypass the need for object-oriented principles."
      ],
      correctIndex: 0,
      explanation: `${m.title} is designed to solve specific ${m.category} problems.`,
      taxonomy: "understanding"
    }),
    (m) => ({
      question: `In which category does the ${m.title} pattern belong?`,
      options: [
        m.category.charAt(0).toUpperCase() + m.category.slice(1),
        "Architectural",
        "Procedural",
        "Meta-programming"
      ],
      correctIndex: 0,
      explanation: `${m.title} is a ${m.category} pattern.`,
      taxonomy: "remembering"
    }),
    (m) => ({
      question: `Which problem is the ${m.title} pattern most likely to solve?`,
      options: [
        `A recurring issue in the ${m.category} phase of software design.`,
        "A syntax error in the compiler.",
        "A lack of disk space on the server.",
        "An issue with the user's internet connection."
      ],
      correctIndex: 0,
      explanation: `Patterns solve recurring design problems.`,
      taxonomy: "understanding"
    }),
    (m) => ({
      question: `What is a key benefit of using the ${m.title} pattern?`,
      options: [
        "Improved communication between objects and better system structure.",
        "It makes the binary size significantly smaller.",
        "It eliminates the need for unit tests.",
        "It is required for the code to compile in C++."
      ],
      correctIndex: 0,
      explanation: `Patterns improve communication and structure.`,
      taxonomy: "understanding"
    }),
    (m) => ({
      question: `Which of these is a participant in the ${m.title} pattern?`,
      options: [
        "A role defined by the pattern's structure.",
        "The C++ compiler itself.",
        "A global hardware driver.",
        "A network protocol."
      ],
      correctIndex: 0,
      explanation: `Patterns define roles for various participants.`,
      taxonomy: "remembering"
    })
  ];

  for (let i = 0; i < 5; i++) {
    if (existingLow[i]) {
      newQuestions.push(existingLow[i]);
    } else {
      const qGen = lowQuestionGens[i % lowQuestionGens.length];
      newQuestions.push(qGen(module));
    }
  }

  for (let i = 0; i < 3; i++) {
    newQuestions.push({
      type: "studio",
      prompt: `In the 'NeoTerritory' system, implement the ${module.title} pattern to handle ${module.category}-related logic in the game engine.`,
      targetPatternSlug: module.moduleId.split('-').pop(),
      explanation: `Studio task for implementing ${module.title}.`,
      taxonomy: highLevels[i % highLevels.length]
    });
  }

  newQuestions.push({
    type: "identification",
    question: `Examine the provided code structure. Which role in the ${module.title} pattern is missing or incorrectly implemented?`,
    scenario: `A developer implemented the ${module.title} pattern, but the communication between the participants is tightly coupled, violating the pattern's decoupling goal.`,
    options: ["Decoupled Interface", "Concrete Implementation", "Client Code", "Static Registry"],
    correctIndex: 0,
    explanation: `Identifying structural flaws in ${module.title} implementation.`,
    taxonomy: "analyzing"
  });

  if (existingHighMCQ.length > 0) {
    newQuestions.push(existingHighMCQ[0]);
  } else {
    newQuestions.push({
      question: `Evaluate the trade-offs of applying the ${module.title} pattern in a system with high concurrency requirements.`,
      options: [
        "It provides clear structure but may introduce synchronization bottlenecks if not implemented carefully.",
        "It automatically solves all concurrency issues.",
        "It cannot be used in concurrent systems.",
        "It makes synchronization unnecessary."
      ],
      correctIndex: 0,
      explanation: `Patterns often have trade-offs regarding performance and complexity.`,
      taxonomy: "evaluating"
    });
  }

  module.theoreticalExam.questions = newQuestions;
}

data.forEach(module => {
  if (module.moduleId.startsWith('foundations-') || module.moduleId.startsWith('foundation-')) {
    cleanFoundations(module);
  } else {
    overhaulPatternModule(module);
  }
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('Overhaul complete.');
