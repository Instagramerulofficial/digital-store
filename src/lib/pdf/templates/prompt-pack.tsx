import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { AiGeneratedProduct, PromptPackContent } from "@/types/db";
import { CoverPage, PageFooter, styles } from "../common";
import { pdfTheme as T } from "../theme";

export default function PromptPackDocument({
  product,
}: {
  product: AiGeneratedProduct;
}) {
  const content = product.content as PromptPackContent;
  const total = content.groups.reduce((n, g) => n + g.prompts.length, 0);

  return (
    <Document title={product.title} author="Digital Store">
      <CoverPage
        eyebrow="Prompt pack"
        title={product.title}
        subtitle={product.subtitle}
        badge={`${total} prompts in ${content.groups.length} groups`}
      />

      {content.groups.map((group, gIdx) => (
        <Page size="A4" style={styles.page} key={gIdx}>
          <Text style={styles.muted}>Group {gIdx + 1}</Text>
          <Text style={styles.h1}>{group.title}</Text>
          <View style={styles.hairline} />
          {group.prompts.map((p, pIdx) => (
            <View
              key={pIdx}
              style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 6,
                backgroundColor: T.colors.soft,
              }}
              wrap={false}
            >
              <Text style={styles.h3}>{p.title}</Text>
              <Text
                style={{
                  fontFamily: "Courier",
                  fontSize: 9.5,
                  color: T.colors.ink,
                  marginTop: 4,
                }}
              >
                {p.prompt}
              </Text>
              {p.tip ? (
                <Text style={[styles.muted, { marginTop: 6 }]}>
                  Tip: {p.tip}
                </Text>
              ) : null}
            </View>
          ))}
          <PageFooter label={product.title} />
        </Page>
      ))}
    </Document>
  );
}
