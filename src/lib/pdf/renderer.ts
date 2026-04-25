import React from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import type { AiGeneratedProduct } from "@/types/db";
import EbookDocument from "./templates/ebook";
import ChecklistDocument from "./templates/checklist";
import PromptPackDocument from "./templates/prompt-pack";
import TemplateBundleDocument from "./templates/template-bundle";
import MiniCourseDocument from "./templates/mini-course";

/**
 * Renders an AI-generated product into a PDF Buffer.
 * Returns a Node Buffer ready to upload to Supabase Storage.
 */
export async function renderProductPdf(
  product: AiGeneratedProduct,
): Promise<Buffer> {
  const doc = pickTemplate(product);
  return await renderToBuffer(doc);
}

function pickTemplate(
  product: AiGeneratedProduct,
): React.ReactElement<DocumentProps> {
  const el = (() => {
    switch (product.product_type) {
      case "ebook":
        return React.createElement(EbookDocument, { product });
      case "checklist":
        return React.createElement(ChecklistDocument, { product });
      case "prompt_pack":
        return React.createElement(PromptPackDocument, { product });
      case "template_bundle":
        return React.createElement(TemplateBundleDocument, { product });
      case "mini_course":
        return React.createElement(MiniCourseDocument, { product });
      default: {
        const _exhaustive: never = product.product_type;
        throw new Error(`Unknown product type: ${String(_exhaustive)}`);
      }
    }
  })();
  // The per-template components resolve to <Document> roots — which the
  // react-pdf typings don't infer through a custom component boundary.
  return el as unknown as React.ReactElement<DocumentProps>;
}
