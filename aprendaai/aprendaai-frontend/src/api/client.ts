const API_URL = import.meta.env.VITE_API_URL || "";

function tunnelAuthHeader(): Record<string, string> {
  const ta = localStorage.getItem("_ta");
  if (ta) return { Authorization: "Basic " + ta };
  return {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${path}`;
  const headers = {
    ...tunnelAuthHeader(),
    ...(options?.headers as Record<string, string>),
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("parent_token");
  return token ? { "X-Parent-Token": token } : {};
}

export const api = {
  getChildren: () =>
    request<{ children: import("../types").Child[] }>("/api/children"),

  getChild: (id: number) =>
    request<import("../types").Child>(`/api/children/${id}`),

  createSession: (childId: number, topic: string, files?: File[]) => {
    const form = new FormData();
    form.append("child_id", String(childId));
    form.append("topic", topic);
    if (files) {
      for (const f of files) {
        form.append("files", f);
      }
    }
    return request<{ session_id: number; status: string }>("/api/sessions", {
      method: "POST",
      body: form,
    });
  },

  getLesson: (sessionId: number) =>
    request<{
      session_id: number;
      status: string;
      topic: string;
      lesson: import("../types").Lesson | null;
    }>(`/api/sessions/${sessionId}/lesson`),

  submitQuizResponse: (sessionId: number, questionIndex: number, selectedOption: number) =>
    request<{
      is_correct: boolean;
      correct_answer: number;
      explanation: string;
      feedback: string;
    }>(`/api/sessions/${sessionId}/quiz-response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_index: questionIndex, selected_option: selectedOption }),
    }),

  completeSession: (sessionId: number, quizResults: import("../types").QuizResult[]) =>
    request<import("../types").CompleteResponse>(`/api/sessions/${sessionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quiz_results: quizResults }),
    }),

  generateReview: (sessionId: number, wrongIndices: number[]) =>
    request<import("../types").ReviewResponse>(`/api/sessions/${sessionId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wrong_question_indices: wrongIndices }),
    }),

  parentLogin: (username: string, password: string) =>
    request<{ success: boolean; token: string }>("/api/parents/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),

  getDashboard: () =>
    request<import("../types").DashboardData>("/api/parents/dashboard", {
      headers: { ...authHeaders() },
    }),

  getSessionDetail: (sessionId: number) =>
    request<import("../types").SessionDetail>(`/api/parents/sessions/${sessionId}`, {
      headers: { ...authHeaders() },
    }),

  getDue: (childId: number, limit = 10) =>
    request<import("../types").DueResponse>(`/api/children/${childId}/due?limit=${limit}`),

  answerReviewItem: (itemId: number, selectedOption: number) =>
    request<import("../types").ReviewAnswerResponse>(`/api/review-items/${itemId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selected_option: selectedOption }),
    }),

  getPending: () =>
    request<{ pending: import("../types").PendingLesson[] }>("/api/parents/pending", {
      headers: { ...authHeaders() },
    }),

  getLessonDraft: (sessionId: number) =>
    request<import("../types").DraftLesson>(`/api/parents/sessions/${sessionId}/lesson-draft`, {
      headers: { ...authHeaders() },
    }),

  editLesson: (sessionId: number, lesson: import("../types").Lesson) =>
    request<{ success: boolean; edited: boolean }>(`/api/parents/sessions/${sessionId}/lesson`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ lesson }),
    }),

  approveLesson: (sessionId: number) =>
    request<{ success: boolean; already_approved?: boolean }>(
      `/api/parents/sessions/${sessionId}/approve`,
      { method: "POST", headers: { ...authHeaders() } },
    ),

  getSettings: () =>
    request<import("../types").ParentSettings>("/api/parents/settings", {
      headers: { ...authHeaders() },
    }),

  updateSettings: (autoApprove: boolean) =>
    request<{ success: boolean; auto_approve: boolean }>("/api/parents/settings", {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ auto_approve: autoApprove }),
    }),
};
