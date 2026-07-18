import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

const h = React.createElement;
const seriesOptions = [
  ["japanese-closet", "铝日式立柱衣柜"],
  ["aluminum-post-wardrobe", "铝立柱衣柜"],
  ["carbon-steel-post-wardrobe-v2", "碳钢立柱衣柜"],
  ["aluminum-base-supported", "铝托底式衣柜"],
  ["wall-mounted-v2", "铝壁挂式衣柜"]
];
const emptyDealer = {
  username: "",
  password: "",
  status: "active",
  expiresAt: "",
  profile: {
    companyName: "",
    brandName: "",
    contactName: "",
    phone: "",
    wechat: "",
    email: "",
    address: "",
    subtitle: ""
  },
  permissions: {
    allowedSeries: seriesOptions.map(([id]) => id),
    canUseAiPlanner: false,
    canExport: true,
    canSubmitOrder: true
  }
};

function DealerAdminPage() {
  const [dealers, setDealers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedDealer, setSelectedDealer] = useState(emptyDealer);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [resetTarget, setResetTarget] = useState(null);
  const [resetDraft, setResetDraft] = useState({ password: "", confirmPassword: "" });
  const [resetError, setResetError] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const selectedId = selectedDealer.id || "";
  const filteredStatusLabel = status || "all";
  const dealerRows = useMemo(() => dealers, [dealers]);

  const loadDealers = async () => {
    setError("");
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    const response = await fetch(`/api/admin/dealers?${params.toString()}`, { credentials: "include", cache: "no-store" });
    if (!response.ok) {
      setError("无法读取经销商账号，请确认管理员登录状态。");
      return;
    }
    const payload = await response.json();
    setDealers(payload.dealers || []);
  };

  const loadOrders = async () => {
    const response = await fetch("/api/admin/orders", { credentials: "include", cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    setOrders(payload.orders || []);
  };

  useEffect(() => { loadDealers(); loadOrders(); }, []);

  const updateSelected = (path, value) => {
    setSelectedDealer((current) => {
      const next = structuredClone(current);
      const parts = path.split(".");
      let target = next;
      parts.slice(0, -1).forEach((part) => { target = target[part]; });
      target[parts[parts.length - 1]] = value;
      return next;
    });
  };

  const saveDealer = async () => {
    setError("");
    setMessage("");
    setFieldErrors({});
    const localFieldErrors = validateSelectedDealer(selectedDealer, { isCreate: !selectedId });
    if (Object.keys(localFieldErrors).length) {
      setFieldErrors(localFieldErrors);
      setError("请先完善必填字段。");
      return;
    }
    const endpoint = selectedId ? `/api/admin/dealers/${selectedId}` : "/api/admin/dealers";
    const method = selectedId ? "PATCH" : "POST";
    const response = await fetch(endpoint, {
      method,
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(selectedDealer)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setFieldErrors(payload.fieldErrors || {});
      setError(payload.error || "保存经销商失败。");
      return;
    }
    setFieldErrors({});
    setSelectedDealer(normalizeDealerForForm(payload.dealer));
    setMessage("经销商账号已保存。");
    await loadDealers();
  };

  const setDealerStatus = async (nextStatus) => {
    const label = nextStatus === "disabled" ? "停用" : nextStatus === "archived" ? "归档" : "启用";
    if (nextStatus !== "active" && !window.confirm(`确认${label}该经销商账号？`)) return;
    updateSelected("status", nextStatus);
    await saveDealerWithPatch({ ...selectedDealer, status: nextStatus });
  };

  const openResetPasswordDialog = (dealer) => {
    setResetTarget(dealer);
    setResetDraft({ password: "", confirmPassword: "" });
    setResetError("");
  };

  const closeResetPasswordDialog = () => {
    if (resetSubmitting) return;
    setResetTarget(null);
    setResetDraft({ password: "", confirmPassword: "" });
    setResetError("");
  };

  const submitResetPassword = async (event) => {
    event.preventDefault();
    if (!resetTarget?.id) return;
    const password = resetDraft.password || "";
    if (password.length < 8) {
      setResetError("新密码至少 8 位。");
      return;
    }
    if (password !== resetDraft.confirmPassword) {
      setResetError("两次输入的密码不一致。");
      return;
    }
    setResetSubmitting(true);
    setResetError("");
    const response = await fetch(`/api/admin/dealers/${resetTarget.id}/reset-password`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password })
    });
    const payload = await response.json().catch(() => ({}));
    setResetSubmitting(false);
    if (!response.ok) {
      setResetError(payload.error === "invalid_password" ? "新密码至少 8 位。" : (payload.error || "重置密码失败。"));
      return;
    }
    setMessage("密码已重置。");
    setResetTarget(null);
    setResetDraft({ password: "", confirmPassword: "" });
  };

  const saveDealerWithPatch = async (dealer) => {
    const response = await fetch(`/api/admin/dealers/${dealer.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(dealer)
    });
    if (!response.ok) {
      setError("更新状态失败。");
      return;
    }
    setMessage("账号状态已更新。");
    await loadDealers();
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => null);
    window.location.href = "/admin/login/";
  };

  return h("main", { className: "product-catalog dealer-admin-page" },
    h("header", { className: "product-catalog-header dealer-profile-header" },
      h("div", { className: "product-catalog-mark" }, "OM"),
      h("div", null,
        h("h1", null, "经销商账号管理"),
        h("p", null, "创建、启用、停用和归档经销商账号")
      ),
      h("div", { className: "dealer-admin-header-actions" },
        h("a", { className: "dealer-profile-home-link secondary", href: "/admin/" }, "返回管理端"),
        h("button", { type: "button", className: "dealer-profile-button", onClick: logout }, "退出登录")
      )
    ),
    h("section", { className: "dealer-admin-layout" },
      h("aside", { className: "dealer-admin-list" },
        h("div", { className: "dealer-admin-filters" },
          h("input", { value: query, placeholder: "搜索账号/公司/品牌", onChange: (event) => setQuery(event.target.value) }),
          h("select", { value: status, onChange: (event) => setStatus(event.target.value) },
            h("option", { value: "" }, "全部状态"),
            h("option", { value: "active" }, "active"),
            h("option", { value: "disabled" }, "disabled"),
            h("option", { value: "archived" }, "archived")
          ),
          h("button", { type: "button", onClick: loadDealers }, "筛选")
        ),
        h("button", {
          type: "button",
          className: "dealer-admin-new",
          onClick: () => {
            setSelectedDealer(structuredClone(emptyDealer));
            setFieldErrors({});
            setError("");
            setMessage("");
          }
        }, "新建经销商"),
        h("p", { className: "quote-note" }, `当前筛选：${filteredStatusLabel} / ${dealerRows.length} 个`),
        dealerRows.map((dealer) => h("div", {
          className: `dealer-admin-row${dealer.id === selectedId ? " active" : ""}`,
          key: dealer.id
        },
          h("button", {
            type: "button",
            className: "dealer-admin-row-main",
            onClick: () => {
              setSelectedDealer(normalizeDealerForForm(dealer));
              setFieldErrors({});
              setError("");
              setMessage("");
            }
          },
            h("strong", null, dealer.profile?.brandName || dealer.profile?.companyName || dealer.username),
            h("span", null, dealer.username),
            h("em", null, dealer.status)
          ),
          h("button", {
            type: "button",
            className: "dealer-admin-row-reset",
            onClick: () => openResetPasswordDialog(dealer)
          }, "重置密码")
        ))
      ),
      h("section", { className: "dealer-profile-form dealer-admin-form" },
        h(ProfileInput, { label: "登录账号/邮箱", required: true, error: fieldErrors.username, value: selectedDealer.username, onChange: (value) => updateSelected("username", value) }),
        !selectedId && h(ProfileInput, { label: "初始密码", required: true, error: fieldErrors.password, value: selectedDealer.password, type: "password", onChange: (value) => updateSelected("password", value) }),
        h(ProfileInput, { label: "公司名称", required: true, error: fieldErrors.companyName, value: selectedDealer.profile.companyName, onChange: (value) => updateSelected("profile.companyName", value) }),
        h(ProfileInput, { label: "品牌名称", value: selectedDealer.profile.brandName, onChange: (value) => updateSelected("profile.brandName", value) }),
        h(ProfileInput, { label: "Logo URL / Reference", value: selectedDealer.profile.logoUrl || selectedDealer.profile.logoReference || "", onChange: (value) => updateSelected("profile.logoUrl", value) }),
        h(ProfileInput, { label: "联系人", value: selectedDealer.profile.contactName, onChange: (value) => updateSelected("profile.contactName", value) }),
        h(ProfileInput, { label: "联系电话", value: selectedDealer.profile.phone, onChange: (value) => updateSelected("profile.phone", value) }),
        h(ProfileInput, { label: "微信", required: true, error: fieldErrors.wechat, value: selectedDealer.profile.wechat, onChange: (value) => updateSelected("profile.wechat", value) }),
        h(ProfileInput, { label: "邮箱", value: selectedDealer.profile.email, onChange: (value) => updateSelected("profile.email", value) }),
        h(ProfileInput, { label: "地址", value: selectedDealer.profile.address, onChange: (value) => updateSelected("profile.address", value) }),
        h(ProfileInput, { label: "品牌副标题", value: selectedDealer.profile.subtitle, onChange: (value) => updateSelected("profile.subtitle", value) }),
        h(ProfileInput, { label: "授权到期", value: selectedDealer.expiresAt || "", type: "date", onChange: (value) => updateSelected("expiresAt", value) }),
        h("label", { className: "dealer-profile-field" },
          h("span", null, "状态"),
          h("select", { value: selectedDealer.status, onChange: (event) => updateSelected("status", event.target.value) },
            h("option", { value: "active" }, "active"),
            h("option", { value: "disabled" }, "disabled"),
            h("option", { value: "archived" }, "archived")
          )
        ),
        h("fieldset", { className: "dealer-admin-fieldset" },
          h("legend", null, "允许产品系列"),
          seriesOptions.map(([id, label]) => h("label", { key: id },
            h("input", {
              type: "checkbox",
              checked: selectedDealer.permissions.allowedSeries.includes(id),
              onChange: (event) => {
                const current = new Set(selectedDealer.permissions.allowedSeries);
                if (event.target.checked) current.add(id); else current.delete(id);
                updateSelected("permissions.allowedSeries", Array.from(current));
              }
            }),
            label
          ))
        ),
        h("fieldset", { className: "dealer-admin-fieldset" },
          h("legend", null, "功能权限"),
          [["canUseAiPlanner", "可使用 AI Planner"], ["canExport", "可导出"], ["canSubmitOrder", "可提交订单"]].map(([key, label]) => h("label", { key },
            h("input", {
              type: "checkbox",
              checked: Boolean(selectedDealer.permissions[key]),
              onChange: (event) => updateSelected(`permissions.${key}`, event.target.checked)
            }),
            label
          ))
        ),
        error && h("p", { className: "dealer-profile-error" }, error),
        message && h("p", { className: "dealer-profile-message" }, message),
        h("div", { className: "dealer-profile-actions" },
          h("button", { type: "button", onClick: saveDealer }, selectedId ? "保存修改" : "创建经销商"),
          selectedId && h("button", { type: "button", className: "secondary", onClick: () => setDealerStatus("active") }, "启用"),
          selectedId && h("button", { type: "button", className: "secondary", onClick: () => setDealerStatus("disabled") }, "停用"),
          selectedId && h("button", { type: "button", className: "secondary", onClick: () => setDealerStatus("archived") }, "归档"),
          selectedId && h("button", { type: "button", className: "secondary", onClick: () => openResetPasswordDialog(selectedDealer) }, "重置密码")
        )
      ),
      h("section", { className: "dealer-admin-orders" },
        h("h2", null, "最近经销商订单"),
        orders.length === 0
          ? h("p", { className: "quote-note" }, "暂无订单。")
          : h("div", { className: "table-wrap" },
            h("table", null,
              h("thead", null, h("tr", null,
                h("th", null, "订单号"),
                h("th", null, "经销商"),
                h("th", null, "方案"),
                h("th", null, "系列"),
                h("th", null, "状态"),
                h("th", null, "内部BOM"),
                h("th", null, "提交时间"),
                h("th", null, "操作")
              )),
              h("tbody", null, orders.map((order) => h("tr", { key: order.id },
                h("td", null, order.id),
                h("td", null, order.dealerName),
                h("td", null, order.planName || order.customerReference || ""),
                h("td", null, order.seriesId),
                h("td", null, order.status),
                h("td", null, `${Array.isArray(order.payload?.bom) ? order.payload.bom.length : 0} 项`),
                h("td", null, order.createdAt),
                h("td", null, h("a", {
                  className: "dealer-order-detail-link",
                  href: `/admin/dealer-order/?id=${encodeURIComponent(order.id)}`
                }, "查看详情"))
              )))
            )
          )
      )
    ),
    resetTarget && h("div", { className: "dealer-modal-backdrop", role: "presentation" },
      h("section", { className: "dealer-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "dealer-reset-title" },
        h("h2", { id: "dealer-reset-title" }, "重置密码"),
        h("p", null, resetTarget.username),
        h("form", { className: "dealer-profile-form dealer-reset-form", onSubmit: submitResetPassword },
          h(ProfileInput, {
            label: "新密码",
            type: "password",
            value: resetDraft.password,
            error: resetError && resetDraft.password.length < 8 ? resetError : "",
            onChange: (value) => setResetDraft((current) => ({ ...current, password: value }))
          }),
          h(ProfileInput, {
            label: "确认密码",
            type: "password",
            value: resetDraft.confirmPassword,
            error: resetError && resetDraft.password.length >= 8 && resetDraft.password !== resetDraft.confirmPassword ? resetError : "",
            onChange: (value) => setResetDraft((current) => ({ ...current, confirmPassword: value }))
          }),
          resetError && h("p", { className: "dealer-profile-error" }, resetError),
          h("div", { className: "dealer-profile-actions" },
            h("button", { type: "submit", disabled: resetSubmitting }, resetSubmitting ? "提交中..." : "确认重置"),
            h("button", { type: "button", className: "secondary", onClick: closeResetPasswordDialog, disabled: resetSubmitting }, "取消")
          )
        )
      )
    )
  );
}

function ProfileInput({ label, value, onChange, type = "text", required = false, error = "" }) {
  return h("label", { className: "dealer-profile-field" },
    h("span", null, label, required && h("em", null, " *")),
    h("input", {
      type,
      value: value || "",
      "aria-invalid": error ? "true" : "false",
      onChange: (event) => onChange(event.target.value)
    }),
    error && h("small", { className: "dealer-field-error" }, error)
  );
}

function normalizeDealerForForm(dealer) {
  return {
    ...structuredClone(emptyDealer),
    ...structuredClone(dealer || {}),
    password: "",
    profile: {
      ...emptyDealer.profile,
      ...(dealer?.profile || {})
    },
    permissions: {
      ...emptyDealer.permissions,
      ...(dealer?.permissions || {})
    }
  };
}

function validateSelectedDealer(dealer, { isCreate = false } = {}) {
  const fieldErrors = {};
  if (!String(dealer.username || "").trim()) fieldErrors.username = "请填写登录账号/邮箱。";
  if (isCreate && String(dealer.password || "").length < 8) fieldErrors.password = "初始密码至少 8 位。";
  if (!String(dealer.profile?.companyName || "").trim()) fieldErrors.companyName = "请填写公司名称。";
  if (!String(dealer.profile?.wechat || "").trim()) fieldErrors.wechat = "请填写微信。";
  return fieldErrors;
}

createRoot(document.getElementById("root")).render(h(DealerAdminPage));
