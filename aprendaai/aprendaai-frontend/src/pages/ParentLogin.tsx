import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Lock } from "lucide-react";
import { api } from "@/api/client";

export default function ParentLogin() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (pin.length < 4) {
      setError("Digite o PIN de 4 digitos");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.parentLogin(pin);
      localStorage.setItem("parent_token", res.token);
      navigate("/parents/dashboard");
    } catch {
      setError("PIN incorreto");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Button
          variant="ghost"
          className="mb-6 text-gray-500"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <Lock className="w-10 h-10 text-blue-400 mx-auto mb-3" />
              <h1 className="text-xl font-bold text-gray-800">Area dos Pais</h1>
              <p className="text-sm text-gray-500 mt-1">Digite o PIN para acessar</p>
            </div>

            <Input
              type="password"
              placeholder="PIN de 4 digitos"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                setPin(v);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="text-center text-2xl tracking-widest py-6 mb-4"
              disabled={loading}
            />

            {error && (
              <p className="text-red-500 text-sm text-center mb-4">{error}</p>
            )}

            <Button
              className="w-full py-5 bg-blue-500 hover:bg-blue-600"
              onClick={handleLogin}
              disabled={loading || pin.length < 4}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>

            <p className="text-xs text-gray-400 text-center mt-4">
              PIN padrao: 1234
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
