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

export function mergeFacebookManagedPageCapabilities(pages, managedPages) {
  const managedById = new Map(
    (managedPages || []).map((page) => [String(page.providerAccountId), page]),
  );

  return (pages || []).map((page) => {
    const managedPage = managedById.get(String(page.providerAccountId));

    return {
      ...page,
      tasks: Array.isArray(managedPage?.tasks)
        ? [...managedPage.tasks]
        : Array.isArray(page.tasks)
          ? [...page.tasks]
          : [],
    };
  });
}

export function annotateFacebookPagesWithPermissions(pages, tokenDetails) {
  return (pages || []).map((page) => {
    const permissions = getFacebookPagePermissions(
      tokenDetails,
      page.providerAccountId,
    );
    const tasks = new Set(Array.isArray(page.tasks) ? page.tasks : []);

    if (canFacebookPagePublish(permissions)) {
      tasks.add("CREATE_CONTENT");
    }

    return {
      ...page,
      permissions,
      tasks: [...tasks],
    };
  });
}
