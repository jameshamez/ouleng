"use client";

import { useEffect, useState } from "react";
import { DEMO_USERS, getDemoUser, getLiff, lineMode, setDemoUser, type DemoUser } from "@/lib/client";
import { Spinner } from "@/components/ui";

export default function LiffLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!lineMode);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!lineMode) return;
    getLiff()
      .then(() => setReady(true))
      .catch((e) => setErr(String(e?.message ?? e)));
  }, []);

  if (err) return <div className="p-6 text-center text-sm text-red">เปิด LINE ไม่สำเร็จ: {err}</div>;
  if (!ready) return <Spinner label="กำลังเชื่อมต่อ LINE…" />;

  return (
    <div className="min-h-dvh">
      {children}
      {!lineMode && <DemoUserSwitch />}
    </div>
  );
}

/** Demo-only: pretend to be a different LINE user. */
function DemoUserSwitch() {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<DemoUser | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- read localStorage after mount
  useEffect(() => setMe(getDemoUser()), []);
  if (!me) return null;
  return (
    <div className="fixed left-3 bottom-24 z-[45]">
      {open && (
        <div className="card mb-2 p-2 w-48 animate-pop">
          <div className="px-2 py-1 text-[11px] text-muted">โหมดเดโม · สลับผู้ใช้ LINE</div>
          {DEMO_USERS.map((u) => (
            <button
              key={u.userId}
              className={`block w-full rounded-xl px-2 py-1.5 text-left text-sm ${u.userId === me.userId ? "bg-brand-soft font-semibold" : "hover:bg-sand"}`}
              onClick={() => {
                setDemoUser(u);
                window.location.reload();
              }}
            >
              {u.displayName}
            </button>
          ))}
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} className="chip bg-ink/80 text-white py-1.5 shadow-lg backdrop-blur">
        🧪 {me.displayName}
      </button>
    </div>
  );
}
