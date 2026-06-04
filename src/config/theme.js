export const theme = {
  colors: {
    background: "#F7F5F0",
    card: "#FFFFFF",
    primary: "#667D73",
    primaryHover: "#54685F",
    text: "#2F3432",
    textSecondary: "#6B706D",
    border: "#E5E1D8",
    divider: "#EFEAE1",
    walnut: "#8A6545",
    oak: "#D8C3A5",
    input: "#FBFAF7",
    subtle: "#F4F1EC",
    warningBg: "#FFF7E4",
    warningText: "#6F4B23",
    dangerBg: "#FFF2EF",
    dangerText: "#9A3526",
    danger: "#C55642",
    silverGrey: "#B8BEC2",
    woodBrown: "#8A6545",
    black: "#151515",
    white: "#F2F0EA",
    glass: "#7E8B92",
    tea: "#9C6848"
  },
  radius: {
    sm: "8px",
    md: "12px",
    lg: "16px"
  },
  shadow: {
    card: "0 2px 8px rgba(0,0,0,0.04)"
  },
  fontFamily: 'Inter, "Microsoft YaHei", "PingFang SC", system-ui, sans-serif'
};

export const swatchColors = {
  "Silver Grey": theme.colors.silverGrey,
  Black: theme.colors.black,
  "Wood Brown": theme.colors.woodBrown,
  "Default Wood": theme.colors.woodBrown,
  黑: theme.colors.black,
  白: theme.colors.white,
  胡桃木: theme.colors.walnut,
  浅橡木: theme.colors.oak,
  透明灰: theme.colors.glass,
  茶色: theme.colors.tea,
  银色: theme.colors.primary
};

export function applyTheme(target = document.documentElement) {
  target.style.setProperty("--font-family", theme.fontFamily);
  target.style.setProperty("--ink", theme.colors.text);
  target.style.setProperty("--muted", theme.colors.textSecondary);
  target.style.setProperty("--line", theme.colors.border);
  target.style.setProperty("--divider", theme.colors.divider);
  target.style.setProperty("--paper", theme.colors.background);
  target.style.setProperty("--panel", theme.colors.card);
  target.style.setProperty("--primary", theme.colors.primary);
  target.style.setProperty("--primary-hover", theme.colors.primaryHover);
  target.style.setProperty("--walnut", theme.colors.walnut);
  target.style.setProperty("--oak", theme.colors.oak);
  target.style.setProperty("--input", theme.colors.input);
  target.style.setProperty("--subtle", theme.colors.subtle);
  target.style.setProperty("--warning-bg", theme.colors.warningBg);
  target.style.setProperty("--warning-text", theme.colors.warningText);
  target.style.setProperty("--danger-bg", theme.colors.dangerBg);
  target.style.setProperty("--danger-text", theme.colors.dangerText);
  target.style.setProperty("--danger", theme.colors.danger);
  target.style.setProperty("--silver-grey", theme.colors.silverGrey);
  target.style.setProperty("--wood-brown", theme.colors.woodBrown);
  target.style.setProperty("--black", theme.colors.black);
  target.style.setProperty("--white-soft", theme.colors.white);
  target.style.setProperty("--glass", theme.colors.glass);
  target.style.setProperty("--tea", theme.colors.tea);
  target.style.setProperty("--radius-sm", theme.radius.sm);
  target.style.setProperty("--radius-md", theme.radius.md);
  target.style.setProperty("--radius-lg", theme.radius.lg);
  target.style.setProperty("--shadow-card", theme.shadow.card);
}
