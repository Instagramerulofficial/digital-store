import { requireAdmin } from "@/lib/auth";
import GeneratorForm from "./GeneratorForm";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI product generator" };

export default async function AdminGeneratePage() {
  await requireAdmin();
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="flex items-start gap-3 mb-8">
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)" }}
        >
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI product generator</h1>
          <p className="muted text-sm mt-1 max-w-xl">
            Describe the product you want to sell. The assistant will write the
            title, sales copy, outline, full content, FAQ and tags, and save it
            as a draft you can edit and publish.
          </p>
        </div>
      </div>
      <GeneratorForm />
    </div>
  );
}
