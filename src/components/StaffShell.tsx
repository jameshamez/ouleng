"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { Brand, Spinner } from "@/components/ui";
import { api, useApi } from "@/lib/client";

type Role = "somtam" | "cafe" | "cashier" | "admin";
type StaffMe = { role: Role; label: string };

const NAV: { href: string; label: string; icon: string; roles: Role[] }[] = [
  { href: "/staff/kitchen", label: "ครัว", icon: "🔥", roles: ["somtam", "cafe", "cashier", "admin"] },
  { href: "/staff/cashier", label: "แคชเชียร์", icon: "💰", roles: ["cashier", "admin"] },
  { href: "/staff/bookings", label: "การจอง", icon: "📅", roles: ["cashier", "admin"] },
  { href: "/staff/admin", label: "จัดการร้าน", icon: "⚙️", roles: ["admin"] },
];

const StaffCtx = createContext<StaffMe | null>(null);
export const useStaff = () => useContext(StaffCtx)!;

export function StaffShell({ children }: { children: React.ReactNode }) {
  const { data, error, isLoading, mutate } = useApi<StaffMe>("staffMe", undefined, { shouldRetryOnError: false });
  const path = usePathname();
  const router = useRouter();

  const nav = NAV.filter((n) => data && n.roles.includes(data.role));
  const atRoot = path === "/staff";
  const home = nav[0]?.href;
  useEffect(() => {
    if (home && atRoot) router.replace(home);
  }, [home, atRoot, router]);

  if (isLoading) return <Spinner />;
  if (error || !data) return <PinLogin onDone={() => mutate()} />;
  if (atRoot) return <Spinner />;

  return (
    <StaffCtx.Provider value={data}>
      <div className="min-h-dvh bg-cream">
        <header className="no-print sticky top-0 z-30 bg-paper/95 backdrop-blur border-b border-line">
          <div className="flex items-center gap-4 px-4 h-16">
            <Brand sub={`พนักงาน · ${data.label}`} />
            <nav className="flex gap-1 ml-4 overflow-x-auto no-scrollbar">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                    path.startsWith(n.href) ? "bg-teal text-white shadow" : "hover:bg-sand"
                  }`}
                >
                  {n.icon} {n.label}
                </Link>
              ))}
            </nav>
            <button
              className="ml-auto shrink-0 text-sm text-muted hover:text-red"
              onClick={async () => {
                await api("staffLogout");
                mutate(undefined, { revalidate: true });
              }}
            >
              ออกจากระบบ
            </button>
          </div>
        </header>
        {children}
      </div>
    </StaffCtx.Provider>
  );
}

function PinLogin({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const press = async (k: string) => {
    if (busy) return;
    if (k === "⌫") return setPin((p) => p.slice(0, -1));
    const next = (pin + k).slice(0, 4);
    setPin(next);
    setErr(null);
    if (next.length === 4) {
      setBusy(true);
      try {
        await api("staffLogin", { pin: next });
        onDone();
      } catch (e) {
        setErr((e as Error).message);
        setPin("");
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <main className="min-h-dvh tile-bg grid place-items-center p-4">
      <div className="card w-full max-w-xs p-6 text-center">
        <div className="flex justify-center"><Brand sub="สำหรับพนักงาน" /></div>
        <p className="mt-5 text-sm text-muted">ใส่ PIN</p>
        <div className="mt-2 flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-3.5 w-3.5 rounded-full transition ${i < pin.length ? "bg-teal scale-110" : "bg-line"}`} />
          ))}
        </div>
        <p className="h-5 mt-2 text-sm text-red">{err}</p>
        <div className="mt-2 grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
            k ? (
              <button key={i} onClick={() => press(k)} className="h-14 rounded-2xl bg-sand/70 text-xl font-semibold active:bg-mint-soft">
                {k}
              </button>
            ) : (
              <span key={i} />
            ),
          )}
        </div>
        {process.env.NODE_ENV !== "production" && (
          <p className="mt-4 text-[11px] text-muted">เดโม: ส้มตำ 1111 · คาเฟ่ 2222 · แคชเชียร์ 3333 · แอดมิน 9999</p>
        )}
      </div>
    </main>
  );
}
