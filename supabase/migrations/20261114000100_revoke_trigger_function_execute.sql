-- Les fonctions de trigger ne doivent pas être appelables par l'API (/rest/v1/rpc/…).
-- Les triggers continuent de s'exécuter : le droit EXECUTE n'est vérifié qu'à leur création.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.sync_unit_occupancy() from public, anon, authenticated;
revoke all on function public.sync_property_counters() from public, anon, authenticated;
