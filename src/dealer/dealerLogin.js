import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const h = React.createElement;

function LoginPage() {
  const isAdminLogin = window.location.pathname.startsWith("/admin/login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      const response = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!active || !response.ok || !payload.authenticated) return;
      if (isAdminLogin && payload.account?.role === "admin") window.location.replace("/admin/dealers/");
      if (!isAdminLogin && payload.account?.role === "dealer") window.location.replace("/dealer/");
    };
    checkSession();
    return () => { active = false; };
  }, [isAdminLogin]);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.message || payload.error || "账号或密码错误。");
        return;
      }
      if (isAdminLogin && payload.account?.role !== "admin") {
        setError("请使用管理员账号登录。");
        return;
      }
      window.location.href = payload.account?.role === "admin"
        ? "/admin/dealers/"
        : "/dealer/";
    } catch {
      setError("登录失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

  return h("main", { className: "product-catalog dealer-login-page" },
    h("section", { className: "dealer-login-card" },
      h("div", { className: "product-catalog-mark" }, "OM"),
      h("h1", null, isAdminLogin ? "管理员登录" : "经销商登录"),
      h("p", null, isAdminLogin ? "登录后管理经销商账号" : "登录后创建方案并提交订单"),
      h("form", { className: "dealer-profile-form", onSubmit: submit },
        h("label", { className: "dealer-profile-field" },
          h("span", null, isAdminLogin ? "登录账号/邮箱" : "账号 / 邮箱"),
          h("input", { value: username, autoComplete: "username", onChange: (event) => setUsername(event.target.value) })
        ),
        h("label", { className: "dealer-profile-field" },
          h("span", null, "密码"),
          h("input", { type: "password", value: password, autoComplete: "current-password", onChange: (event) => setPassword(event.target.value) })
        ),
        error && h("p", { className: "dealer-profile-error" }, error),
        h("div", { className: "dealer-profile-actions" },
          h("button", { type: "submit", disabled: submitting }, submitting ? "登录中..." : "登录")
        )
      )
    )
  );
}

createRoot(document.getElementById("root")).render(h(LoginPage));
