import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/walk/logs")({
  component: () => <Outlet />,
});
