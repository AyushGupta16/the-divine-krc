import { createFileRoute } from "@tanstack/react-router";
import { PartyHallEnquiry } from "@/components/booking/PartyHallEnquiry";

export const Route = createFileRoute("/party-hall-enquiry")({
  component: PartyHallEnquiry,
});
