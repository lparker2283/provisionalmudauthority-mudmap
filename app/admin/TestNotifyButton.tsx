"use client";

import { useActionState } from "react";
import { testNotification } from "./actions";

export default function TestNotifyButton() {
  const [message, action, pending] = useActionState(testNotification, null);
  return (
    <form action={action} className="notify-test">
      <button type="submit" className="btn btn-quiet btn-small" disabled={pending}>
        {pending ? "Sending…" : "Send test notification"}
      </button>
      {message && <p className="field-hint" role="status" style={{ margin: "6px 0 0" }}>{message}</p>}
    </form>
  );
}
