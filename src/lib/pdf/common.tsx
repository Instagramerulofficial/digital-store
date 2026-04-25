import React from "react";
import {
  Page,
  Text,
  View,
  StyleSheet,
  type Styles,
} from "@react-pdf/renderer";
import { pdfTheme as T } from "./theme";

/* -------------------------------------------------------------
 * Shared stylesheet
 * ------------------------------------------------------------- */
export const styles: Styles = StyleSheet.create({
  page: {
    fontFamily: T.font.family,
    fontSize: T.size.text.body,
    color: T.colors.body,
    paddingHorizontal: T.size.page.paddingX,
    paddingVertical: T.size.page.paddingY,
    lineHeight: 1.5,
    backgroundColor: "#ffffff",
  },
  coverPage: {
    fontFamily: T.font.family,
    color: "#ffffff",
    backgroundColor: T.colors.brand,
    paddingHorizontal: 56,
    paddingVertical: 80,
    justifyContent: "space-between",
    minHeight: "100%",
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.78)",
    marginBottom: 18,
    fontFamily: T.font.familyBold,
  },
  coverTitle: {
    fontSize: T.size.text.hero,
    fontFamily: T.font.familyBold,
    color: "#ffffff",
    marginBottom: 12,
    lineHeight: 1.1,
  },
  coverSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 1.4,
  },
  coverBadge: {
    marginTop: 28,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    backgroundColor: "rgba(255,255,255,0.15)",
    color: "#ffffff",
    alignSelf: "flex-start",
    fontFamily: T.font.familyBold,
  },
  coverFooter: {
    fontSize: 9,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  h1: {
    fontSize: T.size.text.h1,
    fontFamily: T.font.familyBold,
    color: T.colors.ink,
    marginBottom: 14,
  },
  h2: {
    fontSize: T.size.text.h2,
    fontFamily: T.font.familyBold,
    color: T.colors.ink,
    marginTop: 18,
    marginBottom: 8,
  },
  h3: {
    fontSize: T.size.text.h3,
    fontFamily: T.font.familyBold,
    color: T.colors.ink,
    marginTop: 12,
    marginBottom: 6,
  },
  p: {
    marginBottom: 8,
  },
  muted: {
    color: T.colors.muted,
    fontSize: T.size.text.small,
  },
  hairline: {
    height: 1,
    backgroundColor: T.colors.hairline,
    marginVertical: 14,
  },
  callout: {
    backgroundColor: T.colors.soft,
    borderLeftWidth: 3,
    borderLeftColor: T.colors.brand,
    padding: 12,
    borderRadius: 4,
    marginBottom: 10,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 56,
    right: 56,
    fontSize: 8,
    color: T.colors.muted,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  listRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  bullet: {
    width: 14,
    fontFamily: T.font.familyBold,
    color: T.colors.brand,
  },
  listText: {
    flex: 1,
  },
  tag: {
    backgroundColor: T.colors.soft,
    color: T.colors.brandDark,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 8,
    marginRight: 4,
    marginBottom: 4,
    fontFamily: T.font.familyBold,
  },
});

/* -------------------------------------------------------------
 * Cover page
 * ------------------------------------------------------------- */
export function CoverPage(props: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  badge?: string;
  siteLabel?: string;
}) {
  return (
    <Page size="A4" style={styles.coverPage}>
      <View>
        <Text style={styles.eyebrow}>{props.eyebrow}</Text>
        <Text style={styles.coverTitle}>{props.title}</Text>
        {props.subtitle ? (
          <Text style={styles.coverSubtitle}>{props.subtitle}</Text>
        ) : null}
        {props.badge ? (
          <Text style={styles.coverBadge}>{props.badge}</Text>
        ) : null}
      </View>
      <Text style={styles.coverFooter}>
        {props.siteLabel ?? "Digital Store"}
      </Text>
    </Page>
  );
}

/* -------------------------------------------------------------
 * Footer with page numbers
 * ------------------------------------------------------------- */
export function PageFooter(props: { label: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{props.label}</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

/* -------------------------------------------------------------
 * Very small markdown-ish renderer (bold + lists + paragraphs).
 * Keeps PDFs clean without pulling in a huge markdown lib.
 * ------------------------------------------------------------- */
export function Markdown({ source }: { source: string }) {
  const lines = (source ?? "").split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let i = 0;

  const flushPara = () => {
    if (para.length === 0) return;
    blocks.push(
      <Text key={`p-${i}`} style={styles.p}>
        {renderInline(para.join(" "))}
      </Text>,
    );
    para = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(
      <View key={`l-${i}`} style={{ marginBottom: 6 }}>
        {list.map((item, idx) => (
          <View key={idx} style={styles.listRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listText}>{renderInline(item)}</Text>
          </View>
        ))}
      </View>,
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    i++;
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const h1 = /^#\s+(.*)$/.exec(line);
    const h2 = /^##\s+(.*)$/.exec(line);
    const h3 = /^###\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);

    if (h1 || h2 || h3) {
      flushPara();
      flushList();
      const text = (h1 ?? h2 ?? h3)![1];
      const style = h1 ? styles.h1 : h2 ? styles.h2 : styles.h3;
      blocks.push(
        <Text key={`h-${i}`} style={style}>
          {text}
        </Text>,
      );
      continue;
    }
    if (bullet) {
      flushPara();
      list.push(bullet[1]);
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();

  return <>{blocks}</>;
}

/** Renders **bold** and `code` inline. */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Split on **bold**
  const boldSplit = text.split(/(\*\*[^*]+\*\*)/g);
  boldSplit.forEach((chunk, i) => {
    if (/^\*\*[^*]+\*\*$/.test(chunk)) {
      parts.push(
        <Text key={`b-${i}`} style={{ fontFamily: T.font.familyBold }}>
          {chunk.slice(2, -2)}
        </Text>,
      );
    } else {
      parts.push(chunk);
    }
  });
  return parts;
}
