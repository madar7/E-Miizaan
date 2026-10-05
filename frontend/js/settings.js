const $ = (id) => document.getElementById(id);
const DEFAULT_AVATAR = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><rect width="72" height="72" rx="36" fill="#d9ddd9"/><circle cx="36" cy="28" r="13" fill="#9aa69d"/><path d="M12 62c2-16 12-24 24-24s22 8 24 24" fill="#9aa69d"/></svg>'
);

let currentUser = null;

function handleError(err) {
  if (err.status === 401 || err.status === 403) return logout();
  showMsg($("pageMsg"), err.message);
}

// ---------- Tabs ----------
document.querySelectorAll(".settings-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".settings-tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".settings-panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + tab.dataset.tab));
  });
});

// ---------- Load profile into every tab ----------
async function loadProfile() {
  try {
    const { user } = await apiRequest("/profile");
    currentUser = user;

    $("avatarPreview").src = user.profileImage || DEFAULT_AVATAR;
    $("accName").value = user.name || "";
    $("accEmail").value = user.email || "";
    $("accPhone").value = user.phone || "";
    $("accCountry").value = user.country || "";
    $("accType").value = user.accountType || "individual";

    document.querySelectorAll('input[name="themeChoice"]').forEach((r) => { r.checked = r.value === (user.theme || "system"); });
    document.querySelectorAll('input[name="langChoice"]').forEach((r) => { r.checked = r.value === (user.language || "en"); });
    $("currencySelect").value = user.currency || "USD";

    const n = user.notifications || {};
    $("notifTransactions").checked = n.transactions !== false;
    $("notifAccount").checked = n.account !== false;
    $("notifSystem").checked = n.system !== false;
    $("notifUserManagement").checked = n.userManagement !== false;
  } catch (err) {
    handleError(err);
  }
}

// ---------- Account form ----------
$("accountForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg($("pageMsg"));
  try {
    const { user } = await apiRequest("/profile", {
      method: "PATCH",
      body: { name: $("accName").value.trim(), phone: $("accPhone").value.trim(), country: $("accCountry").value.trim(), accountType: $("accType").value },
    });
    setUser({ ...getUser(), ...user });
    showMsg($("pageMsg"), "Profile updated successfully.", "success");
  } catch (err) {
    handleError(err);
  }
});

// ---------- Avatar upload/remove ----------
$("avatarUploadBtn").addEventListener("click", () => $("avatarFile").click());
$("avatarFile").addEventListener("change", async () => {
  const file = $("avatarFile").files[0];
  if (!file) return;
  if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
    return showMsg($("pageMsg"), "Only JPG, PNG, and WEBP images are allowed");
  }
  if (file.size > 2 * 1024 * 1024) {
    return showMsg($("pageMsg"), "Image must be smaller than 2MB");
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const { user } = await apiRequest("/profile/image", { method: "POST", body: { image: reader.result } });
      $("avatarPreview").src = user.profileImage;
      setUser({ ...getUser(), profileImage: user.profileImage });
      showMsg($("pageMsg"), "Profile image updated successfully.", "success");
    } catch (err) {
      handleError(err);
    }
  };
  reader.readAsDataURL(file);
});

$("avatarRemoveBtn").addEventListener("click", async () => {
  try {
    await apiRequest("/profile/image", { method: "DELETE" });
    $("avatarPreview").src = DEFAULT_AVATAR;
    setUser({ ...getUser(), profileImage: null });
    showMsg($("pageMsg"), "Profile image removed.", "success");
  } catch (err) {
    handleError(err);
  }
});

// ---------- Appearance ----------
document.querySelectorAll('input[name="themeChoice"]').forEach((radio) => {
  radio.addEventListener("change", async () => {
    setTheme(radio.value);
    try {
      await apiRequest("/profile", { method: "PATCH", body: { theme: radio.value } });
      setUser({ ...getUser(), theme: radio.value });
    } catch (err) { /* local theme already applied; backend sync can retry later */ }
  });
});

// ---------- Language ----------
document.querySelectorAll('input[name="langChoice"]').forEach((radio) => {
  radio.addEventListener("change", async () => {
    setLanguage(radio.value);
    try {
      await apiRequest("/profile", { method: "PATCH", body: { language: radio.value } });
      setUser({ ...getUser(), language: radio.value });
    } catch (err) { /* local language already applied */ }
  });
});

// ---------- Currency ----------
$("saveCurrencyBtn").addEventListener("click", async () => {
  try {
    const { user } = await apiRequest("/profile", { method: "PATCH", body: { currency: $("currencySelect").value } });
    setUser({ ...getUser(), currency: user.currency });
    showMsg($("pageMsg"), "Currency updated successfully.", "success");
  } catch (err) {
    handleError(err);
  }
});

// ---------- Notifications ----------
$("saveNotifBtn").addEventListener("click", async () => {
  try {
    await apiRequest("/profile", {
      method: "PATCH",
      body: {
        notifications: {
          transactions: $("notifTransactions").checked,
          account: $("notifAccount").checked,
          system: $("notifSystem").checked,
          userManagement: $("notifUserManagement").checked,
        },
      },
    });
    showMsg($("pageMsg"), "Notification preferences saved.", "success");
  } catch (err) {
    handleError(err);
  }
});

// ---------- Password ----------
$("passwordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg($("pageMsg"));
  try {
    await apiRequest("/profile/password", {
      method: "PATCH",
      body: { currentPassword: $("curPassword").value, newPassword: $("newPassword").value },
    });
    $("passwordForm").reset();
    showMsg($("pageMsg"), "Password changed successfully.", "success");
  } catch (err) {
    handleError(err);
  }
});

// ---------- Deactivate own account ----------
$("deactivateBtn").addEventListener("click", async () => {
  if (!confirm("Are you sure you want to deactivate your account? You will be signed out immediately.")) return;
  try {
    await apiRequest("/profile/deactivate", { method: "PATCH" });
    clearSession();
    window.location.href = "index.html";
  } catch (err) {
    handleError(err);
  }
});

loadProfile();
