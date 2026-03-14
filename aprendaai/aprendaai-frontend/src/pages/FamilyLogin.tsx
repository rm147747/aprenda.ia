import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen } from "lucide-react";
import { api } from "@/api/client";

interface Props {
  onLogin: () => void;
}

export default function FamilyLogin({ onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Preencha usuario e senha");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.familyLogin(username, password);
      localStorage.setItem("family_token", res.token);
      onLogin();
    } catch {
      setError("Usuario ou senha incorretos");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-green-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <BookOpen className="w-12 h-12 text-blue-500 mx-auto mb-3" />
          <h1 className="text-3xl font-bold text-blue-600">Aprenda.AI</h1>
          <p className="text-gray-500 mt-1">Plataforma de estudos da familia</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                placeholder="Digite o usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="mt-1"
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite a senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="mt-1"
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <Button
              className="w-full py-5 bg-blue-500 hover:bg-blue-600"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
