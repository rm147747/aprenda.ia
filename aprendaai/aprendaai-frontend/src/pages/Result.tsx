import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Home, RefreshCw, Sparkles } from "lucide-react";
import { api } from "@/api/client";
import type { QuizResult, CompleteResponse } from "@/types";

export default function Result() {
  const [searchParams] = useSearchParams();
  const sessionId = Number(searchParams.get("session") || 0);
  const resultsParam = searchParams.get("results");
  const [data, setData] = useState<CompleteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId || !resultsParam) { navigate("/"); return; }
    try {
      const quizResults: QuizResult[] = JSON.parse(decodeURIComponent(resultsParam));
      api.completeSession(sessionId, quizResults).then((res) => {
        setData(res);
        setLoading(false);
      }).catch(() => setLoading(false));
    } catch {
      navigate("/");
    }
  }, [sessionId, resultsParam, navigate]);

  const handleReview = async () => {
    if (!data) return;
    setReviewLoading(true);
    try {
      const quizResults: QuizResult[] = JSON.parse(decodeURIComponent(resultsParam || "[]"));
      const wrongIndices = quizResults.filter(r => !r.is_correct).map(r => r.question_index);
      navigate(`/lesson/review?session=${sessionId}&wrong=${encodeURIComponent(JSON.stringify(wrongIndices))}`);
    } catch {
      setReviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-10 h-10 text-yellow-400 mx-auto mb-3 animate-pulse" />
          <p className="text-lg text-gray-500">Calculando resultado...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-green-50 flex flex-col items-center justify-center p-6">
        <p className="text-red-500 mb-4">Erro ao carregar resultado</p>
        <Button onClick={() => navigate("/")}>Voltar</Button>
      </div>
    );
  }

  const stars = data.stars_earned;

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-green-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg text-center">
        <div className="mb-6">
          <div className="flex justify-center gap-2 mb-4">
            {Array.from({ length: stars }).map((_, i) => (
              <Star
                key={i}
                className="w-10 h-10 text-yellow-400 fill-yellow-400"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {stars >= 4 ? "Incrivel!" : stars >= 2 ? "Muito bem!" : "Bom trabalho!"}
          </h1>
          <p className="text-gray-500">
            Voce ganhou {stars} {stars === 1 ? "estrela" : "estrelas"}!
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Total: {data.total_stars} estrelas
          </p>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <p className="text-gray-700 leading-relaxed">
              {data.summary.summary_text}
            </p>
            {data.summary.comprehension_level && (
              <div className="mt-3">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  data.summary.comprehension_level === "alto"
                    ? "bg-green-100 text-green-700"
                    : data.summary.comprehension_level === "medio"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-orange-100 text-orange-700"
                }`}>
                  Compreensao: {data.summary.comprehension_level}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {data.needs_review && (
            <Button
              className="w-full py-5 text-base bg-orange-400 hover:bg-orange-500"
              onClick={handleReview}
              disabled={reviewLoading}
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              {reviewLoading ? "Preparando revisao..." : "Revisar o que errei"}
            </Button>
          )}

          <Button
            className="w-full py-5 text-base bg-blue-500 hover:bg-blue-600"
            onClick={() => navigate("/")}
          >
            <Home className="w-5 h-5 mr-2" />
            Voltar ao Inicio
          </Button>
        </div>
      </div>
    </div>
  );
}
