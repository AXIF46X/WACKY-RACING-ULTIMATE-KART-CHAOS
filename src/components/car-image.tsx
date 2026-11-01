"use client";

import { useEffect, useState } from "react";
import { carThumb, rarityBackdrop, type ThumbOpts } from "@/game/thumbs";
import { Car } from "lucide-react";

/**
 * A rendered "photo" of a car. Generates the thumbnail from the real 3D model
 * on first paint (cached module-side), so grids stay cheap.
 */
export default function CarImage({
  vehId,
  className = "",
  paint,
  wheels,
  withDriver,
  charId,
  hat,
  backdrop = true,
}: { vehId: string; className?: string; backdrop?: boolean } & ThumbOpts) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // defer a frame so a big grid doesn't block first paint
    const id = requestAnimationFrame(() => {
      const url = carThumb(vehId, { paint, wheels, withDriver, charId, hat });
      if (alive) setSrc(url);
    });
    return () => { alive = false; cancelAnimationFrame(id); };
  }, [vehId, paint, wheels, withDriver, charId, hat]);

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={backdrop ? { background: rarityBackdrop(vehId) } : undefined}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-contain" draggable={false} />
      ) : (
        <Car size={34} className="animate-pulse text-[#16181d]/35" />
      )}
    </div>
  );
}
