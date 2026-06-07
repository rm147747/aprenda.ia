import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Save, Sparkles } from "lucide-react";
import { api } from "@/api/client";
import type { DraftLesson, Lesson, LessonBlock, QuizQuestion } from "@/types";

export default function ParentReviewLesson() {
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);
  const [draft, setDraft] = useState<DraftLesson | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("parent_token");
    if (!token) { navigate("/parents/login"); return; }
    if (!sessionId) { navigate("/parents/dashboard"); return; }
    api.getLessonDraft(sessionId).then((d) => {
      setDraft(d);
      setLesson(d.lesson);
      setLoading(false);
    }).catch(() => {
      setError("Nao foi possivel carregar a aula");
      setLoading(false);
    });
  }, [sessionId, navigate]);

  const updateLesson = (next: Lesson) => {
    setLesson(next);
    setDirty(true);
  };

  const updateBlock = (i: number, patch: Partial<LessonBlock>) => {
    if (!lesson) return;
    const blocks = lesson.blocks.map((b, idx) => idx === i ? { ...b, ...patch } : b);
    updateLesson({ ...lesson, blocks });
  };

  const updateQuiz = (i: number, patch: Partial<QuizQuestion>) => {
    if (!lesson) return;
    const quiz = lesson.quiz.map((q, idx) => idx === i ? { ...q, ...patch } : q);
    updateLesson({ ...lesson, quiz });
  };

  const updateQuizOption = (qIdx: number, oIdx: number, value: string) => {
    if (!lesson) return;
    const q = lesson.quiz[qIdx];
    const options = q.options.map((opt, idx) => idx === oIdx ? value : opt);
    updateQuiz(qIdx, { options });
  };

  const handleSave = async () => {
    if (!lesson) return;
    setSaving(true);
    setError("");
    try {
      await api.editLesson(sessionId, lesson);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    }
    setSaving(false);
  };

  const handleApprove = async () => {
    if (!lesson) return;
    if (dirty) {
      const confirmed = window.confirm("Voce tem edicoes nao salvas. Salvar antes de aprovar?");
      if (confirmed) {
        await handleSave();
      }
    }
    setApproving(true);
    setError("");
    try {
      await api.approveLesson(sessionId);
      navigate("/parents/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao aprovar");
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Carregando aula...</p>
      </div>
    );
  }

  if (error && !draft) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={() => navigate("/parents/dashboard")}>Voltar</Button>
      </div>
    );
  }

  if (!draft || !lesson) return null;

  const alreadyApproved = draft.approval_status === "approved";

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" className="mb-4 text-gray-500" onClick={() => navigate("/parents/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Painel
        </Button>

        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Revisar aula</h1>
            <p className="text-sm text-gray-500">
              {draft.avatar_emoji} {draft.child_name} ({draft.child_age} anos) • {draft.topic}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {draft.edited && <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">editada</Badge>}
            <Badge
              variant="secondary"
              className={alreadyApproved ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}
            >
              {alreadyApproved ? "aprovada" : "rascunho"}
            </Badge>
          </div>
        </div>

        <Card className="mb-4">
          <CardContent className="pt-4 space-y-2">
            <label className="text-xs font-medium text-gray-500">Titulo</label>
            <Input
              value={lesson.title}
              onChange={(e) => updateLesson({ ...lesson, title: e.target.value })}
              className="text-lg font-medium"
            />
          </CardContent>
        </Card>

        <h3 className="font-semibold text-gray-700 mt-6 mb-2">Blocos</h3>
        {lesson.blocks.map((b, i) => (
          <Card key={i} className="mb-3 border-l-4 border-l-blue-300">
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Badge variant="secondary">{b.type}</Badge>
                <span>#{i + 1}</span>
              </div>
              {b.type === "explanation" && (
                <>
                  <Input
                    value={b.title || ""}
                    onChange={(e) => updateBlock(i, { title: e.target.value })}
                    placeholder="Titulo do bloco"
                  />
                  <textarea
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm min-h-[100px]"
                    value={b.content || ""}
                    onChange={(e) => updateBlock(i, { content: e.target.value })}
                    placeholder="Conteudo da explicacao"
                  />
                </>
              )}
              {b.type === "checkpoint" && (
                <>
                  <Input
                    value={b.question || ""}
                    onChange={(e) => updateBlock(i, { question: e.target.value })}
                    placeholder="Pergunta"
                  />
                  {(b.options || []).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const opts = (b.options || []).map((o, oo) => oo === oi ? e.target.value : o);
                          updateBlock(i, { options: opts });
                        }}
                      />
                      <Button
                        size="sm"
                        variant={b.correct === oi ? "default" : "outline"}
                        onClick={() => updateBlock(i, { correct: oi })}
                      >
                        {b.correct === oi ? <Check className="w-3 h-3" /> : "marcar"}
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        ))}

        <h3 className="font-semibold text-gray-700 mt-6 mb-2">Quiz</h3>
        {lesson.quiz.map((q, i) => (
          <Card key={i} className="mb-3 border-l-4 border-l-purple-300">
            <CardContent className="pt-4 space-y-2">
              <span className="text-xs text-gray-500">Questao #{i + 1}</span>
              <Input
                value={q.question}
                onChange={(e) => updateQuiz(i, { question: e.target.value })}
              />
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => updateQuizOption(i, oi, e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant={q.correct === oi ? "default" : "outline"}
                    onClick={() => updateQuiz(i, { correct: oi })}
                  >
                    {q.correct === oi ? <Check className="w-3 h-3" /> : "marcar"}
                  </Button>
                </div>
              ))}
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={q.explanation || ""}
                onChange={(e) => updateQuiz(i, { explanation: e.target.value })}
                placeholder="Explicacao (mostrada apos a resposta)"
              />
            </CardContent>
          </Card>
        ))}

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="sticky bottom-0 bg-gray-50 py-3 flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={!dirty || saving || approving}
          >
            <Save className="w-4 h-4 mr-1" /> {saving ? "Salvando..." : "Salvar edicoes"}
          </Button>
          {!alreadyApproved && (
            <Button
              className="bg-green-500 hover:bg-green-600"
              onClick={handleApprove}
              disabled={approving}
            >
              <Sparkles className="w-4 h-4 mr-1" /> {approving ? "Aprovando..." : "Aprovar e liberar"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
