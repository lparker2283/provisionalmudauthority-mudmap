import MapView from "@/components/MapView";
import { getApprovedPins } from "@/lib/pins";

// Always read fresh: approvals should show up immediately.
export const dynamic = "force-dynamic";

export default async function Home() {
  const pins = await getApprovedPins();
  return (
    <>
      <h1 className="visually-hidden">Construction sites to watch around Rochester, NY</h1>
      <MapView pins={pins} />
    </>
  );
}
