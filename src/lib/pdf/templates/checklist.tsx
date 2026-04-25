import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { AiGeneratedProduct, ChecklistContent } from "@/types/db";
import { CoverPage, PageFooter, styles } from "../common";
import { pdfTheme as T } from "../theme";

export default function ChecklistDocument({
  product,
}: {
  product: AiGeneratedProduct;
}) {
  const content = product.content as ChecklistContent;
  const total = content.sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <Document title={product.title} author="Digital Store">
      <CoverPage
        eyebrow="Checklist pack"
        title={product.title}
        subtitle={product.subtitle}
        badge={`${total} actionable items`}
      />

      {content.sections.map((section, sIdx) => (
        <Page size="A4" style={styles.page} key={sIdx}>
          <Text style={styles.muted}>Section {sIdx + 1}</Text>
          <Text style={styles.h1}>{section.title}</Text>
          <View style={styles.hairline} />
          {section.items.map((item, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                marginBottom: 9,
              }}
            >
              <View
                style={{
                  width: 14,
                  height: 14,
                  marginRight: 10,
                  marginTop: 2,
                  borderRadius: 3,
                  borderWidth: 1.2,
                  borderColor: T.colors.brand,
                }}
              />
              <Text style={{ flex: 1 }}>{item}</Text>
            </View>
          ))}
          <PageFooter label={product.title} />
        </Page>
      ))}
    </Document>
  );
}
