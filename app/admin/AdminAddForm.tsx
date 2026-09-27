"use client";

import { useState } from "react";
import SiteForm from "@/components/SiteForm";
import { adminAddPin, adminRequestUpload } from "./actions";

export default function AdminAddForm() {
  const [added, setAdded] = useState(0);
  return (
    <>
      {added > 0 && (
        <p className="notice" role="status">
          {added} {added === 1 ? "site" : "sites"} added this session. They are live on the map now.
        </p>
      )}
      <SiteForm
        mode="admin"
        submitAction={adminAddPin}
        uploadAction={adminRequestUpload}
        onSubmitted={() => setAdded((n) => n + 1)}
      />
    </>
  );
}
