import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import TopicInput from "./pages/TopicInput";
import Lesson from "./pages/Lesson";
import Quiz from "./pages/Quiz";
import Result from "./pages/Result";
import Review from "./pages/Review";
import ReviewDue from "./pages/ReviewDue";
import ParentLogin from "./pages/ParentLogin";
import ParentDashboard from "./pages/ParentDashboard";
import ParentReviewLesson from "./pages/ParentReviewLesson";
import SessionDetail from "./pages/SessionDetail";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lesson/new" element={<TopicInput />} />
        <Route path="/lesson/active" element={<Lesson />} />
        <Route path="/lesson/quiz" element={<Quiz />} />
        <Route path="/lesson/result" element={<Result />} />
        <Route path="/lesson/review" element={<Review />} />
        <Route path="/lesson/review-due" element={<ReviewDue />} />
        <Route path="/parents/login" element={<ParentLogin />} />
        <Route path="/parents/dashboard" element={<ParentDashboard />} />
        <Route path="/parents/review/:id" element={<ParentReviewLesson />} />
        <Route path="/parents/session/:id" element={<SessionDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
