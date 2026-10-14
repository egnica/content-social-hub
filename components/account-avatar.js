"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "@/components/ui.module.css";

export default function AccountAvatar({ connection, small = false }) {
  const [failedSource, setFailedSource] = useState(null);
  const source = ["facebook", "instagram"].includes(connection.platform)
    ? `/api/connections/${encodeURIComponent(connection._id)}/avatar?clientId=${encodeURIComponent(connection.clientId)}&v=${encodeURIComponent(connection.updatedAt || connection.lastHealthCheckAt || "")}`
    : connection.pictureUrl || "";
  const initials = String(connection.accountName || "Account").replace(/^@/, "")
    .trim().split(/[\s_]+/).slice(0, 2).map(word => word[0]).join("").toUpperCase() || "?";
  const size = small ? 28 : 44;
  return (
    <span className={`${styles.connectionAvatar} ${small ? styles.connectionAvatarSmall : ""}`} aria-hidden="true">
      {source && failedSource !== source ? (
        <Image src={source} alt="" width={size} height={size} unoptimized
          referrerPolicy="no-referrer" onError={() => setFailedSource(source)} />
      ) : initials}
    </span>
  );
}
