import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import FamilyLogin from "./pages/FamilyLogin";
import Home from "./pages/Home";
import TopicInput from "./pages/TopicInput";
import Lesson from "./pages/Lesson";
import Quiz from "./pages/Quiz";
import Result from "./pages/Result";
import Review from "./pages/Review";
import ParentLogin from "./pages/ParentLogin";
import ParentDashboard from "./pages/ParentDashboard";
import SessionDetail from "./pages/SessionDetail";
import { api } from "./api/client";

function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("family_token");
    if (!token) {
      setAuthed(false);
      return;
    }
    api.verifyToken(token).then((res) => {
      setAuthed(res.valid);
      if (!res.valid) localStorage.removeItem("family_token");
    }).catch(() => {
      setAuthed(false);
      localStorage.removeItem("family_token");
    });
  }, []);

  if (authed === null) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-xl text-blue-400 animate-pulse">Carregando...</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <BrowserRouter>
        <FamilyLogin onLogin={() => setAuthed(true)} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lesson/new" element={<TopicInput />} />
        <Route path="/lesson/active" element={<Lesson />} />
        <Route path="/lesson/quiz" element={<Quiz />} />
        <Route path="/lesson/result" element={<Result />} />
        <Route path="/lesson/review" element={<Review />} />
        <Route path="/parents/login" element={<ParentLogin />} />
        <Route path="/parents/dashboard" element={<ParentDashboard />} />
        <Route path="/parents/session/:id" element={<SessionDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
