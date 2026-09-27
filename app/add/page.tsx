import type { Metadata } from "next";
import SiteForm from "@/components/SiteForm";
import { requestPhotoUpload, submitPin } from "@/app/actions";

export const metadata: Metadata = { title: "Add a site" };

export default function AddPage() {
  return (
    <div className="page">
      <span className="form-no">Form PMA-312 · Notice of Excavation</span>
      <h1>
        <span className="crayon">Add a site</span>
      </h1>
      <p>
        Found somewhere good to watch the diggers? File it here. Every submission is checked by a person before
        it goes on the map.
      </p>
      <SiteForm mode="public" submitAction={submitPin} uploadAction={requestPhotoUpload} />
    </div>
  );
}
