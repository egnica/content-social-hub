export const FACEBOOK_REQUIRED_PERMISSIONS = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
];

const FACEBOOK_PAGE_PERMISSION_SET = new Set(FACEBOOK_REQUIRED_PERMISSIONS);

function normalizedGranularScopes(tokenDetails) {
  return Array.isArray(tokenDetails?.granularScopes)
    ? tokenDetails.granularScopes
    : [];
}

export function getFacebookPageTargetIds(tokenDetails) {
  return [
    ...new Set(
      normalizedGranularScopes(tokenDetails)
        .filter((item) => FACEBOOK_PAGE_PERMISSION_SET.has(item.scope))
        .flatMap((item) => item.targetIds || [])
        .map(String),
    ),
  ];
}

export function getFacebookPagePermissions(tokenDetails, pageId) {
  const normalizedPageId = String(pageId);
  const granularScopes = normalizedGranularScopes(tokenDetails);
  const tokenScopes = new Set(tokenDetails?.scopes || []);

  return FACEBOOK_REQUIRED_PERMISSIONS.filter((permission) => {
    const granularEntries = granularScopes.filter(
      (item) => item.scope === permission,
    );

    if (granularEntries.length) {
      return granularEntries.some((item) =>
        (item.targetIds || []).map(String).includes(normalizedPageId),
      );
    }

    return tokenScopes.has(permission);
  });
}

export function canFacebookPagePublish(permissions) {
  return (permissions || []).includes("pages_manage_posts");
}

export function annotateFacebookPagesWithPermissions(pages, tokenDetails) {
  return (pages || []).map((page) => {
    const permissions = getFacebookPagePermissions(
      tokenDetails,
      page.providerAccountId,
    );

    return {
      ...page,
      permissions,
      tasks: canFacebookPagePublish(permissions) ? ["CREATE_CONTENT"] : [],
    };
  });
}
