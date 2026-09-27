import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="page">
      <span className="form-no">Form PMA-310 · Statement of Purpose</span>
      <h1>
        <span className="crayon">About this map</span>
      </h1>

      <p>
        This is a free map of active construction sites around Rochester, New York, kept for families with
        small children who would like somewhere to go and watch the machines. It is especially meant for
        winter, when the playgrounds are under snow and the excavators are not.
      </p>

      <p>
        It was made by a local parent. There is nothing for sale here, no accounts, no newsletter and no
        tracking beyond a simple count of page visits. It is a gift to the city’s smallest sidewalk
        superintendents and the grown-ups who drive them around.
      </p>

      <h2>How it works</h2>
      <p>
        Anyone can <Link href="/add">add a site</Link>. A person reviews each one before it appears. Every
        pin shows the date someone last confirmed it; construction ends, so pins that haven’t been confirmed
        in 60 days fade on the map.
      </p>
      <p>
        If a site has finished, or a viewing spot turns out to be unsafe, use “Report this pin” on its card and
        it will be looked at.
      </p>

      <h2>A word on safety</h2>
      <p>
        Please watch from sidewalks, parking lots and other public places, never inside a fence or a work
        zone, and keep small hands held near traffic. Crews are working; give them room.
      </p>

      <h2>How to help</h2>
      <p>
        Add the sites you know. Report the ones that have finished. Tell another parent. The register is only as good
        as the people who keep it.
      </p>

      <p className="form-no" style={{ marginTop: 32 }}>
        The Provisional Mud Authority is provisional. The diggers are not.
      </p>
    </div>
  );
}
