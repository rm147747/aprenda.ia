import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Star, BookOpen, AlertTriangle, LogOut, Bell, Shield } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { api } from "@/api/client";
import type { DashboardData, PendingLesson } from "@/types";

export default function ParentDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [pending, setPending] = useState<PendingLesson[]>([]);
  const [autoApprove, setAutoApprove] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("parent_token");
    if (!token) {
      navigate("/parents/login");
      return;
    }
    Promise.all([
      api.getDashboard(),
      api.getPending().catch(() => ({ pending: [] })),
      api.getSettings().catch(() => ({ auto_approve: false })),
    ]).then(([d, p, s]) => {
      setData(d);
      setPending(p.pending);
      setAutoApprove(s.auto_approve);
      if (d.children.length > 0) setSelectedChild(d.children[0].id);
      setLoading(false);
    }).catch(() => {
      localStorage.removeItem("parent_token");
      navigate("/parents/login");
    });
  }, [navigate]);

  const handleToggleAuto = async () => {
    setTogglingAuto(true);
    try {
      const res = await api.updateSettings(!autoApprove);
      setAutoApprove(res.auto_approve);
    } catch {
      // swallow — leave toggle as-is
    }
    setTogglingAuto(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("parent_token");
    navigate("/");
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Carregando painel...</p>
      </div>
    );
  }

  const child = data.children.find((c) => c.id === selectedChild);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold text-gray-800">Painel dos Pais</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-1" /> Sair
          </Button>
        </div>

        {/* B5: Pending lessons section */}
        {pending.length > 0 && (
          <Card className="mb-6 border-l-4 border-l-orange-400">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-4 h-4 text-orange-500" />
                <h3 className="font-medium text-gray-700">
                  Aulas pendentes ({pending.length})
                </h3>
              </div>
              <div className="space-y-2">
                {pending.map((p) => (
                  <div
                    key={p.session_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-orange-50 hover:bg-orange-100 cursor-pointer transition-colors"
                    onClick={() => navigate(`/parents/review/${p.session_id}`)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">
                        {p.avatar_emoji} {p.child_name} • {p.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(p.started_at).toLocaleDateString("pt-BR")} • {p.quiz_count} questoes
                        {p.edited && " • editada"}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-orange-200 text-orange-800 shrink-0 ml-2">
                      Revisar
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* B5: auto_approve toggle */}
        <Card className="mb-6">
          <CardContent className="pt-4 flex items-start gap-3">
            <Shield className={`w-5 h-5 mt-0.5 ${autoApprove ? "text-gray-400" : "text-green-500"}`} />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium text-gray-800 text-sm">
                    Aprovar aulas automaticamente
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {autoApprove
                      ? "Ligado: as criancas veem a aula assim que a IA termina."
                      : "Desligado: voce revisa cada aula antes da crianca ver."}
                  </p>
                </div>
                <Button
                  variant={autoApprove ? "outline" : "default"}
                  size="sm"
                  onClick={handleToggleAuto}
                  disabled={togglingAuto}
                >
                  {autoApprove ? "Desligar" : "Ligar"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Child selector */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          {data.children.map((c) => (
            <Button
              key={c.id}
              variant={selectedChild === c.id ? "default" : "outline"}
              className={selectedChild === c.id ? "bg-blue-500" : ""}
              onClick={() => setSelectedChild(c.id)}
            >
              {c.avatar_emoji} {c.name}
            </Button>
          ))}
        </div>

        {child && (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <BookOpen className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-gray-800">{child.total_sessions}</p>
                  <p className="text-xs text-gray-500">Sessoes</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <Clock className="w-5 h-5 text-green-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-gray-800">{child.total_study_time_min}</p>
                  <p className="text-xs text-gray-500">Minutos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <Star className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-gray-800">{child.total_stars}</p>
                  <p className="text-xs text-gray-500">Estrelas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <span className="text-lg">{
                    child.avg_comprehension === "alto" ? "🟢" :
                    child.avg_comprehension === "medio" ? "🟡" :
                    child.avg_comprehension === "baixo" ? "🟠" : "⚪"
                  }</span>
                  <p className="text-sm font-bold text-gray-800 capitalize">{child.avg_comprehension}</p>
                  <p className="text-xs text-gray-500">Compreensao</p>
                </CardContent>
              </Card>
            </div>

            {/* Common errors */}
            {child.common_errors.length > 0 && (
              <Card className="mb-6">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    <h3 className="font-medium text-gray-700">Erros Frequentes</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {child.common_errors.map((err, i) => (
                      <Badge key={i} variant="secondary" className="bg-orange-50 text-orange-700">
                        {err}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            {child.recommendations.length > 0 && (
              <Card className="mb-6">
                <CardContent className="pt-4">
                  <h3 className="font-medium text-gray-700 mb-2">Recomendacoes</h3>
                  <ul className="space-y-1">
                    {child.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-gray-600">• {rec}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Recent sessions */}
            <Card className="mb-6">
              <CardContent className="pt-4">
                <h3 className="font-medium text-gray-700 mb-3">Sessoes Recentes</h3>
                {child.recent_sessions.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhuma sessao ainda</p>
                ) : (
                  <div className="space-y-2">
                    {child.recent_sessions.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                        onClick={() => navigate(`/parents/session/${s.id}`)}
                      >
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{s.topic}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(s.date).toLocaleDateString("pt-BR")} • {s.duration_min} min
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={
                              s.comprehension === "alto" ? "bg-green-100 text-green-700" :
                              s.comprehension === "medio" ? "bg-yellow-100 text-yellow-700" :
                              "bg-orange-100 text-orange-700"
                            }
                          >
                            {s.correct_pct}%
                          </Badge>
                          <span className="text-yellow-400 text-sm">{s.stars} ★</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Weekly chart */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <h3 className="font-medium text-gray-700 mb-3">Sessoes na Semana</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weekly_chart}>
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="raphaela" name="Raphaela" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="francisco" name="Francisco" fill="#34d399" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="antonio" name="Antonio" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
