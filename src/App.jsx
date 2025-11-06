import React, { useEffect, useMemo, useRef, useState } from "react";

const SHEETS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS9WM5BOiUeFg76DdRyjyje1IS5ECvL3zU1C0Hz0yvTfb3K1a1hQdbwnqjllezBoRB34tyRJM7vqyHU/pub?output=csv";

const CSV_VALUE_INDEX = 0;
const FIXED_APY = 0.04;
const COINGECKO_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd";

function useCountUp(target, durationMs = 800) {
  const [value, setValue] = useState(0);
  const startRef = useRef(null);
  const fromRef = useRef(0);
  const toRef = useRef(target);

  useEffect(() => {
    fromRef.current = value;
    toRef.current = target;
    startRef.current = performance.now();
    let rafId;
    const step = (ts) => {
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next =
        fromRef.current + (toRef.current - fromRef.current) * eased;
      setValue(next);
      if (t < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target]);

  return value;
}

function Stat({ label, value, sub, monospace = false }) {
  return (
    <div className="rounded-2xl p-5 bg-zinc-900/60 border border-zinc-800 shadow-sm backdrop-blur">
      <div className="text-zinc-400 text-sm tracking-wide">{label}</div>
      <div
        className={`mt-1 text-3xl md:text-4xl font-semibold ${
          monospace ? "tabular-nums" : ""
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-zinc-400 text-sm">{sub}</div>}
    </div>
  );
}

export default function App() {
  const [poolXrpRaw, setPoolXrpRaw] = useState(null);
  const [sheetError, setSheetError] = useState("");
  const [xrpUsd, setXrpUsd] = useState(null);
  const [priceErr, setPriceErr] = useState("");

  // 🔁 Fetch CSV from Google Sheets every 60 seconds
  useEffect(() => {
    const fetchCsv = async () => {
      try {
        const res = await fetch(SHEETS_CSV_URL + "&t=" + Date.now(), {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Sheet HTTP ${res.status}`);
        const text = await res.text();
        console.log("CSV response:", text); // 👀 See what’s coming from Google Sheets

        // Split rows and columns
        const rows = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const firstLine = rows[0] || "";
        const cols = firstLine.split(",");

        // Grab the first numeric value (in A1)
        const cell = (cols[CSV_VALUE_INDEX] || "").replace(/[^0-9.\-]/g, "");
        const num = Number(cell);

        if (!Number.isFinite(num))
          throw new Error("Could not parse a numeric XRP amount.");

        setPoolXrpRaw(num);
        setSheetError("");
      } catch (e) {
        console.error("Sheet error:", e);
        setSheetError(e.message || "Failed to load sheet.");
        setPoolXrpRaw(null);
      }
    };

    fetchCsv();
    const id = setInterval(fetchCsv, 60_000); // refresh every minute
    return () => clearInterval(id);
  }, []);

  // 💵 Fetch XRP→USD live price
  useEffect(() => {
    const getPrice = async () => {
      try {
        const res = await fetch(COINGECKO_PRICE_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`Price HTTP ${res.status}`);
        const data = await res.json();
        const usd = data?.ripple?.usd;
        if (!usd) throw new Error("No USD price returned.");
        setXrpUsd(Number(usd));
        setPriceErr("");
      } catch (e) {
        console.error("Price error:", e);
        setPriceErr(e.message || "Failed to load price.");
        setXrpUsd(null);
      }
    };

    getPrice();
    const id = setInterval(getPrice, 60_000); // refresh price every minute
    return () => clearInterval(id);
  }, []);

  // 🧮 Derived calculations
  const annualYieldXrp = useMemo(
    () => (poolXrpRaw ? poolXrpRaw * FIXED_APY : 0),
    [poolXrpRaw]
  );
  const monthlyYieldXrp = useMemo(
    () => annualYieldXrp / 12,
    [annualYieldXrp]
  );
  const animatedPool = useCountUp(poolXrpRaw || 0);
  const animatedYear = useCountUp(annualYieldXrp || 0);
  const animatedMonth = useCountUp(monthlyYieldXrp || 0);
  const poolUsd = useMemo(
    () => (xrpUsd && poolXrpRaw ? poolXrpRaw * xrpUsd : null),
    [xrpUsd, poolXrpRaw]
  );
  const yearUsd = useMemo(
    () => (xrpUsd ? annualYieldXrp * xrpUsd : null),
    [xrpUsd, annualYieldXrp]
  );

  const fmt = (n, max = 2) =>
    n == null
      ? "—"
      : n >= 1000
      ? n.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : n.toLocaleString(undefined, { maximumFractionDigits: max });

  // 🖥️ Render
  return (
    <div className="min-h-screen bg-black text-zinc-100 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]">
        <div
          className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full blur-3xl opacity-30"
          style={{
            background: "radial-gradient(closest-side, #facc15, transparent)",
          }}
        />
        <div
          className="absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-20"
          style={{
            background: "radial-gradient(closest-side, #f59e0b, transparent)",
          }}
        />
      </div>

      <div className="max-w-5xl mx-auto px-5 py-10 md:py-16">
        <header className="mb-8 md:mb-12">
          <div className="inline-flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 border border-yellow-500/40 shadow-[0_0_80px_rgba(250,204,21,.25)] grid place-items-center">
              <span className="text-xl font-bold">LL</span>
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
                Liquid Legacy Pool
              </h1>
              <p className="text-zinc-400 text-sm md:text-base">
                Live pool tracker · Fixed 4% XRP APY
              </p>
            </div>
          </div>
        </header>

        {(sheetError || priceErr) && (
          <div className="mb-6 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-xl p-3">
            {sheetError && <div>Sheet: {sheetError}</div>}
            {priceErr && <div>Price: {priceErr}</div>}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <Stat
            label="Total Pool (XRP)"
            monospace
            value={
              <span className="text-yellow-400">
                {fmt(animatedPool, 2)} XRP
              </span>
            }
            sub={
              poolUsd != null
                ? `≈ $${fmt(poolUsd, 0)} USD`
                : "USD live price loading..."
            }
          />
          <Stat
            label="APY (fixed)"
            value={<span className="text-yellow-300">4.00%</span>}
            sub="Simple (non-compounding)"
          />
          <Stat
            label="Est. Annual Yield"
            monospace
            value={
              <span className="text-yellow-400">
                {fmt(animatedYear, 2)} XRP / yr
              </span>
            }
            sub={
              yearUsd != null
                ? `≈ $${fmt(yearUsd, 0)} USD / yr`
                : "USD live price loading..."
            }
          />
          <Stat
            label="Est. Monthly Yield"
            monospace
            value={
              <span className="text-yellow-400">
                {fmt(animatedMonth, 2)} XRP / mo
              </span>
            }
            sub="Annual ÷ 12"
          />
        </section>

        <div className="mt-8 text-xs text-zinc-500">
          * 4% APY simple calculation. For compounding: XRP × (1 + 0.04/12)^(12×years) − XRP.
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={SHEETS_CSV_URL}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl border border-yellow-500/40 bg-yellow-500/10 hover:bg-yellow-500/20 transition"
          >
            View Sheet Source
          </a>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 transition"
          >
            Refresh
          </button>
        </div>

        <div className="mt-12 md:mt-16 grid place-items-center">
          <div className="relative">
            <div className="h-28 w-28 rounded-full border-2 border-yellow-500/50 shadow-[0_0_80px_rgba(250,204,21,.25)]" />
            <div className="absolute inset-0 animate-pulse rounded-full border border-yellow-400/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
