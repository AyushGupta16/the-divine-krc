import { useEffect, useState } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";

import { createGuestFn, updateGuestFn } from "@/lib/bookings-data";
import type { Guest } from "@/types/booking";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetEyebrow,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const FIELD =
  "h-auto rounded-[5px] border-[#e5ddcb] bg-white px-3.25 py-2.75 text-[13.5px] shadow-none " +
  "placeholder:text-[#b3aa96] focus-visible:border-gold focus-visible:ring-0";
const LABEL = "mb-1.75 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7a746a]";

const EMPTY_FORM = { name: "", phone: "", email: "", city: "" };

/**
 * The Guests directory's create/edit drawer. Same controlled `Sheet` shape
 * as `PartyHallEntryForm` — `open`/`onOpenChange` only, no assumption about
 * where it's mounted, so the nav "+" chooser (create mode) can reuse it
 * without rework. `mode` picks the write path and the copy; `guest` seeds
 * edit mode and is ignored in create mode.
 *
 * Only `name`/`phone`/`email`/`city` are ever rendered as inputs —
 * `stays`/`lifetimeValue`/`tier` are derived (see `withTier` in
 * `bookings.ts`) and have no field here to be set through. In edit mode
 * they're shown as read-only context so the front desk knows whose record
 * they're touching, visually set apart from the actual form fields.
 */
export function GuestEntryForm({
  open,
  onOpenChange,
  mode,
  guest,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  guest?: Guest;
}) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      mode === "edit" && guest
        ? { name: guest.name, phone: guest.phone, email: guest.email, city: guest.city }
        : EMPTY_FORM,
    );
  }, [open, mode, guest]);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    setError(null);
    setBusy(true);
    const res =
      mode === "edit" && guest
        ? await updateGuestFn({ data: { id: guest.id, ...form } })
        : await createGuestFn({ data: form });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(mode === "edit" ? `${res.guest.id} updated.` : `Guest ${res.guest.id} created.`);
    onOpenChange(false);
    await router.invalidate();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <SheetContent className="flex w-full flex-col gap-5 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetEyebrow>Front desk</SheetEyebrow>
          <SheetTitle>{mode === "edit" ? "Edit guest" : "New guest"}</SheetTitle>
          <SheetDescription>
            {mode === "edit"
              ? "Correct this guest's contact details."
              : "Add a guest record with no booking attached."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3.5">
          {mode === "edit" && guest && (
            <div className="flex items-center justify-between rounded-[5px] border border-dashed border-[#e5ddcb] bg-[#faf7ef] px-3.25 py-2.5 text-[11px] text-[#a49d8d]">
              <span>
                {guest.id} · {guest.stays} stay{guest.stays === 1 ? "" : "s"}
              </span>
              <span className="uppercase tracking-[0.1em]">{guest.tier}</span>
            </div>
          )}

          <div>
            <label className={LABEL} htmlFor="ge-name">
              Guest name
            </label>
            <Input
              id="ge-name"
              className={FIELD}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="ge-phone">
                Phone
              </label>
              <Input
                id="ge-phone"
                className={FIELD}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+91 …"
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="ge-email">
                Email (optional)
              </label>
              <Input
                id="ge-email"
                type="email"
                className={FIELD}
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="ge-city">
              City
            </label>
            <Input
              id="ge-city"
              className={FIELD}
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-[#e6cbc2] bg-[#f7e6e0] px-3.25 py-2.5 text-[12.5px] font-medium text-[#b4553f]">
            {error}
          </p>
        )}

        <SheetFooter>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="flex h-[41px] cursor-pointer items-center justify-center gap-2 rounded-[5px] bg-gold px-5.5 text-[11px] font-bold uppercase tracking-[0.16em] text-obsidian transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : mode === "edit" ? (
              <Save className="size-3.5" />
            ) : (
              <Plus className="size-3.5" />
            )}
            {mode === "edit" ? "Save changes" : "Create guest"}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
