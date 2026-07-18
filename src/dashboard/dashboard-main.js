import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { dashboardProducts } from "./config/dashboardProducts.js?v=cache-20260621-02";
import { installDealerSessionGuard } from "../dealer/dealerSessionGuard.js?v=dealer-session-guard-20260718-01";
import {
  getDealerDisplayName,
  getDealerInitials,
  getDealerProfile,
  hasDealerProfile,
  loadDealerProfile,
  subscribeDealerProfileChange
} from "../dealer/dealerProfile.js?v=dealer-profile-20260718-01";

const h = React.createElement;
installDealerSessionGuard();

const dealerRouteByProductId = {
  "japanese-closet": "/dealer/japanese-closet/",
  "aluminum-post-wardrobe": "/dealer/aluminum-post-wardrobe/",
  "carbon-steel-post-wardrobe-v2": "/dealer/carbon-steel-post-wardrobe/",
  "aluminum-base-supported": "/dealer/aluminum-base-supported/",
  "wall-mounted-v2": "/dealer/wall-mounted/"
};

function getDashboardConfig(pathname = window.location.pathname) {
  const isDealerDashboard = pathname.startsWith("/dealer");
  if (isDealerDashboard) {
    return {
      title: "经销商方案入口",
      subtitle: "请选择产品系列，为终端客户创建方案并提交订单",
      products: dashboardProducts.map((product) => ({
        ...product,
        href: dealerRouteByProductId[product.id] || `/dealer/${product.id}/`
      }))
    };
  }
  return {
    title: "OMAX Wardrobe Configurator",
    subtitle: "请选择产品系列",
    products: dashboardProducts
  };
}

function Dashboard() {
  const dashboardConfig = getDashboardConfig();
  const isDealerDashboard = window.location.pathname.startsWith("/dealer");
  const [dealerProfile, setDealerProfile] = useState(() => getDealerProfile());
  const [dealerPermissions, setDealerPermissions] = useState(null);

  useEffect(() => {
    if (!isDealerDashboard) return undefined;
    loadDealerProfile()
      .then(({ profile, permissions }) => {
        setDealerProfile(profile);
        setDealerPermissions(permissions);
      })
      .catch(() => {});
    return subscribeDealerProfileChange(setDealerProfile);
  }, [isDealerDashboard]);

  const dealerProfileReady = hasDealerProfile(dealerProfile);
  const visibleProducts = isDealerDashboard && dealerPermissions?.allowedSeries
    ? dashboardConfig.products.filter((product) => dealerPermissions.allowedSeries.includes(product.id))
    : dashboardConfig.products;
  return h("main", { className: "product-catalog" },
    h("header", { className: `product-catalog-header${isDealerDashboard ? " dealer-dashboard-header" : ""}` },
      h("div", { className: "dealer-dashboard-brand" },
        isDealerDashboard && dealerProfile.logoDataUrl
          ? h("img", { className: "dealer-profile-logo", src: dealerProfile.logoDataUrl, alt: getDealerDisplayName(dealerProfile) || "Dealer logo" })
          : h("div", { className: `product-catalog-mark${isDealerDashboard ? " dealer-profile-logo fallback" : ""}` },
            isDealerDashboard ? getDealerInitials(dealerProfile) : "OM"
          ),
        h("div", null,
          h("h1", null, isDealerDashboard && dealerProfileReady
            ? getDealerDisplayName(dealerProfile)
            : dashboardConfig.title),
          h("p", null, isDealerDashboard && dealerProfile.subtitle
            ? dealerProfile.subtitle
            : dashboardConfig.subtitle)
        )
      ),
      isDealerDashboard && h("a", { className: "dealer-dashboard-profile", href: "/dealer/profile/" },
        dealerProfileReady ? "经销商资料设置" : "请先完善经销商资料"
      )
    ),
    isDealerDashboard && !dealerProfileReady && h("div", { className: "dealer-profile-notice" }, "请先完善经销商资料，Dealer 配置器会使用这里的品牌与联系方式。"),
    h("section", { className: "product-card-grid", "aria-label": "产品系列" },
      visibleProducts.map((product, index) =>
        h("a", { className: "product-card", href: product.href, key: product.id },
          h("div", { className: "product-card-content" },
            h("h2", null, product.title),
            h("h3", null, product.subtitle),
            h("p", null, product.description)
          ),
          h("img", {
            className: "product-card-image",
            src: product.image,
            alt: product.title,
            loading: "lazy",
            decoding: "async",
            fetchPriority: index === 0 ? "high" : undefined
          })
        )
      )
    )
  );
}

createRoot(document.getElementById("root")).render(h(Dashboard));
