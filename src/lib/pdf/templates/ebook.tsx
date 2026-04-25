import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { AiGeneratedProduct, EbookContent } from "@/types/db";
import { CoverPage, Markdown, PageFooter, styles } from "../common";

export default function EbookDocument({
  product,
}: {
  product: AiGeneratedProduct;
}) {
  const content = product.content as EbookContent;
  return (
    <Document
      title={product.title}
      author="Digital Store"
      subject={product.subtitle}
    >
      <CoverPage
        eyebrow="eBook"
        title={product.title}
        subtitle={product.subtitle}
        badge={`${content.chapters.length} chapters`}
      />

      {/* Table of contents */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Contents</Text>
        {content.chapters.map((ch, idx) => (
          <View key={idx} style={{ flexDirection: "row", marginBottom: 6 }}>
            <Text style={{ width: 22, ...styles.muted }}>
              {String(idx + 1).padStart(2, "0")}.
            </Text>
            <Text style={{ flex: 1 }}>{ch.title}</Text>
          </View>
        ))}
        <PageFooter label={product.title} />
      </Page>

      {/* Chapters */}
      {content.chapters.map((ch, idx) => (
        <Page size="A4" style={styles.page} key={idx}>
          <Text style={styles.muted}>
            Chapter {String(idx + 1).padStart(2, "0")}
          </Text>
          <Text style={styles.h1}>{ch.title}</Text>
          <View style={styles.hairline} />
          <Markdown source={ch.body_markdown} />
          <PageFooter label={product.title} />
        </Page>
      ))}
    </Document>
  );
}
