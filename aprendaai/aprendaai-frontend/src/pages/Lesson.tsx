import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, CheckCircle, XCircle, Sparkles } from "lucide-react";
import { api } from "@/api/client";
import type { Lesson as LessonType, LessonBlock } from "@/types";

export default function Lesson() {
  const [searchParams] = useSearchParams();
  const sessionId = Number(searchParams.get("session") || 0);
  const [lesson, setLesson] = useState<LessonType | null>(null);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) {
      navigate("/");
      return;
    }
    const fetchLesson = () => {
      api.getLesson(sessionId).then((data) => {
        if (data.status === "processing") {
          setTimeout(fetchLesson, 2000);
        } else if (data.status === "awaiting_approval") {
          setAwaitingApproval(true);
          setLoading(false);
          // Poll while parent reviews
          setTimeout(fetchLesson, 5000);
        } else if (data.status === "ready" && data.lesson) {
          setAwaitingApproval(false);
          setLesson(data.lesson);
          setLoading(false);
        } else {
          setError("Erro ao carregar aula");
          setLoading(false);
        }
      }).catch(() => {
        setError("Erro ao carregar aula");
        setLoading(false);
      });
    };
    fetchLesson();
  }, [sessionId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-green-50 flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-yellow-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-gray-700 mb-2">
            Preparando sua aula...
          </h2>
          <p className="text-gray-500">A IA esta criando algo especial para voce!</p>
        </div>
      </div>
    );
  }

  if (awaitingApproval) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-blue-50 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <span className="text-6xl mb-4 block">👨‍🏫</span>
          <h2 className="text-2xl font-bold text-gray-700 mb-2">
            Tua aula esta sendo preparada
          </h2>
          <p className="text-gray-500 mb-6">
            Seu pai ou sua mae esta dando uma olhadinha rapida antes. Ja, ja te chamamos!
          </p>
          <Button
            variant="outline"
            onClick={() => navigate("/")}
          >
            Voltar ao Inicio
          </Button>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-green-50 flex flex-col items-center justify-center p-6">
        <p className="text-red-500 text-lg mb-4">{error || "Erro desconhecido"}</p>
        <Button onClick={() => navigate("/")}>Voltar ao inicio</Button>
      </div>
    );
  }

  const blocks = lesson.blocks;
  const totalBlocks = blocks.length;
  const block = blocks[currentBlock];
  const progress = ((currentBlock + 1) / totalBlocks) * 100;

  const handleCheckpointAnswer = (optionIndex: number) => {
    if (answered) return;
    setSelectedOption(optionIndex);
    setAnswered(true);
    setIsCorrect(optionIndex === block.correct);
  };

  const handleNext = () => {
    if (currentBlock < totalBlocks - 1) {
      setCurrentBlock(currentBlock + 1);
      setSelectedOption(null);
      setAnswered(false);
      setIsCorrect(false);
    } else {
      // All blocks done, go to quiz
      navigate(`/lesson/quiz?session=${sessionId}`);
    }
  };

  const renderExplanation = (b: LessonBlock) => (
    <Card className="w-full max-w-lg border-l-4 border-l-blue-400">
      <CardContent className="pt-6">
        <h3 className="text-lg font-bold text-blue-600 mb-3">{b.title}</h3>
        <p className="text-gray-700 text-base leading-relaxed whitespace-pre-line">
          {b.content}
        </p>
      </CardContent>
    </Card>
  );

  const renderCheckpoint = (b: LessonBlock) => (
    <Card className="w-full max-w-lg border-l-4 border-l-yellow-400">
      <CardContent className="pt-6">
        <p className="text-lg font-medium text-gray-800 mb-4">{b.question}</p>
        <div className="space-y-3">
          {b.options?.map((opt, idx) => {
            let btnClass = "w-full text-left py-4 px-4 text-base justify-start";
            if (answered) {
              if (idx === b.correct) {
                btnClass += " bg-green-100 border-green-400 text-green-700";
              } else if (idx === selectedOption && !isCorrect) {
                btnClass += " bg-orange-100 border-orange-400 text-orange-700";
              }
            }
            return (
              <Button
                key={idx}
                variant="outline"
                className={btnClass}
                onClick={() => handleCheckpointAnswer(idx)}
                disabled={answered}
              >
                {answered && idx === b.correct && (
                  <CheckCircle className="w-5 h-5 mr-2 text-green-500 shrink-0" />
                )}
                {answered && idx === selectedOption && !isCorrect && idx !== b.correct && (
                  <XCircle className="w-5 h-5 mr-2 text-orange-500 shrink-0" />
                )}
                {opt}
              </Button>
            );
          })}
        </div>
        {answered && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${
            isCorrect ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"
          }`}>
            {isCorrect ? b.feedback_correct : b.feedback_wrong}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-green-50 flex flex-col items-center p-6">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800 mb-2">{lesson.title}</h1>
          <div className="flex items-center gap-3">
            <Progress value={progress} className="flex-1" />
            <span className="text-sm text-gray-500 whitespace-nowrap">
              {currentBlock + 1}/{totalBlocks}
            </span>
          </div>
        </div>

        <div className="mb-6">
          {block.type === "explanation" ? renderExplanation(block) : renderCheckpoint(block)}
        </div>

        {(block.type === "explanation" || answered) && (
          <Button
            className="w-full py-5 text-base bg-blue-500 hover:bg-blue-600"
            onClick={handleNext}
          >
            {currentBlock < totalBlocks - 1 ? (
              <>
                Proximo <ArrowRight className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                Ir para o Quiz <Sparkles className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
