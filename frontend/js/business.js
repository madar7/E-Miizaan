const $ = (id) => document.getElementById(id);
const DEFAULT_LOGO = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><rect width="72" height="72" rx="10" fill="#d9ddd9"/><path d="M20 50V28l16-10 16 10v22H20z" fill="#9aa69d"/></svg>'
);

function handleError(err) {
  if (err.status === 401 || err.status === 403) return logout();
  showMsg($("pageMsg"), err.message);
}

async function load() {
  try {
    const { business } = await apiRequest("/business");
    $("logoPreview").src = (business && business.logo) || DEFAULT_LOGO;
    if (business) {
      $("bizName").value = business.businessName || "";
      $("bizOwner").value = business.ownerName || "";
      $("bizType").value = business.businessType || "";
      $("bizPhone").value = business.phone || "";
      $("bizEmail").value = business.email || "";
      $("bizAddress").value = business.address || "";
      $("bizWebsite").value = business.website || "";
    }
  } catch (err) {
    handleError(err);
  }
}

$("businessForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg($("pageMsg"));
  try {
    await apiRequest("/business", {
      method: "PATCH",
      body: {
        businessName: $("bizName").value.trim(),
        ownerName: $("bizOwner").value.trim(),
        businessType: $("bizType").value.trim(),
        phone: $("bizPhone").value.trim(),
        email: $("bizEmail").value.trim(),
        address: $("bizAddress").value.trim(),
        website: $("bizWebsite").value.trim(),
      },
    });
    showMsg($("pageMsg"), "Business profile saved.", "success");
  } catch (err) {
    handleError(err);
  }
});

$("logoUploadBtn").addEventListener("click", () => $("logoFile").click());
$("logoFile").addEventListener("change", async () => {
  const file = $("logoFile").files[0];
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
      const { business } = await apiRequest("/business", { method: "PATCH", body: { logo: reader.result } });
      $("logoPreview").src = business.logo;
      showMsg($("pageMsg"), "Logo updated.", "success");
    } catch (err) {
      handleError(err);
    }
  };
  reader.readAsDataURL(file);
});

$("logoRemoveBtn").addEventListener("click", async () => {
  try {
    await apiRequest("/business", { method: "PATCH", body: { logo: null } });
    $("logoPreview").src = DEFAULT_LOGO;
    showMsg($("pageMsg"), "Logo removed.", "success");
  } catch (err) {
    handleError(err);
  }
});

load();
