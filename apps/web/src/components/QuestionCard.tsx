import type { OptionKey, PublicQuestion } from "@abc-game/domain";

interface Props {
  question: PublicQuestion;
  selected: OptionKey | null;
  onChoose: (choice: OptionKey) => void;
}

// A pergunta e as quatro alternativas, em botões grandes (uma mão, ao ar livre).
export function QuestionCard({ question, selected, onChoose }: Props) {
  return (
    <section className="question-card">
      <h2 className="question-statement">{question.statement}</h2>
      <div className="options">
        {question.options.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`option ${selected === option.key ? "selected" : ""}`}
            disabled={selected !== null}
            onClick={() => onChoose(option.key)}
          >
            <span className="option-key">{option.key}</span>
            <span className="option-text">{option.text}</span>
          </button>
        ))}
      </div>
      {selected !== null && <p className="hint">Resposta enviada. Aguardando o resultado…</p>}
    </section>
  );
}
