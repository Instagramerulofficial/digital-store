import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { AiGeneratedProduct, TemplateBundleContent } from "@/types/db";
import { CoverPage, Markdown, PageFooter, styles } from "../common";

export default function TemplateBundleDocument({
  product,
}: {
  product: AiGeneratedProduct;
}) {
  const content = product.content as TemplateBundleContent;

  return (
    <Document title={product.title} author="Digital Store">
      <CoverPage
        eyebrow="Template bundle"
        title={product.title}
        subtitle={product.subtitle}
        badge={`${content.templates.length} templates`}
      />

      {content.templates.map((t, idx) => (
        <Page size="A4" style={styles.page} key={idx}>
          <Text style={styles.muted}>
            Template {String(idx + 1).padStart(2, "0")}
          </Text>
          <Text style={styles.h1}>{t.title}</Text>
          <Text style={[styles.muted, { marginBottom: 10 }]}>
            {t.description}
          </Text>
          <View style={styles.hairline} />
          <View style={styles.callout}>
            <Markdown source={t.body} />
          </View>
          <PageFooter label={product.title} />
        </Page>
      ))}
    </Document>
  );
}
