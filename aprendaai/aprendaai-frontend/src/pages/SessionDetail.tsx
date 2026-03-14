import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { api } from "@/api/client";
import type { SessionDetail as SessionDetailType } from "@/types";

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) { navigate("/parents/dashboard"); return; }
    api.getSessionDetail(Number(id)).then((d) => {
      setSession(d);
      setLoading(false);
    }).catch(() => {
      navigate("/parents/dashboard");
    });
  }, [id, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Carregando...</p>
      </div>
    );
  }

  const pct = session.total_questions
    ? Math.round((session.correct_answers / session.total_questions) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          className="mb-4 text-gray-500"
          onClick={() => navigate("/parents/dashboard")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Painel
        </Button>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800">{session.topic}</h1>
          <p className="text-sm text-gray-500">
            {session.child_name} ({session.child_age} anos) •{" "}
            {new Date(session.started_at).toLocaleDateString("pt-BR")} •{" "}
            {session.duration_min} min
          </p>
        </div>

        {/* Summary */}
        {session.summary_text && (
          <Card className="mb-4">
            <CardContent className="pt-4">
              <h3 className="font-medium text-gray-700 mb-2">Resumo</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {session.summary_text}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card>
            <CardContent className="pt-3 pb-3 text-center">
              <p className="text-xl font-bold text-gray-800">{pct}%</p>
              <p className="text-xs text-gray-500">Acerto</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3 text-center">
              <p className="text-xl font-bold text-gray-800">
                {session.correct_answers}/{session.total_questions}
              </p>
              <p className="text-xs text-gray-500">Questoes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3 text-center">
              <Badge
                variant="secondary"
                className={
                  session.comprehension === "alto" ? "bg-green-100 text-green-700" :
                  session.comprehension === "medio" ? "bg-yellow-100 text-yellow-700" :
                  "bg-orange-100 text-orange-700"
                }
              >
                {session.comprehension || "—"}
              </Badge>
              <p className="text-xs text-gray-500 mt-1">Compreensao</p>
            </CardContent>
          </Card>
        </div>

        {/* Weak points */}
        {session.weak_points.length > 0 && (
          <Card className="mb-4">
            <CardContent className="pt-4">
              <h3 className="font-medium text-gray-700 mb-2">Pontos Fracos</h3>
              <ul className="space-y-1">
                {session.weak_points.map((wp, i) => (
                  <li key={i} className="text-sm text-orange-600">• {wp}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {session.recommendations.length > 0 && (
          <Card className="mb-4">
            <CardContent className="pt-4">
              <h3 className="font-medium text-gray-700 mb-2">Recomendacoes</h3>
              <ul className="space-y-1">
                {session.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-blue-600">• {rec}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Quiz responses */}
        {session.quiz_responses.length > 0 && (
          <Card className="mb-4">
            <CardContent className="pt-4">
              <h3 className="font-medium text-gray-700 mb-3">Respostas do Quiz</h3>
              <div className="space-y-3">
                {session.quiz_responses.map((r, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border ${
                      r.is_correct ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {r.is_correct ? (
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm text-gray-700">{r.question_text}</p>
                        {!r.is_correct && r.attempt > 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            Tentativa {r.attempt}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
