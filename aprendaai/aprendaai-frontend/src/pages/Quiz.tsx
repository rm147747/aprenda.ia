import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle } from "lucide-react";
import { api } from "@/api/client";
import type { Lesson, QuizResult } from "@/types";

export default function Quiz() {
  const [searchParams] = useSearchParams();
  const sessionId = Number(searchParams.get("session") || 0);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; explanation: string; text: string } | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) { navigate("/"); return; }
    api.getLesson(sessionId).then((data) => {
      if (data.status === "awaiting_approval") {
        setAwaitingApproval(true);
      } else if (data.lesson) {
        setLesson(data.lesson);
      }
      setLoading(false);
    });
  }, [sessionId, navigate]);

  if (awaitingApproval) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-blue-50 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <span className="text-6xl mb-4 block">👨‍🏫</span>
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Tua aula esta sendo preparada</h2>
          <p className="text-gray-500 mb-6">Seu pai ou sua mae esta dando uma olhadinha rapida antes.</p>
          <Button variant="outline" onClick={() => navigate("/")}>Voltar ao Inicio</Button>
        </div>
      </div>
    );
  }

  if (loading || !lesson) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-xl text-blue-400 animate-pulse">Carregando quiz...</div>
      </div>
    );
  }

  const quiz = lesson.quiz;
  const totalQ = quiz.length;
  const question = quiz[currentQ];
  const progress = ((currentQ + 1) / totalQ) * 100;

  const handleAnswer = async (optionIndex: number) => {
    if (feedback) return;
    setSelectedOption(optionIndex);
    setSubmitting(true);

    try {
      const res = await api.submitQuizResponse(sessionId, currentQ, optionIndex);
      setFeedback({
        isCorrect: res.is_correct,
        explanation: res.explanation,
        text: res.feedback,
      });
      setResults([...results, {
        question_index: currentQ,
        selected_option: optionIndex,
        is_correct: res.is_correct,
      }]);
    } catch {
      // Fallback local evaluation
      const isCorrect = optionIndex === question.correct;
      setFeedback({
        isCorrect,
        explanation: question.explanation,
        text: isCorrect ? "Muito bem!" : "Tente novamente na proxima!",
      });
      setResults([...results, {
        question_index: currentQ,
        selected_option: optionIndex,
        is_correct: isCorrect,
      }]);
    }
    setSubmitting(false);
  };

  const handleNext = () => {
    if (currentQ < totalQ - 1) {
      setCurrentQ(currentQ + 1);
      setSelectedOption(null);
      setFeedback(null);
    } else {
      // Quiz complete - navigate to result
      const updatedResults = results;
      const encoded = encodeURIComponent(JSON.stringify(updatedResults));
      navigate(`/lesson/result?session=${sessionId}&results=${encoded}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-green-50 flex flex-col items-center p-6">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800 mb-2">Quiz de Fixacao</h1>
          <div className="flex items-center gap-3">
            <Progress value={progress} className="flex-1" />
            <span className="text-sm text-gray-500">
              {currentQ + 1}/{totalQ}
            </span>
          </div>
        </div>

        <Card className="mb-6 border-l-4 border-l-purple-400">
          <CardContent className="pt-6">
            <p className="text-lg font-medium text-gray-800 mb-6">{question.question}</p>
            <div className="space-y-3">
              {question.options.map((opt, idx) => {
                let btnClass = "w-full text-left py-4 px-4 text-base justify-start";
                if (feedback) {
                  if (idx === question.correct) {
                    btnClass += " bg-green-100 border-green-400 text-green-700";
                  } else if (idx === selectedOption && !feedback.isCorrect) {
                    btnClass += " bg-orange-100 border-orange-400 text-orange-700";
                  }
                }
                return (
                  <Button
                    key={idx}
                    variant="outline"
                    className={btnClass}
                    onClick={() => handleAnswer(idx)}
                    disabled={!!feedback || submitting}
                  >
                    {feedback && idx === question.correct && (
                      <CheckCircle className="w-5 h-5 mr-2 text-green-500 shrink-0" />
                    )}
                    {feedback && idx === selectedOption && !feedback.isCorrect && idx !== question.correct && (
                      <XCircle className="w-5 h-5 mr-2 text-orange-500 shrink-0" />
                    )}
                    {opt}
                  </Button>
                );
              })}
            </div>

            {feedback && (
              <div className={`mt-4 p-4 rounded-lg ${
                feedback.isCorrect ? "bg-green-50" : "bg-orange-50"
              }`}>
                <p className={`font-medium ${
                  feedback.isCorrect ? "text-green-700" : "text-orange-700"
                }`}>
                  {feedback.text}
                </p>
                {feedback.explanation && (
                  <p className="text-sm text-gray-600 mt-1">{feedback.explanation}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {feedback && (
          <Button
            className="w-full py-5 text-base bg-blue-500 hover:bg-blue-600"
            onClick={handleNext}
          >
            {currentQ < totalQ - 1 ? "Proxima Pergunta" : "Ver Resultado"}
          </Button>
        )}
      </div>
    </div>
  );
}
