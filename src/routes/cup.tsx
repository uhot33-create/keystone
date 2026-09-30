import { createFileRoute } from "@tanstack/react-router";
import { CupApp } from "@/components/cup/cup-app";
import { Protected } from "@/components/protected";

export const Route = createFileRoute("/cup")({ component: CupPage });

function CupPage() {
  return (
    <Protected>
      <CupApp />
    </Protected>
  );
}
