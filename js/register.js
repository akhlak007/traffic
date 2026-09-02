const form = document.querySelector("#register-form");

function showRegisterMessage(text, tone = "danger") {
  document.querySelector("[data-register-error]")?.remove();
  const message = document.createElement("p");
  message.dataset.registerError = "";
  message.className = "muted";
  message.style.color = tone === "success" ? "var(--color-success)" : "var(--color-danger)";
  message.textContent = text;
  form.querySelector("button[type=submit]")?.before(message);
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  document.querySelector("[data-register-error]")?.remove();
  try {
    const apiBase = ["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.port !== "5000"
      ? "http://localhost:5000/api"
      : `${window.location.origin}/api`;
    const response = await fetch(`${apiBase}/auth/register`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        address: values.address,
        password: values.password,
        confirmPassword: values.confirmPassword
      })
    });
    let body = null;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok) throw new Error(body?.error || "Owner registration failed.");
    showRegisterMessage(body?.message || "Owner account created. Redirecting to sign in.", "success");
    setTimeout(() => { location.href = "index.html"; }, 1200);
  } catch (error) {
    showRegisterMessage(error.message || "Owner registration failed.");
    button.disabled = false;
  }
});

document.querySelectorAll("[data-back-btn]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (window.history.length > 1 && document.referrer && document.referrer !== window.location.href) {
      window.history.back();
    } else {
      window.location.href = "index.html";
    }
  });
});

window.lucide?.createIcons();
