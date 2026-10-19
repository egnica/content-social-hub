export const CONNECTION_REQUEST_PLATFORM_LABELS = {
  facebook: "Facebook Pages",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  google_business_profile: "Google Business Profile",
};

export function labelRequestPlatform(platform) {
  return CONNECTION_REQUEST_PLATFORM_LABELS[platform] || "Social account";
}

export function makeConnectionRequestNotification({ platform, email = "", error = null }) {
  const platformName = labelRequestPlatform(platform);
  if (error !== null) {
    return {
      type: "error",
      title: "Connection request failed",
      message: `${platformName}: ${error || "Unable to send this request."}`,
      detail: "Check connection request history before trying again.",
    };
  }
  return {
    type: "success",
    title: "Connection request sent!",
    message: `${platformName} setup email sent to ${email}.`,
    detail: "The secure link expires in 48 hours.",
  };
}
