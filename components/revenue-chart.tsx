import { formatMoney } from "@/lib/format";
import { shortPeriodLabel } from "@/lib/periods";

interface Props {
  series: { period: string; expected: number; collected: number }[];
  currency: string;
}

/** Histogramme attendu / encaissé en CSS pur : aucune bibliothèque de graphiques à charger. */
export function RevenueChart({ series, currency }: Props) {
  const max = Math.max(1, ...series.map((s) => Number(s.expected)));

  if (series.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">Les encaissements apparaîtront ici dès la première échéance.</p>;
  }

  return (
    <figure>
      <div className="flex h-44 items-end gap-3 sm:gap-5" role="img" aria-label="Loyers attendus et encaissés par mois">
        {series.map((s) => {
          const expected = Number(s.expected);
          const collected = Number(s.collected);
          return (
            <div key={s.period} className="flex h-full flex-1 flex-col justify-end">
              <div
                className="relative w-full overflow-hidden rounded-t-md bg-brand-100"
                style={{ height: `${Math.max((expected / max) * 100, 2)}%` }}
                title={`${shortPeriodLabel(s.period)} : ${formatMoney(collected, currency)} encaissés sur ${formatMoney(expected, currency)}`}
              >
                <div
                  className="absolute inset-x-0 bottom-0 bg-brand-600"
                  style={{ height: `${expected > 0 ? Math.min((collected / expected) * 100, 100) : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3 sm:gap-5">
        {series.map((s) => (
          <p key={s.period} className="flex-1 text-center text-[11px] font-medium text-slate-500">
            {shortPeriodLabel(s.period)}
          </p>
        ))}
      </div>
      <figcaption className="mt-4 flex items-center gap-5 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-brand-600" aria-hidden="true" /> Encaissé
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-brand-100" aria-hidden="true" /> Attendu
        </span>
      </figcaption>
    </figure>
  );
}
