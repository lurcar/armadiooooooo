import type { Item } from "@/lib/wardrobe";
import { cn } from "@/lib/utils";

/**
 * Flat-lay of an outfit, top to bottom in dressing order:
 * outer layer (giubbotto / felpa) → maglia → pantaloni → scarpe, accessories on the side.
 * Each row has a fixed share of the height so shoes stay small next to clothes.
 */
const ROWS: { key: string; cats: Item["category"][]; weight: number; maxW: string }[] = [
  { key: "outer", cats: ["giubbotti", "felpe"], weight: 30, maxW: "max-w-[85%]" },
  { key: "top", cats: ["maglie"], weight: 27, maxW: "max-w-[75%]" },
  { key: "bottom", cats: ["pantaloni"], weight: 33, maxW: "max-w-[70%]" },
  { key: "shoes", cats: ["scarpe"], weight: 14, maxW: "max-w-[45%]" },
];

export function OutfitBoard({
  items,
  urls,
  onRemove,
  className,
  compact,
}: {
  items: Item[];
  urls: Record<string, string> | undefined;
  onRemove?: (id: string) => void;
  className?: string;
  compact?: boolean;
}) {
  const acc = items.filter((i) => i.category === "accessori");
  const rows = ROWS.map((r) => ({ ...r, items: items.filter((i) => r.cats.includes(i.category)) })).filter(
    (r) => r.items.length > 0,
  );

  const Tile = ({ item, maxW }: { item: Item; maxW: string }) => (
    <div className="group relative flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden">
      {urls?.[item.image_path] ? (
        <img
          src={urls[item.image_path]}
          alt={item.name}
          className={cn("max-h-full max-w-full object-contain drop-shadow-md", maxW)}
          loading="lazy"
        />
      ) : (
        <div className="h-full w-2/3 rounded-xl bg-muted" />
      )}
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs text-background group-hover:flex"
          aria-label={`Rimuovi ${item.name}`}
        >
          ✕
        </button>
      )}
    </div>
  );

  if (items.length === 0) {
    return (
      <div className={cn(
        "flex items-center justify-center rounded-2xl bg-surface p-4 text-center text-sm font-semibold text-surface-foreground/60 md:rounded-3xl md:p-6",
        compact ? "aspect-square md:aspect-[4/5]" : "aspect-[4/5]",
        className,
      )}>
        Scegli i capi dal guardaroba per comporre l'outfit
      </div>
    );
  }

  return (
    <div className={cn(
      "flex w-full max-w-full min-w-0 overflow-hidden gap-1.5 rounded-2xl bg-surface md:gap-2 md:rounded-3xl",
      compact ? "aspect-square p-2 md:aspect-[4/5] md:p-3" : "aspect-[4/5] gap-2 p-5",
      className,
    )}>
      <div className="flex min-h-0 min-w-0 flex-[4] flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r.key} className="flex min-h-0 justify-center gap-2" style={{ flex: `${r.weight} 1 0%` }}>
            {r.items.map((i) => (
              <Tile key={i.id} item={i} maxW={r.items.length > 1 ? "max-w-full" : r.maxW} />
            ))}
          </div>
        ))}
      </div>
      {acc.length > 0 && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-3">
          {acc.slice(0, 4).map((i) => (
            <div key={i.id} className="flex h-[18%] min-h-0">
              <Tile item={i} maxW="max-w-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
