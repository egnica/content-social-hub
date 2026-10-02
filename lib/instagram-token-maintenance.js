const DAY_MS = 24 * 60 * 60 * 1000;
export const INSTAGRAM_RENEWAL_WINDOW_MS = 7 * DAY_MS;
export const INSTAGRAM_RENEWAL_RETRY_MS = 60 * 60 * 1000;

function time(value) {
  return value ? new Date(value).getTime() : NaN;
}

export function shouldRenewInstagramToken(connection, now = new Date()) {
  const expiry = time(connection?.tokenExpiresAt);
  const issued = time(
    connection?.tokenRenewedAt ||
      connection?.tokenIssuedAt ||
      connection?.createdAt,
  );
  const attempted = time(connection?.tokenRefreshAttemptAt);
  return (
    connection?.platform === "instagram" &&
    expiry > now.getTime() &&
    expiry <= now.getTime() + INSTAGRAM_RENEWAL_WINDOW_MS &&
    Number.isFinite(issued) &&
    issued <= now.getTime() - DAY_MS &&
    (!Number.isFinite(attempted) ||
      attempted <= now.getTime() - INSTAGRAM_RENEWAL_RETRY_MS)
  );
}

// Dependency injection keeps the credential/CAS path testable without real secrets or Meta calls.
export async function renewInstagramConnection({
  connections,
  connection,
  now = new Date(),
  refreshToken,
  getProfile,
  decrypt,
  encrypt,
}) {
  if (!shouldRenewInstagramToken(connection, now))
    return { connection, profile: null };

  const filter = {
    _id: connection._id,
    tokenEncrypted: connection.tokenEncrypted,
  };
  const claimed = await connections.findOneAndUpdate(
    {
      ...filter,
      $or: [
        { tokenRefreshAttemptAt: null },
        {
          tokenRefreshAttemptAt: {
            $lte: new Date(now.getTime() - INSTAGRAM_RENEWAL_RETRY_MS),
          },
        },
      ],
    },
    { $set: { tokenRefreshAttemptAt: now } },
    { returnDocument: "after" },
  );
  if (!claimed)
    return {
      connection: await connections.findOne({ _id: connection._id }),
      profile: null,
    };

  try {
    const refreshed = await refreshToken(decrypt(claimed.tokenEncrypted));
    const expiresAt = new Date(refreshed.expiresAt);
    if (
      !refreshed.accessToken ||
      !Number.isFinite(expiresAt.getTime()) ||
      expiresAt <= now
    ) {
      throw new TypeError("Instagram returned an invalid renewal result.");
    }
    const profile = await getProfile(refreshed.accessToken);
    if (profile.providerAccountId !== claimed.providerAccountId) {
      throw new TypeError("Instagram renewal did not match the saved account.");
    }
    const updated = await connections.findOneAndUpdate(
      { ...filter, tokenRefreshAttemptAt: now },
      {
        $set: {
          tokenEncrypted: encrypt(refreshed.accessToken),
          tokenExpiresAt: expiresAt,
          tokenRenewedAt: now,
          tokenRefreshErrorAt: null,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );
    return updated
      ? { connection: updated, profile }
      : {
          connection: await connections.findOne({ _id: connection._id }),
          profile: null,
        };
  } catch (error) {
    await connections.updateOne(
      { ...filter, tokenRefreshAttemptAt: now },
      {
        $set: { tokenRefreshErrorAt: now },
      },
    );
    throw error;
  }
}
