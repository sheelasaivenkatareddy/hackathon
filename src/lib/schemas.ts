// Strict shapes for everything that comes from outside the app. Bad data becomes a clear error, never a crash.
import { z } from "zod";

export function parse<T>(schema: z.ZodType<T>, data: unknown, what: string): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new Error(`${what} came back in an unexpected shape`);
  return r.data;
}

const nums = z.array(z.number().nullable());

export const ForecastSchema = z.object({
  utc_offset_seconds: z.number(),
  hourly: z.object({ time: z.array(z.string()), temperature_2m: nums, relative_humidity_2m: nums, precipitation: nums }),
});

export const CurrentSchema = z.object({
  current: z.object({ time: z.string(), temperature_2m: z.number(), relative_humidity_2m: z.number(), precipitation: z.number(), wind_speed_10m: z.number() }),
  hourly: z.object({ time: z.array(z.string()), soil_moisture_0_to_1cm: nums.optional(), soil_temperature_6cm: nums.optional() }),
});

export const SoilGridsSchema = z.object({
  properties: z.object({
    layers: z.array(z.object({
      name: z.string(),
      unit_measure: z.object({ d_factor: z.number() }),
      depths: z.array(z.object({ values: z.object({ mean: z.number().nullable().optional() }) })),
    })),
  }),
});

export const PlaceSchema = z.object({ city: z.string().optional(), locality: z.string().optional(), principalSubdivision: z.string().optional() });

export const WikiSchema = z.object({
  extract: z.string(),
  content_urls: z.object({ desktop: z.object({ page: z.string() }) }).optional(),
});

const LabelSchema = z.object({ index: z.number(), label: z.string(), name: z.string(), plant: z.string().optional() });

export const FieldHeadSchema = z.object({
  version: z.string(),
  temperature: z.number().positive(),
  labels: z.array(LabelSchema).min(1),
  weights: z.array(z.array(z.number())),
  bias: z.array(z.number()),
  metrics: z.object({
    fieldTop1: z.number(), fieldTop3: z.number(), fieldMacroF1: z.number(), ece: z.number(),
    ci: z.tuple([z.number(), z.number()]), n: z.number(), baselineTop1: z.number(), trainPhotos: z.number(),
  }),
}).refine((h) => h.weights.length === h.labels.length && h.bias.length === h.labels.length, "model head sizes do not match");

export const FieldReportSchema = z.object({
  testPhotos: z.number(),
  levels: z.record(z.string(), z.object({ photos: z.number(), top1: z.number(), top3: z.number() })),
  conditions: z.record(z.string(), z.object({ photos: z.number(), right: z.number() })),
});

export const ExportFileSchema = z.object({
  app: z.literal("patra-lens"),
  version: z.number(),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});
