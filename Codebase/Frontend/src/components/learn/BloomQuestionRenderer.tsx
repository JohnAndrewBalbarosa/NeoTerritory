import React, { useState, useEffect } from 'react';
import { ExamQuestion, isMcqQuestion, isIdentificationQuestion, isStudioQuestion } from '../../data/learningModules';
import StudioSurface from '../studio/StudioSurface';
import { AnalysisRun } from '../../types/api';

interface BloomQuestionRendererProps {
  question: ExamQuestion;
  onAnswer: (answer: any) => void;
  showResult?: boolean;
  userAnswer?: any;
}

export const BloomQuestionRenderer: React.FC<BloomQuestionRendererProps> = ({
  question,
  onAnswer,
  showResult,
  userAnswer,
}) => {
  if (isMcqQuestion(question)) {
    return (
      <McqRenderer
        question={question}
        onAnswer={onAnswer}
        showResult={showResult}
        userAnswer={userAnswer}
      />
    );
  }

  if (isIdentificationQuestion(question)) {
    return (
      <IdentificationRenderer
        question={question}
        onAnswer={onAnswer}
        showResult={showResult}
        userAnswer={userAnswer}
      />
    );
  }

  if (isStudioQuestion(question)) {
    return (
      <StudioRenderer
        question={question}
        onAnswer={onAnswer}
        showResult={showResult}
        userAnswer={userAnswer}
      />
    );
  }

  return <div>Unknown question type</div>;
};

const McqRenderer: React.FC<{
  question: any;
  onAnswer: (answer: number) => void;
  showResult?: boolean;
  userAnswer?: number;
}> = ({ question, onAnswer, showResult, userAnswer }) => {
  return (
    <div className="nt-bloom-question nt-bloom-question--mcq">
      <p className="nt-bloom-question__prompt">{question.question}</p>
      {question.code && (
        <pre className="nt-bloom-question__code">
          <code>{question.code}</code>
        </pre>
      )}
      <div className="nt-bloom-question__options">
        {question.options.map((option: string, index: number) => {
          const isSelected = userAnswer === index;
          const isCorrect = showResult && index === question.correctIndex;
          const isWrong = showResult && isSelected && index !== question.correctIndex;

          return (
            <label
              key={index}
              className="nt-bloom-question__option"
              data-selected={isSelected}
              data-correct={isCorrect}
              data-wrong={isWrong}
            >
              <input
                type="radio"
                name={question.question}
                checked={isSelected}
                onChange={() => onAnswer(index)}
                disabled={showResult}
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
      {showResult && question.explanation && (
        <p className="nt-bloom-question__explanation">{question.explanation}</p>
      )}
    </div>
  );
};

const IdentificationRenderer: React.FC<{
  question: any;
  onAnswer: (answer: string[]) => void;
  showResult?: boolean;
  userAnswer?: string[];
}> = ({ question, onAnswer, showResult, userAnswer = [] }) => {
  const [tokens, setTokens] = useState<string[]>(userAnswer);

  useEffect(() => {
    setTokens(userAnswer);
  }, [userAnswer]);

  const handleTokenChange = (index: number, value: string) => {
    const newTokens = [...tokens];
    newTokens[index] = value;
    setTokens(newTokens);
    onAnswer(newTokens);
  };

  return (
    <div className="nt-bloom-question nt-bloom-question--identification">
      <p className="nt-bloom-question__prompt">{question.question}</p>
      <div className="nt-bloom-question__scenario">
        <strong>Scenario:</strong>
        <p>{question.scenario}</p>
      </div>
      <div className="nt-bloom-question__inputs">
        {question.expectedTokens.map((expected: string, index: number) => {
          const currentVal = tokens[index] || '';
          const isCorrect = showResult && currentVal.trim().toLowerCase() === expected.trim().toLowerCase();

          return (
            <div key={index} className="nt-bloom-question__field">
              <label>Token {index + 1}:</label>
              <input
                type="text"
                value={currentVal}
                onChange={(e) => handleTokenChange(index, e.target.value)}
                disabled={showResult}
                className={showResult ? (isCorrect ? 'nt-input--correct' : 'nt-input--wrong') : ''}
              />
              {showResult && !isCorrect && (
                <span className="nt-bloom-question__expected"> (Expected: {expected})</span>
              )}
            </div>
          );
        })}
      </div>
      {showResult && question.explanation && (
        <p className="nt-bloom-question__explanation">{question.explanation}</p>
      )}
    </div>
  );
};

const StudioRenderer: React.FC<{
  question: any;
  onAnswer: (answer: boolean) => void;
  showResult?: boolean;
  userAnswer?: boolean;
}> = ({ question, onAnswer, showResult, userAnswer }) => {
  const handlePatternDetected = (_run: AnalysisRun) => {
    if (!showResult) {
      onAnswer(true);
    }
  };

  return (
    <div className="nt-bloom-question nt-bloom-question--studio">
      <p className="nt-bloom-question__prompt">{question.prompt}</p>
      {userAnswer && (
        <div className="nt-bloom-question__success-banner">
          Pattern "{question.targetPatternSlug}" successfully detected!
        </div>
      )}
      <div className="nt-studio-frame">
        <StudioSurface
          targetPatternSlug={question.targetPatternSlug}
          onPatternDetected={handlePatternDetected}
        />
      </div>
    </div>
  );
};
