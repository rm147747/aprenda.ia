import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, CheckCircle, XCircle, Sparkles } from "lucide-react";
import { api } from "@/api/client";
import type { LessonBlock, QuizQuestion } from "@/types";

export default function Review() {
  const [searchParams] = useSearchParams();
  const sessionId = Number(searchParams.get("session") || 0);
  const wrongParam = searchParams.get("wrong");
  const [blocks, setBlocks] = useState<LessonBlock[]>([]);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [motivation, setMotivation] = useState("");
  const [phase, setPhase] = useState<"blocks" | "quiz" | "done">("blocks");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId || !wrongParam) { navigate("/"); return; }
    try {
      const wrongIndices = JSON.parse(decodeURIComponent(wrongParam));
      api.generateReview(sessionId, wrongIndices).then((res) => {
        setBlocks(res.review_blocks || []);
        setQuiz(res.review_quiz || []);
        setMotivation(res.motivation || "Voce consegue!");
        setLoading(false);
      }).catch(() => { setLoading(false); });
    } catch {
      navigate("/");
    }
  }, [sessionId, wrongParam, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-yellow-50 flex flex-col items-center justify-center p-6">
        <Sparkles className="w-10 h-10 text-orange-400 mb-3 animate-pulse" />
        <p className="text-lg text-gray-600">Preparando revisao especial...</p>
      </div>
    );
  }

  const items = phase === "blocks" ? blocks : quiz;
  const totalItems = items.length;
  const progress = totalItems > 0 ? ((currentIdx + 1) / totalItems) * 100 : 100;

  const handleAnswer = (optionIndex: number) => {
    if (answered) return;
    setSelectedOption(optionIndex);
    setAnswered(true);
    const item = phase === "blocks" ? blocks[currentIdx] : quiz[currentIdx];
    const correct = phase === "blocks"
      ? (item as LessonBlock).correct
      : (item as QuizQuestion).correct;
    const result = optionIndex === correct;
    setIsCorrect(result);
    if (phase === "quiz" && result) {
      setQuizCorrect(quizCorrect + 1);
    }
  };

  const handleNext = () => {
    if (currentIdx < totalItems - 1) {
      setCurrentIdx(currentIdx + 1);
      setSelectedOption(null);
      setAnswered(false);
      setIsCorrect(false);
    } else if (phase === "blocks" && quiz.length > 0) {
      setPhase("quiz");
      setCurrentIdx(0);
      setSelectedOption(null);
      setAnswered(false);
      setIsCorrect(false);
    } else {
      setPhase("done");
    }
  };

  if (phase === "done") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-blue-50 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-lg">
          <span className="text-5xl mb-4 block">🌟</span>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Revisao completa!</h2>
          <p className="text-gray-600 mb-6">{motivation}</p>
          <Button
            className="w-full py-5 bg-blue-500 hover:bg-blue-600"
            onClick={() => navigate("/")}
          >
            Voltar ao Inicio
          </Button>
        </div>
      </div>
    );
  }

  const currentItem = items[currentIdx];
  const isCheckpoint = phase === "blocks" && (currentItem as LessonBlock).type === "checkpoint";
  const isExplanation = phase === "blocks" && (currentItem as LessonBlock).type === "explanation";

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-yellow-50 flex flex-col items-center p-6">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            {phase === "blocks" ? "Revisao" : "Quiz de Revisao"}
          </h1>
          <div className="flex items-center gap-3">
            <Progress value={progress} className="flex-1" />
            <span className="text-sm text-gray-500">{currentIdx + 1}/{totalItems}</span>
          </div>
        </div>

        {isExplanation && (
          <Card className="mb-6 border-l-4 border-l-orange-400">
            <CardContent className="pt-6">
              <h3 className="text-lg font-bold text-orange-600 mb-3">
                {(currentItem as LessonBlock).title}
              </h3>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {(currentItem as LessonBlock).content}
              </p>
            </CardContent>
          </Card>
        )}

        {(isCheckpoint || phase === "quiz") && (
          <Card className="mb-6 border-l-4 border-l-purple-400">
            <CardContent className="pt-6">
              <p className="text-lg font-medium text-gray-800 mb-4">
                {phase === "quiz"
                  ? (currentItem as QuizQuestion).question
                  : (currentItem as LessonBlock).question}
              </p>
              <div className="space-y-3">
                {(phase === "quiz"
                  ? (currentItem as QuizQuestion).options
                  : (currentItem as LessonBlock).options || []
                ).map((opt, idx) => {
                  const correct = phase === "quiz"
                    ? (currentItem as QuizQuestion).correct
                    : (currentItem as LessonBlock).correct;
                  let cls = "w-full text-left py-4 px-4 text-base justify-start";
                  if (answered) {
                    if (idx === correct) cls += " bg-green-100 border-green-400 text-green-700";
                    else if (idx === selectedOption && !isCorrect) cls += " bg-orange-100 border-orange-400 text-orange-700";
                  }
                  return (
                    <Button
                      key={idx}
                      variant="outline"
                      className={cls}
                      onClick={() => handleAnswer(idx)}
                      disabled={answered}
                    >
                      {answered && idx === correct && <CheckCircle className="w-5 h-5 mr-2 text-green-500 shrink-0" />}
                      {answered && idx === selectedOption && !isCorrect && idx !== correct && <XCircle className="w-5 h-5 mr-2 text-orange-500 shrink-0" />}
                      {opt}
                    </Button>
                  );
                })}
              </div>
              {answered && (
                <div className={`mt-4 p-3 rounded-lg text-sm ${isCorrect ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}`}>
                  {isCorrect ? "Agora sim! 🌟" : "Vamos continuar praticando!"}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(isExplanation || answered) && (
          <Button className="w-full py-5 text-base bg-orange-400 hover:bg-orange-500" onClick={handleNext}>
            Proximo <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
