import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/protected";

export const Route = createFileRoute("/vet")({
  component: VetLayout,
});

function VetLayout() {
  return (
    <Protected>
      <Outlet />
    </Protected>
  );
}
