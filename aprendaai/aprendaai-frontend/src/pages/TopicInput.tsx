import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Image, ArrowLeft, Sparkles } from "lucide-react";
import { api } from "@/api/client";
import type { Child } from "@/types";

export default function TopicInput() {
  const [searchParams] = useSearchParams();
  const childId = Number(searchParams.get("child") || 0);
  const [child, setChild] = useState<Child | null>(null);
  const [topic, setTopic] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (childId) {
      api.getChild(childId).then(setChild).catch(() => navigate("/"));
    } else {
      navigate("/");
    }
  }, [childId, navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      const maxSize = 10 * 1024 * 1024;
      if (f.size > maxSize) {
        setError("Arquivo muito grande (maximo 10MB)");
        return;
      }
      setFile(f);
      setError("");
    }
  };

  const handleStart = async () => {
    if (!topic.trim() && !file) {
      setError("Digite um tema ou envie um arquivo");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api.createSession(childId, topic, file || undefined);
      navigate(`/lesson/active?session=${result.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar sessao");
      setLoading(false);
    }
  };

  const fileIcon = () => {
    if (!file) return <Upload className="w-8 h-8 text-gray-400" />;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FileText className="w-8 h-8 text-red-400" />;
    if (["jpg", "jpeg", "png"].includes(ext || ""))
      return <Image className="w-8 h-8 text-green-400" />;
    return <FileText className="w-8 h-8 text-blue-400" />;
  };

  if (!child) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-green-50 flex flex-col items-center p-6">
      <div className="w-full max-w-lg">
        <Button
          variant="ghost"
          className="mb-4 text-gray-500"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="text-center mb-8">
          <span className="text-5xl">{child.avatar_emoji}</span>
          <h1 className="text-2xl font-bold text-gray-800 mt-2">
            Ola, {child.name}!
          </h1>
          <p className="text-gray-500">O que vamos aprender hoje?</p>
        </div>

        <Card className="mb-4">
          <CardContent className="pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Digite o tema de estudo
            </label>
            <Input
              placeholder="Ex: Fracoes, Sistema Solar, Verbos..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="text-lg py-6"
              disabled={loading}
            />
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ou envie um arquivo (opcional)
            </label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {fileIcon()}
              {file ? (
                <p className="mt-2 text-sm text-gray-700 font-medium">
                  {file.name}
                </p>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  Clique para enviar PDF, DOCX, JPG ou PNG
                </p>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              disabled={loading}
            />
            {file && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-red-400"
                onClick={() => setFile(null)}
              >
                Remover arquivo
              </Button>
            )}
          </CardContent>
        </Card>

        {error && (
          <p className="text-red-500 text-sm text-center mb-4">{error}</p>
        )}

        <Button
          className="w-full py-6 text-lg bg-blue-500 hover:bg-blue-600"
          onClick={handleStart}
          disabled={loading || (!topic.trim() && !file)}
        >
          {loading ? (
            <span className="animate-pulse">Preparando sua aula...</span>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Comecar Aula
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
