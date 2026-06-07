export interface Child {
  id: number;
  name: string;
  age: number;
  avatar_emoji: string;
  total_stars?: number;
  total_sessions?: number;
}

export interface LessonBlock {
  type: "explanation" | "checkpoint";
  title?: string;
  content?: string;
  question?: string;
  options?: string[];
  correct?: number;
  feedback_correct?: string;
  feedback_wrong?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export interface Lesson {
  title: string;
  blocks: LessonBlock[];
  quiz: QuizQuestion[];
  motivation: string;
}

export interface QuizResult {
  question_index: number;
  selected_option: number;
  is_correct: boolean;
}

export interface SessionSummary {
  summary_text: string;
  comprehension_level: string;
  weak_points: string[];
  recommendations: string[];
}

export interface CompleteResponse {
  session_id: number;
  stars_earned: number;
  total_stars: number;
  needs_review: boolean;
  summary: SessionSummary;
}

export interface ReviewResponse {
  session_id: number;
  review_blocks: LessonBlock[];
  review_quiz: QuizQuestion[];
  motivation: string;
}

export interface RecentSession {
  id: number;
  topic: string;
  date: string;
  duration_min: number;
  comprehension: string;
  correct_pct: number;
  stars: number;
}

export interface ChildDashboard {
  id: number;
  name: string;
  age: number;
  avatar_emoji: string;
  total_sessions: number;
  total_study_time_min: number;
  total_stars: number;
  avg_comprehension: string;
  recent_sessions: RecentSession[];
  common_errors: string[];
  recommendations: string[];
}

export interface DashboardData {
  children: ChildDashboard[];
  weekly_chart: Record<string, string | number>[];
}

export interface ReviewItem {
  id: number;
  prompt: string;
  options: string[];
  correct_option: number;
  hint?: string | null;
  box: number;
}

export interface DueResponse {
  items: ReviewItem[];
  count_due: number;
}

export interface ReviewAnswerResponse {
  is_correct: boolean;
  correct_option: number;
  box: number;
  next_review_at: string;
}

export interface PendingLesson {
  session_id: number;
  child_id: number;
  child_name: string;
  avatar_emoji: string;
  topic: string;
  started_at: string;
  edited: boolean;
  title: string;
  quiz_count: number;
  block_count: number;
}

export interface DraftLesson {
  session_id: number;
  child_id: number;
  child_name: string;
  child_age: number;
  avatar_emoji: string;
  topic: string;
  status: string;
  approval_status: string;
  approved_at: string | null;
  edited: boolean;
  lesson: Lesson | null;
}

export interface ParentSettings {
  auto_approve: boolean;
}

export interface SessionDetail {
  id: number;
  child_name: string;
  child_age: number;
  topic: string;
  input_type: string;
  started_at: string;
  ended_at: string;
  duration_min: number;
  status: string;
  stars_earned: number;
  summary_text: string;
  comprehension: string;
  total_questions: number;
  correct_answers: number;
  weak_points: string[];
  recommendations: string[];
  quiz_responses: {
    question_index: number;
    question_text: string;
    correct_answer: number;
    child_answer: number;
    is_correct: boolean;
    attempt: number;
  }[];
}
