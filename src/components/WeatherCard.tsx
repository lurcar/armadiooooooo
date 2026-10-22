import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CloudRain, CloudSun, Snowflake, Sun, Cloud, Wind, MapPin } from "lucide-react";
import type { Item } from "@/lib/wardrobe";

type Coords = { lat: number; lon: number; label: string };
const FALLBACK: Coords = { lat: 45.4642, lon: 9.19, label: "Milano" };
const KEY = "armadio-coords";

type Weather = {
  temp: number;
  feels: number;
  max: number;
  min: number;
  rainProb: number;
  wind: number;
  code: number;
};

export type JacketAdvice = "none" | "light" | "medium" | "heavy";

export function jacketAdvice(feels: number, min: number): JacketAdvice {
  const t = Math.min(feels, min + 2);
  if (t >= 22) return "none";
  if (t >= 15) return "light";
  if (t >= 8) return "medium";
  return "heavy";
}

const pick = <T,>(arr: T[], seed: number) => arr[seed % arr.length]!;

function phrases(name: string, advice: JacketAdvice, rain: boolean, seed: number) {
  const n = name || "campione";
  const byAdvice: Record<JacketAdvice, string[]> = {
    none: [
      `Oggi niente giubbotto, ${n}: lascia parlare la maglia.`,
      `Fa caldo, ${n}. Giubbotto a casa e stile in prima fila.`,
      `Giornata da maniche corte, ${n}. Il sole ti sta bene.`,
    ],
    light: [
      `Un giubbotto leggero e sei pronto a conquistare la giornata, ${n}.`,
      `Fresco quanto basta, ${n}: strato leggero e via.`,
      `${n}, porta un giubbottino leggero: elegante e mai sudato.`,
    ],
    medium: [
      `Oggi serve un giubbotto vero, ${n}: caldo ma non da montagna.`,
      `${n}, aria frizzante: giubbotto medio e sei imbattibile.`,
      `Strato in più consigliato, ${n}. Stile e comfort insieme.`,
    ],
    heavy: [
      `Fuori si gela, ${n}: giubbotto pesante, sciarpa e sguardo da copertina.`,
      `${n}, oggi vince il piumino. Caldo fuori, stile dentro.`,
      `Freddo serio, ${n}: copriti bene, il fascino resta.`,
    ],
  };
  const extra = rain ? ` Possibile pioggia: meglio qualcosa che non tema l'acqua.` : "";
  return pick(byAdvice[advice], seed) + extra;
}

function suggestJacket(items: Item[], advice: JacketAdvice, seed: number) {
  if (advice === "none") return null;
  const jackets = items.filter((i) => i.category === "giubbotti");
  if (!jackets.length) return null;
  const words: Record<Exclude<JacketAdvice, "none">, string[]> = {
    light: ["legger", "jeans", "denim", "bomber", "giacca", "vento", "windbreaker", "overshirt"],
    medium: ["bomber", "giacca", "pelle", "parka", "trench", "imbottit"],
    heavy: ["piumino", "pesante", "parka", "cappotto", "montone", "imbottit", "puffer"],
  };
  const match = jackets.filter((j) =>
    words[advice].some((w) => `${j.name} ${j.style ?? ""}`.toLowerCase().includes(w)),
  );
  return pick(match.length ? match : jackets, seed);
}

function WeatherIcon({ code, className }: { code: number; className?: string }) {
  if (code >= 71 && code <= 86) return <Snowflake className={className} />;
  if (code >= 51) return <CloudRain className={className} />;
  if (code >= 3) return <Cloud className={className} />;
  if (code >= 1) return <CloudSun className={className} />;
  return <Sun className={className} />;
}

const ADVICE_LABEL: Record<JacketAdvice, string> = {
  none: "Niente giubbotto",
  light: "Giubbotto leggero",
  medium: "Giubbotto medio",
  heavy: "Giubbotto pesante",
};

export function WeatherCard({ name, items }: { name: string; items: Item[] }) {
  const [coords, setCoords] = useState<Coords | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      try {
        setCoords(JSON.parse(saved));
      } catch {
        /* ignore */
      }
    }
    if (!navigator.geolocation) {
      if (!saved) setCoords(FALLBACK);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const c = { lat: p.coords.latitude, lon: p.coords.longitude, label: "La tua zona" };
        localStorage.setItem(KEY, JSON.stringify(c));
        setCoords(c);
      },
      () => {
        if (!saved) setCoords(FALLBACK);
      },
      { timeout: 8000, maximumAge: 30 * 60 * 1000 },
    );
  }, []);

  const { data: place } = useQuery({
    queryKey: ["place", coords?.lat.toFixed(2), coords?.lon.toFixed(2)],
    enabled: !!coords && coords.label !== FALLBACK.label,
    staleTime: Infinity,
    queryFn: async () => {
      const r = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords!.lat}&longitude=${coords!.lon}&localityLanguage=it`,
      );
      if (!r.ok) return null;
      const j = (await r.json()) as { city?: string; locality?: string };
      return j.city || j.locality || null;
    },
  });

  const { data: w, isError } = useQuery({
    queryKey: ["weather", coords?.lat.toFixed(2), coords?.lon.toFixed(2)],
    enabled: !!coords,
    staleTime: 20 * 60 * 1000,
    queryFn: async (): Promise<Weather> => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords!.lat}&longitude=${coords!.lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("meteo");
      const j = await r.json();
      return {
        temp: Math.round(j.current.temperature_2m),
        feels: Math.round(j.current.apparent_temperature),
        code: j.current.weather_code,
        wind: Math.round(j.current.wind_speed_10m),
        max: Math.round(j.daily.temperature_2m_max[0]),
        min: Math.round(j.daily.temperature_2m_min[0]),
        rainProb: j.daily.precipitation_probability_max[0] ?? 0,
      };
    },
  });

  if (isError) return null;
  if (!w) return <div className="mt-5 h-32 animate-pulse rounded-3xl bg-muted md:h-36" />;

  const seed = new Date().getDate() + new Date().getMonth() * 31;
  const advice = jacketAdvice(w.feels, w.min);
  const rain = w.rainProb >= 50;
  const jacket = suggestJacket(items, advice, seed);

  return (
    <section className="mt-5 overflow-hidden rounded-3xl bg-primary p-4 text-primary-foreground md:mt-6 md:p-6">
      <div className="flex flex-wrap items-center gap-4 md:gap-6">
        <div className="flex items-center gap-3 md:gap-4">
          <WeatherIcon code={w.code} className="h-10 w-10 shrink-0 md:h-14 md:w-14" />
          <div>
            <p className="text-4xl font-black leading-none md:text-5xl">{w.temp}°</p>
            <p className="mt-1 flex items-center gap-1 text-xs font-bold opacity-80">
              <MapPin className="h-3 w-3" /> {place ?? coords?.label}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs font-bold md:gap-2">
          <span className="rounded-full bg-primary-foreground/15 px-2.5 py-1 md:px-3">Percepita {w.feels}°</span>
          <span className="rounded-full bg-primary-foreground/15 px-2.5 py-1 md:px-3">Min {w.min}° · Max {w.max}°</span>
          <span className="rounded-full bg-primary-foreground/15 px-2.5 py-1 md:px-3">Pioggia {w.rainProb}%</span>
          <span className="flex items-center gap-1 rounded-full bg-primary-foreground/15 px-2.5 py-1 md:px-3">
            <Wind className="h-3 w-3" /> {w.wind} km/h
          </span>
        </div>
        <span className="ml-auto rounded-full bg-primary-foreground px-3.5 py-1.5 text-xs font-extrabold text-primary md:px-4 md:py-2 md:text-sm">
          {ADVICE_LABEL[advice]}
        </span>
      </div>
      <p className="mt-3 text-base font-bold leading-snug md:mt-4 md:text-lg">{phrases(name, advice, rain, seed)}</p>
      {jacket && <p className="mt-1 text-sm font-semibold opacity-85">Dal tuo armadio: {jacket.name}.</p>}
    </section>
  );
}
