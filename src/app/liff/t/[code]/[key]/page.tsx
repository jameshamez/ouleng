"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorBox, Spinner } from "@/components/ui";
import { api } from "@/lib/client";
import type { DiningSession } from "@/lib/types";

/** Landing page encoded in each table's QR: join (or open) the table's bill. */
export default function JoinTable() {
  const { code, key } = useParams<{ code: string; key: string }>();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ session: DiningSession }>("joinTable", { tableCode: code, key })
      .then(({ session }) => router.replace(`/liff/table/${session.id}`))
      .catch((e) => setErr(e.message));
  }, [code, key, router]);

  if (err) return <div className="mx-auto max-w-md p-6 pt-20"><ErrorBox message={err} /></div>;
  return <Spinner label={`กำลังเปิดโต๊ะ ${decodeURIComponent(code)}…`} />;
}
