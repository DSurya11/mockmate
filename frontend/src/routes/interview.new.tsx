import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/interview/new")({
  component: () => <Navigate to="/dashboard/practice" />,
});
