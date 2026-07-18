import { createFileRoute } from "@tanstack/react-router";
import { Book } from "@/components/booking/Book";

export const Route = createFileRoute("/book")({
  component: Book,
});
