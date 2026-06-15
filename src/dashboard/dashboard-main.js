import React from "react";
import { createRoot } from "react-dom/client";
import { dashboardProducts } from "./config/dashboardProducts.js?v=dashboard-webp-20260615-01";

const h = React.createElement;

function Dashboard() {
  return h("main", { className: "product-catalog" },
    h("header", { className: "product-catalog-header" },
      h("div", { className: "product-catalog-mark" }, "OM"),
      h("div", null,
        h("h1", null, "OMAX Wardrobe Configurator"),
        h("p", null, "请选择产品系列")
      )
    ),
    h("section", { className: "product-card-grid", "aria-label": "产品系列" },
      dashboardProducts.map((product, index) =>
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
