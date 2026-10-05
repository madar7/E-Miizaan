if (getToken()) {
  window.location.href = "dashboard.html";
}

const $ = (id) => document.getElementById(id);
const loginForm = $("loginForm");
const registerForm = $("registerForm");
const errorBox = $("errorBox");
const switchBtn = $("switchBtn");
const switchText = $("switchText");

$("authAvatar").innerHTML = ICONS.avatar;

let mode = "login";
function setMode(next) {
  mode = next;
  hideMsg(errorBox);
  loginForm.hidden = next !== "login";
  registerForm.hidden = next !== "register";
  switchText.textContent = next === "login" ? "REGISTER HERE" : "ALREADY REGISTERED?";
  switchBtn.textContent = next === "login" ? "SIGNUP" : "SIGN IN";
  if (next === "register") goToStep(1);
}
switchBtn.addEventListener("click", () => setMode(mode === "login" ? "register" : "login"));

$("showLoginPass").addEventListener("change", (e) => {
  $("loginPassword").type = e.target.checked ? "text" : "password";
});
$("showRegPass").addEventListener("change", (e) => {
  $("regPassword").type = e.target.checked ? "text" : "password";
});

// ---------- Login ----------
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = loginForm.querySelector("button[type=submit]");
  hideMsg(errorBox);
  btn.disabled = true;
  try {
    const data = await apiRequest("/auth/login", {
      method: "POST", auth: false,
      body: { username: $("loginUsername").value.trim(), password: $("loginPassword").value },
    });
    setToken(data.token);
    setUser(data.user);
    window.location.href = "dashboard.html";
  } catch (err) {
    showMsg(errorBox, err.message);
    btn.disabled = false;
  }
});

// ---------- Registration wizard (Section 24: onboarding) ----------
let step = 1;
const TOTAL_STEPS = 4;
let selectedAccountType = "individual";

function goToStep(n) {
  step = n;
  document.querySelectorAll(".onboarding-step").forEach((el) => { el.hidden = Number(el.dataset.step) !== n; });
  document.querySelectorAll(".onboarding-dot").forEach((el) => { el.classList.toggle("active", Number(el.dataset.stepDot) === n); });
  $("regBackBtn").hidden = n === 1;
  $("regNextBtn").hidden = n === TOTAL_STEPS;
  $("regSubmitBtn").hidden = n !== TOTAL_STEPS;
  hideMsg(errorBox);
}

function validateStep(n) {
  if (n === 1) {
    if (!$("regName").value.trim()) return "Full name is required";
    if (!/^[a-z0-9_.-]{3,30}$/.test($("regUsername").value.trim().toLowerCase())) return "Username must be 3-30 characters: letters, numbers, . _ -";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($("regEmail").value.trim())) return "Enter a valid email address";
    if ($("regPassword").value.length < 6) return "Password must be at least 6 characters";
  }
  if (n === 3 && selectedAccountType === "small_business" && !$("regBizName").value.trim()) {
    return "Business name is required";
  }
  return null;
}

document.querySelectorAll(".account-type-card").forEach((card) => {
  card.addEventListener("click", () => {
    document.querySelectorAll(".account-type-card").forEach((c) => c.classList.toggle("selected", c === card));
    selectedAccountType = card.dataset.accountType;
    document.querySelectorAll("[data-business-only]").forEach((el) => { el.hidden = selectedAccountType !== "small_business"; });
  });
});

$("regNextBtn").addEventListener("click", () => {
  const error = validateStep(step);
  if (error) return showMsg(errorBox, error);
  if (step < TOTAL_STEPS) goToStep(step + 1);
});
$("regBackBtn").addEventListener("click", () => {
  if (step > 1) goToStep(step - 1);
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const error = validateStep(1) || validateStep(3);
  if (error) return showMsg(errorBox, error);

  const btn = $("regSubmitBtn");
  hideMsg(errorBox);
  btn.disabled = true;

  const theme = document.querySelector('input[name="regTheme"]:checked').value;

  try {
    const data = await apiRequest("/auth/register", {
      method: "POST", auth: false,
      body: {
        name: $("regName").value.trim(),
        username: $("regUsername").value.trim(),
        email: $("regEmail").value.trim(),
        password: $("regPassword").value,
        accountType: selectedAccountType,
        language: $("regLanguage").value,
        currency: $("regCurrency").value,
        theme,
      },
    });

    setLanguage($("regLanguage").value);
    setTheme(theme);

    if (data.pendingApproval) {
      showMsg(errorBox, data.message || "Your account is awaiting administrator approval.", "success");
      btn.disabled = false;
      return;
    }

    setToken(data.token);
    setUser(data.user);

    if (selectedAccountType === "small_business" && $("regBizName").value.trim()) {
      try {
        await apiRequest("/business", {
          method: "PATCH",
          body: { businessName: $("regBizName").value.trim(), ownerName: $("regOwnerName").value.trim() },
        });
      } catch (bizErr) {
        // Registration itself succeeded; the user can still fill in the business
        // profile from the Business page, so this failure shouldn't block sign-in.
      }
    }

    window.location.href = "dashboard.html";
  } catch (err) {
    showMsg(errorBox, err.message);
    btn.disabled = false;
  }
});
