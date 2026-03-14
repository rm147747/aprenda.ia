import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { api } from "@/api/client";
import type { Child } from "@/types";

export default function Home() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getChildren().then((data) => {
      setChildren(data.children);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-2xl text-blue-400 animate-pulse">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-green-50 flex flex-col items-center justify-center p-6">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-blue-600 mb-2">
          Aprenda.AI
        </h1>
        <p className="text-lg text-gray-500">Quem vai estudar hoje?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full">
        {children.map((child) => (
          <Card
            key={child.id}
            className="cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200 border-2 border-transparent hover:border-blue-300"
            onClick={() => navigate(`/lesson/new?child=${child.id}`)}
          >
            <CardContent className="flex flex-col items-center py-8 px-6">
              <span className="text-6xl mb-4">{child.avatar_emoji}</span>
              <h2 className="text-xl font-bold text-gray-800">{child.name}</h2>
              <p className="text-gray-500 mt-1">{child.age} anos</p>
              {child.total_stars !== undefined && child.total_stars > 0 && (
                <p className="text-yellow-500 mt-2 text-sm">
                  {child.total_stars} estrelas
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        variant="ghost"
        className="mt-10 text-gray-400 hover:text-gray-600"
        onClick={() => navigate("/parents/login")}
      >
        <Lock className="w-4 h-4 mr-2" />
        Area dos Pais
      </Button>
    </div>
  );
}
