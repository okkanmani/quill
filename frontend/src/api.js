const BASE_URL = import.meta.env.VITE_API_URL;

function getToken() {
  return localStorage.getItem("token");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

// --- Auth ---

export async function loginAdmin({ studentName, adminName, password }) {
  const body = { password };
  if (studentName) body.student_name = studentName;
  if (adminName) body.admin_name = adminName;
  const res = await fetch(`${BASE_URL}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Invalid admin login");
  return res.json();
}

export async function signupAdmin({ name, password }) {
  const res = await fetch(`${BASE_URL}/auth/admin/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Sign up failed";
    throw new Error(msg);
  }
  return res.json();
}

export async function loginStudent({ name, password }) {
  const res = await fetch(`${BASE_URL}/auth/student/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  return res.json();
}

export async function logout() {
  if (BASE_URL) {
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: "POST",
        headers: authHeaders(),
      });
    } catch {
      // Still clear the session — JWT is discarded client-side; backend may be down.
    }
  }
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("name");
  localStorage.removeItem("studentName");
  localStorage.removeItem("adminName");
}

export async function getMe() {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

// --- Worksheets ---

export async function getWorksheets() {
  const res = await fetch(`${BASE_URL}/worksheets`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch worksheets");
  return res.json();
}

export async function getWorksheet(id) {
  const res = await fetch(`${BASE_URL}/worksheets/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch worksheet");
  return res.json();
}

export async function deleteWorksheet(id) {
  const res = await fetch(`${BASE_URL}/worksheets/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete worksheet");
  return res.json();
}

export async function uploadWorksheet(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/admin/worksheets/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to upload worksheet";
    if (typeof d === "string") msg = d;
    else if (Array.isArray(d)) msg = d.join(" ");
    throw new Error(msg);
  }
  return res.json();
}

export async function submitResult(result) {
  const res = await fetch(`${BASE_URL}/results`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(result),
  });
  if (!res.ok) throw new Error("Failed to submit result");
  return res.json();
}

export async function getResults() {
  const res = await fetch(`${BASE_URL}/results`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch results");
  return res.json();
}

export async function listAdminStudents() {
  const res = await fetch(`${BASE_URL}/admin/students`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to list students");
  return res.json();
}

export async function createAdminStudent({ name, password }) {
  const res = await fetch(`${BASE_URL}/admin/students`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg =
      typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x.msg).join(" ") : "Failed to create student";
    throw new Error(msg);
  }
  return res.json();
}

export async function deleteAdminStudent(studentId) {
  const res = await fetch(`${BASE_URL}/admin/students/${studentId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to delete student";
    throw new Error(msg);
  }
  return res.json();
}

export async function switchAdminStudent(studentName) {
  const res = await fetch(`${BASE_URL}/admin/session/student`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ student_name: studentName }),
  });
  if (!res.ok) throw new Error("Failed to switch student");
  return res.json();
}

// --- Learning material (Markdown) ---

export async function getLearnSubjects() {
  const res = await fetch(`${BASE_URL}/learn/subjects`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch learning subjects");
  return res.json();
}

export async function getLearnSubject(subjectKey) {
  const res = await fetch(
    `${BASE_URL}/learn/${encodeURIComponent(subjectKey)}`,
    {
      headers: authHeaders(),
    },
  );
  if (!res.ok) throw new Error("Failed to fetch learning material");
  return res.json();
}
