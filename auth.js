const SESSION_KEY = "spendwise_session";

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function writeSession(user) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      isLoggedIn: true,
      user
    })
  );
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function replaceLoginWithLogout() {
  const loginMenus = document.querySelectorAll(".login-menu");
  loginMenus.forEach((menu) => {
    menu.innerHTML = `<button type="button" class="logout-btn">Logout</button>`;
  });

  document.querySelectorAll(".logout-btn").forEach((button) => {
    button.addEventListener("click", () => {
      clearSession();
      window.location.reload();
    });
  });
}

function applyNavAuthState() {
  const session = readSession();
  if (session && session.isLoggedIn) {
    replaceLoginWithLogout();
  }
}

function setMessage(messageEl, text, type) {
  if (!messageEl) {
    return;
  }
  messageEl.textContent = text;
  messageEl.className = `auth-message ${type}`;
}

function normalizeEmail(value) {
  return String(value).trim().toLowerCase();
}

async function initSignIn() {
  const form = document.getElementById("signinForm");
  if (!form) {
    return;
  }

  const messageEl = document.getElementById("authMessage");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = normalizeEmail(document.getElementById("signinEmail").value);
    const password = document.getElementById("signinPassword").value;

    try {
      const response = await fetch("./user.json", { cache: "no-store" });
      const data = await response.json();
      const users = Array.isArray(data.users) ? data.users : [];

      const matchedUser = users.find(
        (user) => normalizeEmail(user.email) === email && user.password === password
      );

      if (!matchedUser) {
        setMessage(messageEl, "Invalid email or password", "error");
        return;
      }

      writeSession({
        id: matchedUser.id,
        fullName: matchedUser.fullName,
        email: matchedUser.email
      });
      setMessage(messageEl, "Login success, redirecting...", "success");
      applyNavAuthState();
      setTimeout(() => {
        window.location.href = "index.html";
      }, 700);
    } catch (error) {
      setMessage(messageEl, "Cannot read user.json", "error");
    }
  });
}

function initSignUp() {
  const form = document.getElementById("signupForm");
  if (!form) {
    return;
  }

  const messageEl = document.getElementById("authMessage");
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const fullName = form.fullName.value.trim();
    const email = normalizeEmail(form.email.value);
    const password = form.password.value;

    if (!fullName || !email || !password) {
      setMessage(messageEl, "Please fill all required fields.", "error");
      return;
    }

    if (password.length < 6) {
      setMessage(messageEl, "Password must be at least 6 characters.", "error");
      return;
    }

    setMessage(
      messageEl,
      "Sign-up submitted. Demo mode only: add this account to user.json to enable login.",
      "success"
    );
    form.reset();
  });
}

(function initAuth() {
  applyNavAuthState();
  initSignIn();
  initSignUp();
})();
