import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { REPORT_REASONS, formatDate, isStale, joinNotes, type ReportReason } from "@/lib/constants";
import { db, photoUrl } from "@/lib/supabase";
import type { Pin, Report } from "@/lib/types";
import AdminAddForm from "./AdminAddForm";
import LoginForm from "./LoginForm";
import {
  approvePin,
  confirmPin,
  dismissReports,
  logout,
  rejectPin,
  removePin,
} from "./actions";

export const metadata: Metadata = { title: "Office of the Registrar", robots: { index: false } };
export const dynamic = "force-dynamic";

const VIEWS = ["queue", "reports", "add", "all"] as const;
type View = (typeof VIEWS)[number];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (!(await isAdmin())) {
    return (
      <div className="page">
        <span className="form-no">Restricted · Office of the Registrar</span>
        <h1>Admin</h1>
        <LoginForm />
      </div>
    );
  }

  const { view: rawView } = await searchParams;
  const view: View = VIEWS.includes(rawView as View) ? (rawView as View) : "queue";

  const [pendingRes, openReportsRes] = await Promise.all([
    db().from("pins").select("*").eq("status", "pending").order("created_at", { ascending: true }),
    db().from("reports").select("*").eq("status", "open").order("created_at", { ascending: true }),
  ]);
  const pending = (pendingRes.data ?? []) as Pin[];
  const openReports = (openReportsRes.data ?? []) as Report[];
  const reportedIds = [...new Set(openReports.map((r) => r.pin_id))];

  return (
    <div className="page admin">
      <span className="form-no">Office of the Registrar</span>
      <h1>Moderation</h1>

      <nav className="tab-row" aria-label="Admin sections">
        <Tab href="/admin" active={view === "queue"}>Queue ({pending.length})</Tab>
        <Tab href="/admin?view=reports" active={view === "reports"}>Reported ({reportedIds.length})</Tab>
        <Tab href="/admin?view=add" active={view === "add"}>Add sites</Tab>
        <Tab href="/admin?view=all" active={view === "all"}>All live pins</Tab>
        <form action={logout}>
          <button type="submit" className="btn btn-quiet btn-small">Sign out</button>
        </form>
      </nav>

      {view === "queue" && <Queue pins={pending} />}
      {view === "reports" && <Reported ids={reportedIds} reports={openReports} />}
      {view === "add" && (
        <section className="admin-section">
          <h2>Add sites directly</h2>
          <p className="field-hint">
            For scouted sites. These skip the queue and go live straight away. For a large batch, see the seed
            script in the README.
          </p>
          <AdminAddForm />
        </section>
      )}
      {view === "all" && <AllPins />}
    </div>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`btn btn-small ${active ? "" : "btn-quiet"}`} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}

function PinSummary({ pin }: { pin: Pin }) {
  const url = photoUrl(pin.photo_path);
  const osm = `https://www.openstreetmap.org/?mlat=${pin.lat}&mlon=${pin.lng}#map=17/${pin.lat}/${pin.lng}`;
  return (
    <>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Submitted photo" />
        </a>
      ) : (
        <div className="no-photo">No photo</div>
      )}
      <div>
        <h3 style={{ marginBottom: 4 }}>{pin.name ?? "Unnamed site"}</h3>
        <p style={{ margin: "0 0 6px" }}>{pin.description}</p>
        <dl className="pin-facts" style={{ margin: 0 }}>
          {pin.equipment && (<><dt>Equipment</dt><dd>{pin.equipment}</dd></>)}
          <dt>Safe place to stand</dt>
          <dd>{pin.safe_parking ? "Yes" : "No / not sure"}</dd>
          {(pin.viewing_spot || pin.parking_note) && (
            <><dt>Where to park and watch</dt><dd>{joinNotes(pin.viewing_spot, pin.parking_note)}</dd></>
          )}
        </dl>
        <p className="admin-meta" style={{ marginTop: 8 }}>
          Filed {formatDate(pin.created_at)} · Last confirmed {formatDate(pin.last_confirmed_at)}
          {pin.status === "approved" && isStale(pin.last_confirmed_at) ? " · faded on map" : ""} ·{" "}
          <a href={osm} target="_blank" rel="noopener noreferrer">view location</a>
        </p>
      </div>
    </>
  );
}

function Queue({ pins }: { pins: Pin[] }) {
  if (pins.length === 0) return <p className="notice">The queue is empty. Nothing awaits the Registrar.</p>;
  return (
    <section className="admin-section">
      <p className="field-hint">Check the photo shows no people. Rejecting deletes the submission and its photo.</p>
      {pins.map((pin) => (
        <article key={pin.id} className="admin-item">
          <PinSummary pin={pin} />
          <div className="admin-actions" style={{ gridColumn: "1 / -1" }}>
            <form action={approvePin.bind(null, pin.id)}>
              <button type="submit" className="btn btn-primary">Approve</button>
            </form>
            <form action={rejectPin.bind(null, pin.id)}>
              <button type="submit" className="btn">Reject</button>
            </form>
          </div>
        </article>
      ))}
    </section>
  );
}

async function Reported({ ids, reports }: { ids: string[]; reports: Report[] }) {
  if (ids.length === 0) return <p className="notice">No open reports.</p>;
  const { data } = await db().from("pins").select("*").in("id", ids);
  const pins = (data ?? []) as Pin[];
  return (
    <section className="admin-section">
      {pins.map((pin) => (
        <article key={pin.id} className="admin-item">
          <PinSummary pin={pin} />
          <div style={{ gridColumn: "1 / -1" }}>
            <h3>Reports</h3>
            <ul className="report-list">
              {reports
                .filter((r) => r.pin_id === pin.id)
                .map((r) => (
                  <li key={r.id}>
                    <strong>{REPORT_REASONS[r.reason as ReportReason] ?? r.reason}</strong>
                    {r.note ? `: ${r.note}` : ""} <span className="admin-meta">({formatDate(r.created_at)})</span>
                  </li>
                ))}
            </ul>
            <div className="admin-actions">
              <form action={dismissReports.bind(null, pin.id)}>
                <button type="submit" className="btn">Dismiss report</button>
              </form>
              <form action={confirmPin.bind(null, pin.id)}>
                <button type="submit" className="btn">Still active: refresh date</button>
              </form>
              <form action={removePin.bind(null, pin.id)}>
                <button type="submit" className="btn">Remove pin</button>
              </form>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

async function AllPins() {
  const { data } = await db()
    .from("pins")
    .select("*")
    .eq("status", "approved")
    .order("last_confirmed_at", { ascending: true });
  const pins = (data ?? []) as Pin[];
  if (pins.length === 0) return <p className="notice">No live pins yet.</p>;
  return (
    <section className="admin-section">
      <p className="field-hint">Oldest confirmation first. Refresh a date when you’ve seen a site is still active.</p>
      {pins.map((pin) => (
        <article key={pin.id} className="admin-item">
          <PinSummary pin={pin} />
          <div className="admin-actions" style={{ gridColumn: "1 / -1" }}>
            <form action={confirmPin.bind(null, pin.id)}>
              <button type="submit" className="btn">Still active: refresh date</button>
            </form>
            <form action={removePin.bind(null, pin.id)}>
              <button type="submit" className="btn">Remove pin</button>
            </form>
          </div>
        </article>
      ))}
    </section>
  );
}
