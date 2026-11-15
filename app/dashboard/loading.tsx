/** Squelette affiché instantanément pendant le chargement des données (streaming). */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Chargement">
      <div className="space-y-2">
        <div className="h-7 w-64 rounded-lg bg-slate-200" />
        <div className="h-4 w-80 max-w-full rounded bg-slate-200/70" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-28 bg-white p-5">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-7 w-32 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="card h-72 bg-white" />
    </div>
  );
}
