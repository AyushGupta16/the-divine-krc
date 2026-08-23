import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
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
import { updateRoomStatusFn } from "@/lib/bookings-data";
import { can, type TeamAccount } from "@/lib/team";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import roomDeluxe from "@/assets/room-deluxe.jpg";
import roomBalcony from "@/assets/room-balcony.jpg";
import partyHallImg from "@/assets/party-hall.webp";

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

function TypeCard({ card, canManageRooms }: { card: RoomTypeCard; canManageRooms: boolean }) {
  const avail = availabilityLine(card);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#eae4d6] bg-white p-3.5 sm:gap-4.5 sm:px-5 sm:py-4.5">
      <img
        src={TYPE_IMAGE[card.type]}
        alt=""
        className="size-14 flex-none rounded-md object-cover sm:size-19.5"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[16px] font-semibold sm:text-[19px]">
          {card.name}
        </div>
        <div className="mt-0.75 text-[11px] text-[#7a746a] sm:text-[12px]">
          {card.count} rooms · {card.areaSqm} m² ·{" "}
          <b style={{ color: avail.color }}>{avail.text}</b>
        </div>
      </div>
      <div className="flex-none text-right">
        <div className="text-[9px] uppercase tracking-[0.18em] text-[#a49d8d]">Rate</div>
        <div className="font-display text-[17px] text-[#a8863f] sm:text-[21px]">
          {formatINR(card.pricePerNight)}
        </div>
        {canManageRooms && (
          <Link
            to="/admin/settings"
            hash="pricing"
            className="text-[11px] font-semibold text-gold transition-colors hover:text-[#a8863f]"
          >
            Edit
          </Link>
        )}
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

// "occupied" isn't selectable here (Slice 2): it's derived live from the
// booking ledger (a checked-in guest in the room), never a manual opinion —
// see `liveRoomTiles`. Staff can still set the three genuine housekeeping
// states.
const STATUS_ORDER: RoomStatus[] = ["available", "cleaning", "maintenance"];

/** Room tile: click opens a popover beside the cell to set that room's status. */
function RoomTileCard({ room }: { room: RoomTile }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const color = STATUS_COLOR[room.status];

  async function setStatus(status: RoomStatus) {
    setBusy(true);
    setError(null);
    const res = await updateRoomStatusFn({
      data: { no: room.no, status, detail: status === "available" ? "Ready" : room.detail },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await router.invalidate();
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent
        className="w-56 max-w-[calc(100vw-1.5rem)] p-3"
        align="start"
        sideOffset={6}
        collisionPadding={12}
      >
        <div className="mb-2.5 text-[11px] font-semibold text-warm-gray">
          Room {room.no} · {TYPE_SHORT[room.type]} · Floor {room.floor}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_ORDER.map((status) => (
            <button
              key={status}
              type="button"
              disabled={busy}
              onClick={() => void setStatus(status)}
              className={cn(
                "rounded-md border px-2 py-2.5 text-[12px] font-semibold transition-colors disabled:opacity-50",
                room.status === status
                  ? "border-transparent text-white"
                  : "border-[#eae4d6] bg-white text-warm-gray hover:bg-black/3",
              )}
              style={room.status === status ? { background: STATUS_COLOR[status] } : undefined}
            >
              {STATUS_LABEL[status]}
            </button>
          ))}
        </div>
        {error && <p className="mt-2 text-[11px] text-[#b4553f]">{error}</p>}
      </PopoverContent>
    </Popover>
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
      <div className="relative flex flex-wrap items-center gap-3.5 overflow-hidden rounded-lg bg-obsidian px-4 py-4 text-ivory sm:gap-5 sm:px-6 sm:py-5">
        <span className="absolute inset-y-0 left-0 w-1 bg-gold" />
        <img
          src={partyHallImg}
          alt=""
          className="h-14 w-21 flex-none rounded-md object-cover sm:h-18.5 sm:w-27.5"
        />
        <div className="min-w-0 flex-1 sm:min-w-45">
          <div className="font-display text-[17px] font-semibold text-gold-soft sm:text-[20px]">
            Party Hall
          </div>
          <div className="mt-1 text-[11px] text-[#c9c3b6] sm:text-[12px]">
            Up to 150 guests · tailored pricing · slots: morning / afternoon / evening / full day
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold text-[#f0c96a]">Next: {hall.nextLabel}</div>
          {hall.availability && (
            <div className="mt-0.75 text-[11px] text-[#8a8479]">{hall.availability}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function Rooms({ data, member }: { data: RoomsPageData; member: TeamAccount | null }) {
  const canManageRooms = !!member && can(member.role, "rooms:write");
  return (
    <div className="flex flex-col gap-5.5 p-4 sm:p-6.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] tracking-[0.01em] text-[#7a746a]">{data.summaryLine}</p>
        {canManageRooms && (
          <Link
            to="/admin/settings"
            hash="pricing"
            className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-[12px] font-semibold text-obsidian transition-colors hover:bg-[#b8933f]"
          >
            <Plus className="size-4" />
            Add room
          </Link>
        )}
      </div>

      <div className="grid gap-4.5 lg:grid-cols-2">
        {data.typeCards.map((card) => (
          <TypeCard key={card.type} card={card} canManageRooms={canManageRooms} />
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
