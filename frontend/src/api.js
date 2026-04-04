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

export async function loginAdmin({ studentName, password }) {
  const res = await fetch(`${BASE_URL}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_name: studentName, password }),
  });
  if (!res.ok) throw new Error("Invalid admin login");
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
