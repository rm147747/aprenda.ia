import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Image, ArrowLeft, Sparkles, X } from "lucide-react";
import { api } from "@/api/client";
import type { Child } from "@/types";

const MAX_FILES = 5;

export default function TopicInput() {
  const [searchParams] = useSearchParams();
  const childId = Number(searchParams.get("child") || 0);
  const [child, setChild] = useState<Child | null>(null);
  const [topic, setTopic] = useState("");
  const [files, setFiles] = useState<File[]>([]);
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
    const selected = e.target.files;
    if (!selected) return;

    const maxSize = 10 * 1024 * 1024;
    const newFiles: File[] = [];

    for (let i = 0; i < selected.length; i++) {
      if (files.length + newFiles.length >= MAX_FILES) {
        setError(`Maximo de ${MAX_FILES} arquivos`);
        break;
      }
      if (selected[i].size > maxSize) {
        setError(`${selected[i].name} e muito grande (maximo 10MB)`);
        continue;
      }
      newFiles.push(selected[i]);
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
      setError("");
    }

    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStart = async () => {
    if (!topic.trim() && files.length === 0) {
      setError("Digite um tema ou envie um arquivo");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api.createSession(
        childId,
        topic,
        files.length > 0 ? files : undefined,
      );
      navigate(`/lesson/active?session=${result.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar sessao");
      setLoading(false);
    }
  };

  const fileIcon = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FileText className="w-5 h-5 text-red-400" />;
    if (["jpg", "jpeg", "png"].includes(ext || ""))
      return <Image className="w-5 h-5 text-green-400" />;
    return <FileText className="w-5 h-5 text-blue-400" />;
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
              Envie arquivos e fotos (opcional)
            </label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto" />
              <p className="mt-2 text-sm text-gray-500">
                Clique para enviar PDF, DOCX, JPG ou PNG
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Ate {MAX_FILES} arquivos (fotos, documentos, etc.)
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              multiple
              onChange={handleFileChange}
              disabled={loading}
            />

            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {fileIcon(file)}
                      <span className="text-sm text-gray-700 truncate">
                        {file.name}
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(idx)}
                      className="text-red-400 hover:text-red-600 ml-2 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400"
                  onClick={() => setFiles([])}
                >
                  Remover todos
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <p className="text-red-500 text-sm text-center mb-4">{error}</p>
        )}

        <Button
          className="w-full py-6 text-lg bg-blue-500 hover:bg-blue-600"
          onClick={handleStart}
          disabled={loading || (!topic.trim() && files.length === 0)}
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
