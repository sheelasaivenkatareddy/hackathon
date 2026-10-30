// Patra Lens: every threshold, weight and limit in one place.
// The numbers match reference/patra_vision_reference.py and were checked on the sample photos.

export const CONFIG = {
  workSize: 512, // long side (px) used for all pixel maths
  storeMaxSide: 1024, // photos are stored at this long side (JPEG)
  thumbSide: 256,

  coach: {
    minSharpness: 40, // variance of the Laplacian on luma
    minLuma: 60, // mean luma 0-255
    maxLuma: 200,
    maxOverexposedPct: 5, // % of pixels with luma > 250
    minLeafPct: 30, // % of plant-like pixels in the photo
  },

  colour: {
    // H in degrees 0-360, S and V in 0-1
    plant: { hMin: 25, hMax: 195, sMin: 0.2, vMin: 0.15, vMax: 0.95 },
    spot: { hBelow: 50, hAbove: 290, sMin: 0.1, vMin: 0.08, vMax: 0.85 },
    closePx: 7, // square closing used to build the leaf region
    holeMaxLeafPct: 2, // an enclosed gap bigger than this is space between leaves, not damage
  },

  compare: {
    tolerancePx: 7, // old damage is grown by this many px before checking what is new
    newOverlapMax: 0.2, // a blob is NEW if less than 20% of it overlaps old damage
    minComponentPx: 15,
    commonErodePx: 3,
    minInsideCommon: 0.8, // blob must lie mostly on leaf visible in both photos
    minWasGreen: 0.6, // ...and the older photo must show green leaf under most of it
    alignGood: 0.8, // leaf IoU after alignment
    alignFair: 0.65,
    firstSpotMaxOldPct: 1, // "first spots" only if the older photo was almost clean
    spreadingNewCount: 3,
    changePointsPer3Days: 2,
    orb: { features: 1000, ratio: 0.75, ransacPx: 5, minInliers: 25, minInlierRatio: 0.3, scaleMin: 0.7, scaleMax: 1.4 },
  },

  diagnosis: {
    expertBelow: 0.5, // top-1 probability below this -> EXPERT ("not sure")
    checkGapBelow: 0.2, // top-1 minus top-2 below this -> CHECK
    highFrom: 0.8, // confidence words
    mediumFrom: 0.5,
    inputSize: 224,
    resizeShort: 256,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
  },

  risk: {
    lateBlight: { huttonRecent: 50, huttonForecast: 15, nearbyReports: 20 },
    huttonMinTempC: 10,
    huttonHumidHours: 6,
    huttonHumidRH: 90,
    leafSpot: { warmWetHours: 35, rain: 15, cropStage: 10, nearbyReports: 20 },
    warmWetMinHours: 10, // in the last 48 h
    warmWetRH: 90,
    warmWetTempMin: 20,
    warmWetTempMax: 30,
    rainMm3Days: 5,
    nearbyMinReports: 3,
    levels: { mediumFrom: 35, highFrom: 65 },
    scoutEveryDays: { low: 5, medium: 3, high: 2 },
  },

  radar: {
    cellDeg: 0.01, // about 1 km
    minReportsToShowNumber: 3,
    riseMinThisWeek: 3,
    riseFactor: 2, // this week >= 2x the average of the previous 3 weeks
    previousWeeks: 3,
    defaultCentre: [12.97, 77.59] as [number, number], // Bengaluru
  },

  expert: { passcode: "iihr2026" }, // change before the demo

  // Real numbers only. Field values: field-tuned model on the 236 PlantDoc test photos (ml/field-head/train_head.py).
  // If you replace the model, replace these too. Anything still null shows "To be measured".
  measured: {
    fieldAccuracy: 0.716 as number | null,
    fieldAccuracyLow: 0.657 as number | null, // 95% interval
    fieldAccuracyHigh: 0.771 as number | null,
    fieldTop3: 0.958 as number | null,
    fieldMacroF1: 0.699 as number | null,
    tomatoFieldAccuracy: 0.536 as number | null,
    offTheShelfFieldAccuracy: 0.403 as number | null, // the same model before retraining, all 38 of its classes
    fieldTestPhotos: 236 as number | null,
    labMacroF1: null as number | null,
    labToFieldGap: null as number | null,
    eceAfterCalibration: 0.041 as number | null,
    secondsPerPhoto: 3 as number | null, // about 2.4-3.9 s in Edge on a laptop. Phones not measured yet.
  },
} as const;

export type Config = typeof CONFIG;
