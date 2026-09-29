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
}
switchBtn.addEventListener("click", () => setMode(mode === "login" ? "register" : "login"));

$("showLoginPass").addEventListener("change", (e) => {
  $("loginPassword").type = e.target.checked ? "text" : "password";
});
$("showRegPass").addEventListener("change", (e) => {
  $("regPassword").type = e.target.checked ? "text" : "password";
});

async function submitAuth(form, path, body) {
  const btn = form.querySelector("button[type=submit]");
  hideMsg(errorBox);
  btn.disabled = true;
  try {
    const data = await apiRequest(path, { method: "POST", auth: false, body });
    setToken(data.token);
    setUser(data.user);
    window.location.href = "dashboard.html";
  } catch (err) {
    showMsg(errorBox, err.message);
    btn.disabled = false;
  }
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  submitAuth(loginForm, "/auth/login", {
    username: $("loginUsername").value.trim(),
    password: $("loginPassword").value,
  });
});

registerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  submitAuth(registerForm, "/auth/register", {
    name: $("regName").value.trim(),
    username: $("regUsername").value.trim(),
    email: $("regEmail").value.trim(),
    password: $("regPassword").value,
  });
});
