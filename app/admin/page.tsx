import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { weeklyActivity } from "@/lib/activity";
import { GREEN, GREEN_DK, INK, MUTE, font } from "@/lib/theme";
import PayoutRow from "./PayoutRow";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdmin();
  // 404, not 403. Don't confirm the page exists to someone who shouldn't
  // be here.
  if (!user) notFound();

  const { week, rows } = await weeklyActivity();

  const admin = createAdminClient();
  const { data: verified } = await admin
    .from("wallets")
    .select("address, verified_at, verify_tx_sig, profiles(display_name, gender, city)")
    .eq("state", "verified")
    .order("verified_at", { ascending: false });

  const { data: balances } = await admin
    .from("wallet_balances")
    .select("address, sol_balance");
  const balanceOf = new Map(
    (balances ?? []).map((b) => [b.address, b.sol_balance])
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "36px 24px 80px",
        fontFamily: font,
        background: "#fff",
        maxWidth: 1000,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontWeight: 900, fontSize: 27, color: INK, margin: 0 }}>
        Admin
      </h1>
      <p style={{ color: MUTE, fontSize: 13.5, marginTop: 4 }}>
        Week of {week}
      </p>

      {/* ---------------- payouts ---------------- */}
      <H2>Weekly payouts</H2>
      <p style={{ color: MUTE, fontSize: 13, lineHeight: 1.5, maxWidth: 620 }}>
        Sorted by activity. Send the SOL from your wallet by hand, then paste
        the signature to record it. Suggested amounts are scaled against the
        week's top performer and capped at $50 — they're a starting point,
        not an instruction. Open the profile before you send anything.
      </p>

      {rows.length === 0 ? (
        <Empty>No activity yet this week.</Empty>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {[
                  "Name",
                  "Likes",
                  "Like rate",
                  "Sent",
                  "Received",
                  "Matches",
                  "Score",
                  "Suggested",
                  "",
                ].map((h) => (
                  <Th key={h}>{h}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <PayoutRow key={r.userId} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------- verified ---------------- */}
      <H2>Verified wallets</H2>
      <p style={{ color: MUTE, fontSize: 13, maxWidth: 620 }}>
        Everyone who's proven a wallet, newest first.
      </p>

      {!verified?.length ? (
        <Empty>Nobody's verified a wallet yet.</Empty>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Name", "Gender", "City", "Wallet", "Balance", "Verified", "Tx"].map(
                  (h) => (
                    <Th key={h}>{h}</Th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {verified.map((w) => {
                const p = w.profiles as unknown as {
                  display_name: string;
                  gender: string;
                  city: string | null;
                } | null;
                const bal = balanceOf.get(w.address);
                return (
                  <tr key={w.address} style={{ borderTop: "1px solid rgba(11,31,18,.07)" }}>
                    <Td strong>{p?.display_name ?? "—"}</Td>
                    <Td>{p?.gender ?? "—"}</Td>
                    <Td>{p?.city ?? "—"}</Td>
                    <Td mono>
                      {w.address.slice(0, 4)}...{w.address.slice(-4)}
                    </Td>
                    <Td strong>
                      {bal != null ? `${Number(bal).toFixed(2)} SOL` : "—"}
                    </Td>
                    <Td>
                      {w.verified_at
                        ? new Date(w.verified_at).toLocaleDateString()
                        : "—"}
                    </Td>
                    <Td>
                      {w.verify_tx_sig ? (
                        <a
                          href={`https://solscan.io/tx/${w.verify_tx_sig}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: GREEN_DK, fontWeight: 700 }}
                        >
                          view
                        </a>
                      ) : (
                        "—"
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontWeight: 900,
        fontSize: 17,
        color: INK,
        margin: "38px 0 6px",
        paddingTop: 20,
        borderTop: `2px solid ${GREEN}`,
      }}
    >
      {children}
    </h2>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        fontSize: 11,
        fontWeight: 800,
        color: MUTE,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        padding: "8px 10px 8px 0",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  strong,
  mono,
}: {
  children: React.ReactNode;
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      style={{
        padding: "10px 10px 10px 0",
        color: strong ? INK : MUTE,
        fontWeight: strong ? 800 : 500,
        fontFamily: mono ? "monospace" : font,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px dashed rgba(11,31,18,.15)",
        borderRadius: 12,
        padding: 28,
        textAlign: "center",
        color: MUTE,
        fontSize: 13.5,
        marginTop: 14,
      }}
    >
      {children}
    </div>
  );
}
