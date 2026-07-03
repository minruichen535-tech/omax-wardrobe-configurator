import React from "react";
import { createRoot } from "react-dom/client";
import { brandInfo } from "./logo/brand.js?v=client-dashboard-brand-text-20260703-01";

const h = React.createElement;

const dashboardProducts = [
  {
    id: "japanese-closet",
    title: "铝日式立柱衣柜",
    subtitle: "Japanese Style Post Wardrobe System",
    description: "顶部与墙体固定、底部与地面固定的开放式开放收纳系统，支持层板、挂衣杆、柜体及多种收纳组件自由组合。",
    image: "./images/japaness-closet.png?v=purenest-20260703-01",
    href: "../client/japanese-closet/"
  },
  {
    id: "aluminum-post-wardrobe",
    title: "铝立柱衣柜",
    subtitle: "Aluminum Post Wardrobe System",
    description: "以铝合金立柱为核心结构，兼顾展示与收纳需求，适用于卧室、衣帽间及高端住宅空间。",
    image: "./images/Aluminum-Post-Wardrob.png?v=purenest-20260703-01",
    href: "../client/aluminum-post-wardrobe/"
  },
  {
    id: "carbon-steel-post-wardrobe",
    title: "碳钢立柱衣柜",
    subtitle: "Carbon Steel Post Wardrobe System",
    description: "采用高强度碳钢结构，兼顾成本与承重性能，适用于开放式衣柜及多功能收纳空间。",
    image: "./images/Carbon Steel Post Wardrobe.png?v=purenest-20260703-01",
    href: "../client/carbon-steel-post-wardrobe/"
  },
  {
    id: "aluminum-base-supported",
    title: "铝托底式衣柜",
    subtitle: "Aluminum Base Supported Wardrobe System",
    description: "以托底结构为核心，支持木层板、玻璃层板、鞋层板及柜体系统组合，实现更完整的展示与收纳效果。",
    image: "./images/Aluminum%20Base%20Supported.png?v=purenest-20260703-01",
    href: "../client/aluminum-base-supported/"
  },
  {
    id: "wall-mounted",
    title: "铝壁挂式衣柜",
    subtitle: "Aluminum Wall Mounted Wardrobe System",
    description: "依墙而生，以墙体为支撑，自由搭配背板系统、挂衣系统及收纳模块，打造完整开放式衣帽间方案。",
    image: "./images/Wall%20Mounted%20.png?v=purenest-20260703-01",
    href: "../client/wall-mounted/"
  }
];

function Dashboard() {
  const brandAlt = [brandInfo.brandNameEn, brandInfo.brandNameCn].filter(Boolean).join(" ");
  return h("main", { className: "product-catalog" },
    h("header", { className: "product-catalog-header client-dashboard-header", "aria-label": brandAlt },
      h("img", {
        className: "client-dashboard-logo",
        src: "./logo/logo.png",
        alt: brandAlt,
        decoding: "async",
        fetchPriority: "high"
      }),
      h("div", { className: "client-dashboard-brand" },
        h("strong", null, brandInfo.brandNameEn),
        h("span", null, brandInfo.brandNameCn)
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
