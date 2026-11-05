-- Open data for scientists: every scan without anything that identifies a farmer.
-- No name, phone, village, device id or photo. Location is rounded to about 1 km. Anyone can read it
-- through the website's /data page; full records (photos, contacts) stay behind the admin / expert login.
create or replace function public.open_scan_data()
returns table (
  scanned_at timestamptz,
  plant text,
  is_tomato boolean,
  disease text,
  severity text,
  confidence real,
  ai_source text,
  affected_areas int,
  lat_1km real,
  lon_1km real,
  sent_to_lab boolean
)
language sql stable security definer set search_path = public as $$
  select s.created_at,
         coalesce(s.plant, 'Unknown'),
         s.is_tomato,
         coalesce(s.disease, 'Not a leaf'),
         coalesce(s.severity, 'None'),
         round(coalesce(s.confidence, 0)::numeric, 2)::real,
         s.source,
         coalesce(jsonb_array_length(s.detections), 0),
         round(s.lat::numeric, 2)::real,
         round(s.lon::numeric, 2)::real,
         exists (select 1 from public.escalations e where e.scan_id = s.id)
  from public.scans s
  order by s.created_at desc
  limit 5000;
$$;

revoke all on function public.open_scan_data() from public;
grant execute on function public.open_scan_data() to anon, authenticated;
