import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, CheckCircle, XCircle, Sparkles, Home } from "lucide-react";
import { api } from "@/api/client";
import type { ReviewItem } from "@/types";

const LIMIT = 10;

export default function ReviewDue() {
  const [searchParams] = useSearchParams();
  const childId = Number(searchParams.get("child") || 0);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; correctOption: number } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!childId) { navigate("/"); return; }
    api.getDue(childId, LIMIT).then((data) => {
      setItems(data.items);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [childId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-yellow-50 flex flex-col items-center justify-center p-6">
        <Sparkles className="w-10 h-10 text-orange-400 mb-3 animate-pulse" />
        <p className="text-lg text-gray-600">Preparando sua revisao...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-blue-50 flex flex-col items-center justify-center p-6">
        <span className="text-5xl mb-4">🎉</span>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Nada pra revisar agora!</h2>
        <p className="text-gray-600 mb-6">Volte mais tarde quando tiver itens pra reforcar.</p>
        <Button onClick={() => navigate("/")}>
          <Home className="w-4 h-4 mr-2" />Voltar ao Inicio
        </Button>
      </div>
    );
  }

  if (currentIdx >= items.length) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-blue-50 flex flex-col items-center justify-center p-6">
        <span className="text-5xl mb-4">🌟</span>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Revisao completa!</h2>
        <p className="text-gray-600 mb-6">Acertou {correctCount} de {items.length}.</p>
        <Button onClick={() => navigate("/")}>
          <Home className="w-4 h-4 mr-2" />Voltar ao Inicio
        </Button>
      </div>
    );
  }

  const item = items[currentIdx];
  const progress = ((currentIdx + 1) / items.length) * 100;

  const handleAnswer = async (optionIdx: number) => {
    if (feedback || submitting) return;
    setSelectedOption(optionIdx);
    setSubmitting(true);
    try {
      const res = await api.answerReviewItem(item.id, optionIdx);
      setFeedback({ isCorrect: res.is_correct, correctOption: res.correct_option });
      if (res.is_correct) setCorrectCount((c) => c + 1);
    } catch {
      const isCorrect = optionIdx === item.correct_option;
      setFeedback({ isCorrect, correctOption: item.correct_option });
      if (isCorrect) setCorrectCount((c) => c + 1);
    }
    setSubmitting(false);
  };

  const handleNext = () => {
    setCurrentIdx(currentIdx + 1);
    setSelectedOption(null);
    setFeedback(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-yellow-50 flex flex-col items-center p-6">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800 mb-2">Revisao do dia</h1>
          <div className="flex items-center gap-3">
            <Progress value={progress} className="flex-1" />
            <span className="text-sm text-gray-500">{currentIdx + 1}/{items.length}</span>
          </div>
        </div>

        <Card className="mb-6 border-l-4 border-l-orange-400">
          <CardContent className="pt-6">
            <p className="text-lg font-medium text-gray-800 mb-4">{item.prompt}</p>
            {item.hint && (
              <p className="text-xs text-gray-400 mb-3 italic">Dica: {item.hint}</p>
            )}
            <div className="space-y-3">
              {item.options.map((opt, idx) => {
                let cls = "w-full text-left py-4 px-4 text-base justify-start";
                if (feedback) {
                  if (idx === feedback.correctOption) cls += " bg-green-100 border-green-400 text-green-700";
                  else if (idx === selectedOption && !feedback.isCorrect) cls += " bg-orange-100 border-orange-400 text-orange-700";
                }
                return (
                  <Button
                    key={idx}
                    variant="outline"
                    className={cls}
                    onClick={() => handleAnswer(idx)}
                    disabled={!!feedback || submitting}
                  >
                    {feedback && idx === feedback.correctOption && <CheckCircle className="w-5 h-5 mr-2 text-green-500 shrink-0" />}
                    {feedback && idx === selectedOption && !feedback.isCorrect && idx !== feedback.correctOption && <XCircle className="w-5 h-5 mr-2 text-orange-500 shrink-0" />}
                    {opt}
                  </Button>
                );
              })}
            </div>
            {feedback && (
              <div className={`mt-4 p-3 rounded-lg text-sm ${feedback.isCorrect ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}`}>
                {feedback.isCorrect ? "Boa! 🌟 Te vejo daqui a uns dias." : "Tudo bem — vamos ver de novo logo."}
              </div>
            )}
          </CardContent>
        </Card>

        {feedback && (
          <Button className="w-full py-5 text-base bg-orange-400 hover:bg-orange-500" onClick={handleNext}>
            {currentIdx < items.length - 1 ? (
              <>Proxima <ArrowRight className="w-4 h-4 ml-2" /></>
            ) : (
              <>Ver Resultado <Sparkles className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
