"use client";

import { useState, type ImgHTMLAttributes, type ReactNode } from "react";

type WrapperTag = "div" | "figure";

type ExternalImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  wrapperAs?: WrapperTag;
  wrapperClassName?: string;
  fallback?: ReactNode;
};

export function ExternalImage({
  src,
  alt,
  wrapperAs = "div",
  wrapperClassName,
  fallback = null,
  onError,
  referrerPolicy,
  decoding,
  ...props
}: ExternalImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return <>{fallback}</>;

  const image = (
    <img
      {...props}
      src={src}
      alt={alt}
      decoding={decoding ?? "async"}
      referrerPolicy={referrerPolicy ?? "no-referrer"}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );

  if (!wrapperClassName) return image;

  if (wrapperAs === "figure") {
    return <figure className={wrapperClassName}>{image}</figure>;
  }

  return <div className={wrapperClassName}>{image}</div>;
}
