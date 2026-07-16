import { Plus } from "lucide-react";

import type {
  RoomFloor,
  RoomsLegendItem,
  RoomsPageData,
  RoomsPartyHall,
  RoomStatus,
  RoomTile,
  RoomType,
  RoomTypeCard,
} from "@/types/booking";
import { formatINR } from "@/lib/booking-math";
import { cn } from "@/lib/utils";
import roomDeluxe from "@/assets/room-deluxe.jpg";
import roomBalcony from "@/assets/room-balcony.jpg";
import partyHallImg from "@/assets/party-hall.jpg";

// ── Tokens ──────────────────────────────────────────────────────────────────

/** Status → accent color (bar, dot, label ink), per the design tokens. */
const STATUS_COLOR: Record<RoomStatus, string> = {
  occupied: "#c5a059",
  available: "#5a8a5a",
  cleaning: "#3a6ea5",
  maintenance: "#b4553f",
};

const STATUS_LABEL: Record<RoomStatus, string> = {
  occupied: "Occupied",
  available: "Available",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
};

const TYPE_IMAGE: Record<RoomType, string> = {
  deluxe: roomDeluxe,
  deluxe_balcony: roomBalcony,
};

/** Short tile-badge label for a room's type. */
const TYPE_SHORT: Record<RoomType, string> = {
  deluxe: "Deluxe",
  deluxe_balcony: "Balcony",
};

// ── Type cards ──────────────────────────────────────────────────────────────

function availabilityLine(card: RoomTypeCard): { text: string; color: string } {
  if (card.available === 0) return { text: "Fully booked", color: "#b4553f" };
  return {
    text: `${card.available} available`,
    color: "#5a8a5a",
  };
}

function TypeCard({ card }: { card: RoomTypeCard }) {
  const avail = availabilityLine(card);
  return (
    <div className="flex items-center gap-4.5 rounded-lg border border-[#eae4d6] bg-white px-5 py-4.5">
      <img
        src={TYPE_IMAGE[card.type]}
        alt=""
        className="size-19.5 flex-none rounded-md object-cover"
      />
      <div className="flex-1">
        <div className="font-display text-[19px] font-semibold">{card.name}</div>
        <div className="mt-0.75 text-[12px] text-[#7a746a]">
          {card.count} rooms · {card.areaSqm} m² ·{" "}
          <b style={{ color: avail.color }}>{avail.text}</b>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[9px] uppercase tracking-[0.18em] text-[#a49d8d]">Rate</div>
        <div className="font-display text-[21px] text-[#a8863f]">
          {formatINR(card.pricePerNight)}
        </div>
        <button
          type="button"
          className="text-[11px] font-semibold text-gold transition-colors hover:text-[#a8863f]"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

// ── Legend ──────────────────────────────────────────────────────────────────

function Legend({ items }: { items: RoomsLegendItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4.5">
      {items.map((l) => (
        <div key={l.status} className="flex items-center gap-1.75 text-[12px] text-warm-gray">
          <span
            className="size-2.75 rounded-[3px]"
            style={{ background: STATUS_COLOR[l.status] }}
          />
          {l.label} <b className="font-bold">{l.count}</b>
        </div>
      ))}
    </div>
  );
}

// ── Floor board ─────────────────────────────────────────────────────────────

function RoomTileCard({ room }: { room: RoomTile }) {
  const color = STATUS_COLOR[room.status];
  return (
    <button
      type="button"
      className="relative overflow-hidden rounded-lg border border-[#eae4d6] bg-white px-3.5 py-3.25 text-left transition-shadow hover:border-[#c9bd98] hover:shadow-[0_6px_16px_-10px_rgba(10,10,10,0.3)]"
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
      <div className="flex items-center justify-between">
        <span className="font-display text-[20px] font-semibold">{room.no}</span>
        <span className="size-2 rounded-full" style={{ background: color }} />
      </div>
      <div className="mt-0.75 text-[10px] uppercase tracking-[0.06em] text-[#a49d8d]">
        {TYPE_SHORT[room.type]}
      </div>
      <div className="mt-1.25 text-[11px] font-semibold" style={{ color }}>
        {STATUS_LABEL[room.status]}
      </div>
      <div className="mt-0.5 text-[11px] text-[#a49d8d]">{room.detail}</div>
    </button>
  );
}

function FloorBoard({ floor }: { floor: RoomFloor }) {
  return (
    <div>
      <div className="mb-3 mt-1 font-display text-[15px] font-semibold text-warm-gray">
        {floor.label}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {floor.rooms.map((room) => (
          <RoomTileCard key={room.no} room={room} />
        ))}
      </div>
    </div>
  );
}

// ── Party hall ──────────────────────────────────────────────────────────────

function PartyHallCard({ hall }: { hall: RoomsPartyHall }) {
  return (
    <div>
      <div className="mb-3 mt-1 font-display text-[15px] font-semibold text-warm-gray">
        Ground floor · Event space
      </div>
      <div className="relative flex flex-wrap items-center gap-5 overflow-hidden rounded-lg bg-obsidian px-6 py-5 text-ivory">
        <span className="absolute inset-y-0 left-0 w-1 bg-gold" />
        <img
          src={partyHallImg}
          alt=""
          className="h-18.5 w-27.5 flex-none rounded-md object-cover"
        />
        <div className="min-w-45 flex-1">
          <div className="font-display text-[20px] font-semibold text-gold-soft">Party Hall</div>
          <div className="mt-1 text-[12px] text-[#c9c3b6]">
            Up to 150 guests · tailored pricing · slots: morning / afternoon / evening / full day
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold text-[#f0c96a]">Next: {hall.nextLabel}</div>
          <div className="mt-0.75 text-[11px] text-[#8a8479]">{hall.availability}</div>
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function Rooms({ data }: { data: RoomsPageData }) {
  return (
    <div className="flex flex-col gap-5.5 p-4 sm:p-6.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] tracking-[0.01em] text-[#7a746a]">{data.summaryLine}</p>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-[12px] font-semibold text-obsidian transition-colors hover:bg-[#b8933f]"
        >
          <Plus className="size-4" />
          Add room
        </button>
      </div>

      <div className="grid gap-4.5 lg:grid-cols-2">
        {data.typeCards.map((card) => (
          <TypeCard key={card.type} card={card} />
        ))}
      </div>

      <Legend items={data.legend} />

      {data.floors.map((floor) => (
        <FloorBoard key={floor.floor} floor={floor} />
      ))}

      <PartyHallCard hall={data.partyHall} />
    </div>
  );
}
