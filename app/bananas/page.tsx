import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { weeklyActivity } from "@/lib/activity";
import { allUsers } from "@/lib/allUsers";
import { GREEN, GREEN_DK, INK, MUTE, font } from "@/lib/theme";
import PayoutRow from "./PayoutRow";
import CopyAddr from "./CopyAddr";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdmin();
  // 404, not 403. Don't confirm the page exists to someone who shouldn't
  // be here.
  if (!user) notFound();

  const { week, rows } = await weeklyActivity();
  const users = await allUsers();

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

  // Open reports, newest first, with both names resolved.
  const { data: reports } = await admin
    .from("reports")
    .select(
      "id, reason, status, created_at, reporter:reporter_id(display_name), reported:reported_id(display_name, id)"
    )
    .eq("status", "open")
    .order("created_at", { ascending: false });

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
      {/* ---------------- reports ---------------- */}
      <H2>Reports</H2>
      <p style={{ color: MUTE, fontSize: 13, maxWidth: 620 }}>
        Open reports, newest first. The reporter has already stopped seeing
        this person — this is for you to decide whether to act further.
      </p>

      {!reports?.length ? (
        <Empty>No open reports. Good.</Empty>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Reported", "By", "Reason", "When"].map((h) => (
                  <Th key={h}>{h}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const reported = r.reported as unknown as {
                  display_name: string;
                  id: string;
                } | null;
                const reporter = r.reporter as unknown as {
                  display_name: string;
                } | null;
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid rgba(11,31,18,.07)" }}>
                    <Td strong>{reported?.display_name ?? "—"}</Td>
                    <Td>{reporter?.display_name ?? "—"}</Td>
                    <Td>{r.reason || <span style={{ color: MUTE }}>no reason given</span>}</Td>
                    <Td>{new Date(r.created_at).toLocaleDateString()}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <H2>All users ({users.length})</H2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, whiteSpace: "nowrap" }}>
          <thead>
            <tr style={{ textAlign: "left", color: MUTE, borderBottom: "1px solid rgba(11,31,18,.1)" }}>
              <th style={th}>Name</th>
              <th style={th}>Gender</th>
              <th style={th}>Age</th>
              <th style={th}>City</th>
              <th style={th}>Joined</th>
              <th style={th}>Face</th>
              <th style={th}>Wallet</th>
              <th style={th}>SOL</th>
              <th style={th}>Wallet (click to copy)</th>
              <th style={th}>Photos</th>
              <th style={th}>Likes given</th>
              <th style={th}>Likes recv</th>
              <th style={th}>Matches</th>
              <th style={th}>Msgs</th>
              <th style={th}>Score</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid rgba(11,31,18,.05)" }}>
                <td style={{ ...td, fontWeight: 700 }}>
                  {u.name}
                  {!u.onboarded && <span style={{ color: MUTE, fontWeight: 500 }}> (incomplete)</span>}
                </td>
                <td style={td}>{u.gender ?? "—"}</td>
                <td style={td}>{u.age ?? "—"}</td>
                <td style={td}>{u.city ?? "—"}</td>
                <td style={td}>{u.joined ? new Date(u.joined).toLocaleDateString() : "—"}</td>
                <td style={td}>{u.faceVerified ? "✓" : "—"}</td>
                <td style={td}>{u.walletVerified ? "✓" : "—"}</td>
                <td style={td}>{u.sol != null ? u.sol.toFixed(2) : "—"}</td>
                <td style={td}><CopyAddr address={u.walletAddress} /></td>
                <td style={td}>{u.photos}</td>
                <td style={td}>{u.likesGiven}</td>
                <td style={td}>{u.likesReceived}</td>
                <td style={td}>{u.matches}</td>
                <td style={td}>{u.messagesSent}</td>
                <td style={{ ...td, fontWeight: 900, color: GREEN_DK }}>{u.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 700 };
const td: React.CSSProperties = { padding: "8px 10px", color: INK };

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
