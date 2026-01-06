"use client";

import React from "react";

function Embed() {
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.Frill !== "function") {
      return;
    }
    window.Frill("widget", {
      key: process.env.NEXT_PUBLIC_FRILL_WIDGET_KEY || "",
    });
  }, []);

  return (
    <div>
      <div
        data-frill-widget={process.env.NEXT_PUBLIC_FRILL_WIDGET_KEY}
        style={{ width: "340px", height: "460px" }}
      ></div>
    </div>
  );
}

export default Embed;
