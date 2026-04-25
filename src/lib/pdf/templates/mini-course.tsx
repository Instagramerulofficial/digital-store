import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { AiGeneratedProduct, MiniCourseContent } from "@/types/db";
import { CoverPage, Markdown, PageFooter, styles } from "../common";
import { pdfTheme as T } from "../theme";

export default function MiniCourseDocument({
  product,
}: {
  product: AiGeneratedProduct;
}) {
  const content = product.content as MiniCourseContent;
  const lessons = content.modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <Document title={product.title} author="Digital Store">
      <CoverPage
        eyebrow="Mini-course + workbook"
        title={product.title}
        subtitle={product.subtitle}
        badge={`${content.modules.length} modules · ${lessons} lessons`}
      />

      {/* Course map */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Course map</Text>
        {content.modules.map((m, mi) => (
          <View key={mi} style={{ marginBottom: 10 }}>
            <Text style={styles.h2}>
              Module {mi + 1}. {m.title}
            </Text>
            <Text style={styles.muted}>{m.summary}</Text>
            {m.lessons.map((l, li) => (
              <Text key={li} style={{ marginLeft: 14, marginTop: 3 }}>
                {mi + 1}.{li + 1} {l.title}
              </Text>
            ))}
          </View>
        ))}
        <PageFooter label={product.title} />
      </Page>

      {/* Lessons + exercises */}
      {content.modules.map((m, mi) =>
        m.lessons.map((lesson, li) => (
          <Page size="A4" style={styles.page} key={`${mi}-${li}`}>
            <Text style={styles.muted}>
              Module {mi + 1} · Lesson {mi + 1}.{li + 1}
            </Text>
            <Text style={styles.h1}>{lesson.title}</Text>
            <View style={styles.hairline} />
            <Markdown source={lesson.content_markdown} />

            {lesson.exercises && lesson.exercises.length > 0 ? (
              <View
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 6,
                  backgroundColor: T.colors.soft,
                }}
                wrap={false}
              >
                <Text style={[styles.h3, { marginTop: 0 }]}>
                  Workbook exercises
                </Text>
                {lesson.exercises.map((ex, ei) => (
                  <View key={ei} style={styles.listRow}>
                    <Text style={styles.bullet}>
                      {String(ei + 1).padStart(2, "0")}.
                    </Text>
                    <Text style={styles.listText}>{ex}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <PageFooter label={product.title} />
          </Page>
        )),
      )}
    </Document>
  );
}
