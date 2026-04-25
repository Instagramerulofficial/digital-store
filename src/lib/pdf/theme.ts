/** Shared design tokens for the PDF templates. */
export const pdfTheme = {
  colors: {
    brand: "#7c3aed",
    brandDark: "#5b21b6",
    ink: "#111111",
    body: "#333333",
    muted: "#6b7280",
    hairline: "#e5e7eb",
    soft: "#f5f3ff",
  },
  font: {
    family: "Helvetica",
    familyBold: "Helvetica-Bold",
    familyOblique: "Helvetica-Oblique",
  },
  size: {
    page: { paddingX: 56, paddingY: 64 },
    text: {
      hero: 34,
      h1: 22,
      h2: 16,
      h3: 13,
      body: 11,
      small: 9,
    },
  },
} as const;
