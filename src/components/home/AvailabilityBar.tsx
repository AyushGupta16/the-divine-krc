import { useState } from "react";
import { format, addDays } from "date-fns";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { CounterField } from "@/components/home/CounterField";
import { TIME_SLOTS, formatTimeLabel } from "@/lib/time-slots";

function buildAvailabilityMessage({
  arrivalDate,
  arrivalTime,
  departureDate,
  departureTime,
  guests,
  rooms,
}: {
  arrivalDate: Date;
  arrivalTime: string;
  departureDate: Date;
  departureTime: string;
  guests: number;
  rooms: number;
}) {
  const arrival = `${format(arrivalDate, "EEE, dd MMM")} at ${formatTimeLabel(arrivalTime)}`;
  const departure = `${format(departureDate, "EEE, dd MMM")} at ${formatTimeLabel(departureTime)}`;
  const guestLabel = `${guests} ${guests === 1 ? "Adult" : "Adults"}`;
  const roomLabel = `${rooms} ${rooms === 1 ? "Room" : "Rooms"}`;
  return `Hi Divine KRC, I'd like to check availability: Arrival ${arrival}, Departure ${departure}, ${guestLabel}, ${roomLabel}.`;
}

export function AvailabilityBar() {
  const [arrivalDate, setArrivalDate] = useState(() => new Date());
  const [arrivalTime, setArrivalTime] = useState("14:00");
  const [departureDate, setDepartureDate] = useState(() => addDays(new Date(), 2));
  const [departureTime, setDepartureTime] = useState("11:00");
  const [guests, setGuests] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [arrivalOpen, setArrivalOpen] = useState(false);
  const [departureOpen, setDepartureOpen] = useState(false);

  const message = buildAvailabilityMessage({
    arrivalDate,
    arrivalTime,
    departureDate,
    departureTime,
    guests,
    rooms,
  });
  const whatsappHref = `https://wa.me/918707368307?text=${encodeURIComponent(message)}`;

  return (
    <div id="book" className="relative z-20 -mt-16 md:-mt-20 px-5 md:px-10">
      <div className="mx-auto max-w-6xl bg-ivory shadow-[0_30px_60px_-25px_rgba(10,10,10,0.45)] border border-gold/20 rounded-sm">
        <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-stone-200">
          <div className="px-5 py-5 md:px-7 md:py-6">
            <div className="text-[9px] uppercase tracking-[0.28em] text-warm-gray/70 font-semibold mb-2">
              Arrival
            </div>
            <Popover open={arrivalOpen} onOpenChange={setArrivalOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-left font-display text-lg md:text-xl text-obsidian hover:text-gold transition-colors"
                >
                  {format(arrivalDate, "EEE, dd MMM")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={arrivalDate}
                  onSelect={(d) => {
                    if (!d) return;
                    setArrivalDate(d);
                    setArrivalOpen(false);
                    if (d >= departureDate) setDepartureDate(addDays(d, 2));
                  }}
                  disabled={{ before: new Date() }}
                />
              </PopoverContent>
            </Popover>
            <Select value={arrivalTime} onValueChange={setArrivalTime}>
              <SelectTrigger className="mt-1 h-auto w-fit gap-1 border-none bg-transparent p-0 text-[11px] text-warm-gray/70 shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {formatTimeLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="px-5 py-5 md:px-7 md:py-6">
            <div className="text-[9px] uppercase tracking-[0.28em] text-warm-gray/70 font-semibold mb-2">
              Departure
            </div>
            <Popover open={departureOpen} onOpenChange={setDepartureOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-left font-display text-lg md:text-xl text-obsidian hover:text-gold transition-colors"
                >
                  {format(departureDate, "EEE, dd MMM")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={departureDate}
                  onSelect={(d) => {
                    if (!d) return;
                    setDepartureDate(d);
                    setDepartureOpen(false);
                  }}
                  disabled={{ before: arrivalDate }}
                />
              </PopoverContent>
            </Popover>
            <Select value={departureTime} onValueChange={setDepartureTime}>
              <SelectTrigger className="mt-1 h-auto w-fit gap-1 border-none bg-transparent p-0 text-[11px] text-warm-gray/70 shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {formatTimeLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="px-5 py-5 md:px-7 md:py-6">
            <div className="text-[9px] uppercase tracking-[0.28em] text-warm-gray/70 font-semibold mb-2">
              Guests
            </div>
            <CounterField
              value={guests}
              onChange={setGuests}
              min={1}
              max={6}
              label="Guests"
              unitLabel={(n) => `${n} ${n === 1 ? "Adult" : "Adults"}`}
            />
          </div>

          <div className="px-5 py-5 md:px-7 md:py-6">
            <div className="text-[9px] uppercase tracking-[0.28em] text-warm-gray/70 font-semibold mb-2">
              Rooms
            </div>
            <CounterField
              value={rooms}
              onChange={setRooms}
              min={1}
              max={4}
              label="Rooms"
              unitLabel={(n) => `${n} ${n === 1 ? "Room" : "Rooms"}`}
            />
          </div>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-2 flex items-center justify-center bg-obsidian text-gold text-[11px] uppercase tracking-[0.28em] font-semibold py-5 md:col-span-1 md:py-0 hover:bg-gold hover:text-obsidian transition-colors duration-500"
          >
            Check Availability
          </a>
        </div>
      </div>
      <p className="mx-auto max-w-6xl mt-3 text-center md:text-right text-[10px] uppercase tracking-[0.25em] text-warm-gray/70">
        Best rate guarantee when you book direct
      </p>
    </div>
  );
}
