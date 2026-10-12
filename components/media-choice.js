/* eslint-disable @next/next/no-img-element */
import styles from "@/components/ui.module.css";

export function MediaThumbnail({ asset }) {
  const src =
    asset?.previewUrl || (asset?._id ? `/api/media/${asset._id}/url` : "");
  return (
    <span className={styles.mediaChoicePreview}>
      {src ? (
        asset.contentType?.startsWith("video/") ? (
          <video
            src={src}
            muted
            preload="metadata"
            aria-label={asset.originalName || "Video"}
          />
        ) : (
          <img src={src} alt="" loading="lazy" />
        )
      ) : (
        <span>Media</span>
      )}
      {asset?.contentType?.startsWith("video/") ? (
        <span className={styles.videoBadge}>Video</span>
      ) : null}
    </span>
  );
}

export default function MediaChoice({
  asset,
  selected,
  disabled,
  onSelect,
  badge = "Main",
}) {
  return (
    <button
      className={styles.mediaChoice}
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
    >
      <MediaThumbnail asset={asset} />
      <span className={styles.mediaChoiceName}>
        {asset.originalName || "Media"}
      </span>
      <span className={styles.fieldHint}>
        {selected ? badge : "Choose media"}
      </span>
    </button>
  );
}
