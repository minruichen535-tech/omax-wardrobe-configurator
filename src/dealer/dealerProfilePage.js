import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { installDealerSessionGuard } from "./dealerSessionGuard.js?v=dealer-session-guard-20260718-01";
import {
  clearDealerProfile,
  getDealerDisplayName,
  getDealerInitials,
  getDealerProfile,
  hasDealerProfile,
  loadDealerProfile,
  saveDealerProfileToServer
} from "./dealerProfile.js?v=dealer-profile-20260718-01";

const h = React.createElement;
installDealerSessionGuard();
const maxLogoDataUrlLength = 520000;
const maxLogoSize = 512;
const acceptedLogoTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

function DealerProfilePage() {
  const [profile, setProfile] = useState(() => getDealerProfile());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const updateField = (field, value) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setMessage("");
    setError("");
  };

  const handleLogoFile = async (file) => {
    if (!file) return;
    setError("");
    setMessage("");
    try {
      const logoDataUrl = await resizeLogoFile(file);
      setProfile((current) => ({ ...current, logoDataUrl }));
    } catch (uploadError) {
      setError(uploadError.message || "Logo 上传失败");
    }
  };

  const saveProfile = async () => {
    const requiredMissing = [
      ["companyName", "公司名称"],
      ["brandName", "品牌名称"],
      ["contactName", "联系人"],
      ["phone", "联系电话"]
    ].filter(([field]) => !String(profile[field] || "").trim());
    if (requiredMissing.length) {
      setError(`请填写：${requiredMissing.map(([, label]) => label).join("、")}`);
      return;
    }
    try {
      const savedProfile = await saveDealerProfileToServer(profile);
      setProfile(savedProfile);
      setError("");
      setMessage("经销商资料已保存。");
    } catch {
      setError("经销商资料保存失败，请确认账号仍然有效。");
    }
  };

  const resetProfile = () => {
    if (!window.confirm("清空已保存的经销商资料？")) return;
    setProfile(clearDealerProfile());
    setError("");
    setMessage("经销商资料已重置。");
  };

  useEffect(() => {
    document.title = "经销商资料设置";
    loadDealerProfile()
      .then(({ profile: serverProfile }) => setProfile(serverProfile))
      .catch(() => setError("请先登录有效的经销商账号。"));
  }, []);

  return h("main", { className: "product-catalog dealer-profile-page" },
    h("header", { className: "product-catalog-header dealer-profile-header" },
      h(DealerLogoPreview, { profile }),
      h("div", null,
        h("h1", null, "经销商资料"),
        h("p", null, "设置展示给终端客户看的品牌与联系信息")
      ),
      h("a", { className: "dealer-profile-home-link", href: "/dealer/" }, "返回经销商入口")
    ),
    h("section", { className: "dealer-profile-layout" },
      h("form", {
        className: "dealer-profile-form",
        onSubmit: (event) => {
          event.preventDefault();
          saveProfile();
        }
      },
        h(ProfileField, { label: "公司名称", required: true, value: profile.companyName, onChange: (value) => updateField("companyName", value) }),
        h(ProfileField, { label: "品牌名称", required: true, value: profile.brandName, onChange: (value) => updateField("brandName", value) }),
        h("label", { className: "dealer-profile-field" },
          h("span", null, "上传 Logo"),
          h("input", {
            type: "file",
            accept: ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp",
            onChange: (event) => handleLogoFile(event.target.files?.[0])
          }),
          h("small", null, "支持 PNG/JPG/WebP，保存前自动压缩到 512 x 512 以内。")
        ),
        h(ProfileField, { label: "联系人", required: true, value: profile.contactName, onChange: (value) => updateField("contactName", value) }),
        h(ProfileField, { label: "联系电话", required: true, value: profile.phone, onChange: (value) => updateField("phone", value) }),
        h(ProfileField, { label: "微信", value: profile.wechat, onChange: (value) => updateField("wechat", value) }),
        h(ProfileField, { label: "邮箱", type: "email", value: profile.email, onChange: (value) => updateField("email", value) }),
        h(ProfileField, { label: "地址", value: profile.address, onChange: (value) => updateField("address", value) }),
        h(ProfileField, { label: "品牌副标题", value: profile.subtitle, onChange: (value) => updateField("subtitle", value) }),
        error && h("p", { className: "dealer-profile-error" }, error),
        message && h("p", { className: "dealer-profile-message" }, message),
        h("div", { className: "dealer-profile-actions" },
          h("button", { type: "submit" }, "保存资料"),
          h("a", { href: "/dealer/", className: "dealer-profile-button secondary" }, "预览效果"),
          h("button", { type: "button", className: "secondary", onClick: resetProfile }, "重置")
        )
      ),
      h("aside", { className: "dealer-profile-preview" },
        h("span", null, "预览效果"),
        h(DealerLogoPreview, { profile }),
        h("strong", null, getDealerDisplayName(profile) || "经销商品牌"),
        h("p", null, profile.subtitle || "品牌副标题"),
        h("small", null, hasDealerProfile(profile) ? "资料已完整" : "请先完善经销商资料")
      )
    )
  );
}

function ProfileField({ label, value, onChange, type = "text", required = false }) {
  return h("label", { className: "dealer-profile-field" },
    h("span", null, label, required && h("em", null, " *")),
    h("input", {
      type,
      value,
      required,
      onChange: (event) => onChange(event.target.value)
    })
  );
}

function DealerLogoPreview({ profile }) {
  const name = getDealerDisplayName(profile);
  return profile.logoDataUrl
    ? h("img", { className: "dealer-profile-logo", src: profile.logoDataUrl, alt: name || "Dealer logo" })
    : h("div", { className: "dealer-profile-logo fallback" }, getDealerInitials(profile));
}

function resizeLogoFile(file) {
  if (!acceptedLogoTypes.has(file.type)) {
    return Promise.reject(new Error("请上传 PNG、JPG、JPEG 或 WebP 格式的 Logo。"));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Logo 文件读取失败。"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Logo 图片无法识别。"));
      image.onload = () => {
        const scale = Math.min(1, maxLogoSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        const outputType = file.type === "image/jpeg" ? "image/jpeg" : file.type === "image/webp" ? "image/webp" : "image/png";
        const dataUrl = canvas.toDataURL(outputType, outputType === "image/jpeg" ? 0.82 : 0.9);
        if (dataUrl.length > maxLogoDataUrlLength) {
          reject(new Error("Logo 压缩后仍然过大，请上传更小或更简洁的图片。"));
          return;
        }
        resolve(dataUrl);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

createRoot(document.getElementById("root")).render(h(DealerProfilePage));
