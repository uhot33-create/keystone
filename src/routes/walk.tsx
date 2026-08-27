import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/protected";

export const Route = createFileRoute("/walk")({
  component: WalkLayout,
});

function WalkLayout() {
  return (
    <Protected>
      <Outlet />
    </Protected>
  );
}
