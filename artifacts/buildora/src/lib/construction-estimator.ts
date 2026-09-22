export type PlotUnit = "marla" | "kanal" | "squareFeet" | "squareYards";
export type CoveredAreaMode = "squareFeet" | "percentage";
export type CoveredAreaBasis = "perFloor" | "total";
export type FloorChoice = "ground" | "groundPlus1" | "groundPlus2" | "custom";
export type ConstructionType = "greyStructure" | "complete";
export type Quality = "basic" | "standard" | "premium";

export const CALCULATOR_DISCLAIMER =
  "This is an approximate estimate. Actual costs vary by location, material quality, design, labor rates, market prices, and contractor.";

export const MATERIAL_QUANTITY_NOTE =
  "Approximate quantity — final quantity depends on architectural and structural design.";

export const ESTIMATION_ASSUMPTIONS = {
  version: "Pakistan MVP planning assumptions",
  defaultMarlaSqFt: 225,
  plotConversions: {
    marla: 225,
    kanal: 4500,
    squareFeet: 1,
    squareYards: 9,
  } satisfies Record<PlotUnit, number>,
  locationMultipliers: {
    Islamabad: 1.08,
    Rawalpindi: 1.03,
    Peshawar: 0.96,
    Lahore: 1.05,
    Karachi: 1.12,
    "Other Pakistan": 1,
  } satisfies Record<string, number>,
  qualityRates: {
    basic: {
      greyMin: 2400,
      greyMax: 3000,
      finishingMin: 1200,
      finishingMax: 1800,
    },
    standard: {
      greyMin: 3000,
      greyMax: 3800,
      finishingMin: 1900,
      finishingMax: 2800,
    },
    premium: {
      greyMin: 3800,
      greyMax: 4800,
      finishingMin: 2900,
      finishingMax: 4300,
    },
  } satisfies Record<
    Quality,
    {
      greyMin: number;
      greyMax: number;
      finishingMin: number;
      finishingMax: number;
    }
  >,
  floorComplexity: {
    ground: 1,
    groundPlus1: 1.02,
    groundPlus2: 1.04,
  },
} as const;

export const LOCATION_OPTIONS = [
  { value: "Islamabad", label: "Islamabad" },
  { value: "Rawalpindi", label: "Rawalpindi" },
  { value: "Peshawar", label: "Peshawar" },
  { value: "Lahore", label: "Lahore" },
  { value: "Karachi", label: "Karachi" },
  { value: "Other Pakistan", label: "Other Pakistan" },
] as const;

export const PLOT_UNIT_OPTIONS = [
  { value: "marla", label: "Marla", hint: "Uses the configurable 225 sq ft default" },
  { value: "kanal", label: "Kanal", hint: "20 × the configured marla default" },
  { value: "squareFeet", label: "Square feet", hint: "Direct square-foot input" },
  { value: "squareYards", label: "Square yards", hint: "1 sq yd = 9 sq ft" },
] as const;

export const FLOOR_OPTIONS = [
  { value: "ground", label: "Ground floor", count: 1 },
  { value: "groundPlus1", label: "Ground + 1", count: 2 },
  { value: "groundPlus2", label: "Ground + 2", count: 3 },
  { value: "custom", label: "Custom number", count: null },
] as const;

export const QUALITY_OPTIONS = [
  {
    value: "basic",
    label: "Basic",
    description: "Economical materials and finishes.",
  },
  {
    value: "standard",
    label: "Standard",
    description: "Mid-range materials and finishes.",
  },
  {
    value: "premium",
    label: "Premium",
    description: "Higher-end materials and finishes.",
  },
] as const;

export const CONSTRUCTION_TYPE_OPTIONS = [
  {
    value: "greyStructure",
    label: "Grey structure",
    description: "Structure, shell, and core construction; finishing is separate.",
  },
  {
    value: "complete",
    label: "Complete construction",
    description: "Grey structure plus finishing-related costs.",
  },
] as const;

export type CalculatorInput = {
  location: string;
  plotSize: number;
  plotUnit: PlotUnit;
  coveredAreaMode: CoveredAreaMode;
  coveredAreaBasis: CoveredAreaBasis;
  coveredAreaValue: number;
  floorChoice: FloorChoice;
  customFloorCount?: number;
  constructionType: ConstructionType;
  quality: Quality;
};

export type EstimateResult = {
  location: string;
  plotSize: number;
  plotUnit: PlotUnit;
  plotAreaSqFt: number;
  coveredAreaMode: CoveredAreaMode;
  coveredAreaBasis: CoveredAreaBasis;
  coveredAreaValue: number;
  floorCount: number;
  floorsLabel: string;
  constructionType: ConstructionType;
  quality: Quality;
  totalCoveredAreaSqFt: number;
  greyMin: number;
  greyMax: number;
  finishingMin: number;
  finishingMax: number;
  estimatedMin: number;
  estimatedMax: number;
  costPerSqFtMin: number;
  costPerSqFtMax: number;
  locationMultiplier: number;
  assumptionsLabel: string;
};

export type EstimateValidationErrors = Partial<
  Record<keyof CalculatorInput | "form", string>
>;

export function locationKeyFromText(location: string) {
  const normalized = location.trim().toLowerCase();
  const match = LOCATION_OPTIONS.find((option) =>
    normalized.includes(option.value.toLowerCase()),
  );
  return match?.value ?? "Other Pakistan";
}

export function getPlotAreaSqFt(plotSize: number, plotUnit: PlotUnit) {
  return plotSize * ESTIMATION_ASSUMPTIONS.plotConversions[plotUnit];
}

export function getFloorCount(input: Pick<CalculatorInput, "floorChoice" | "customFloorCount">) {
  if (input.floorChoice === "custom") return input.customFloorCount ?? 0;
  return FLOOR_OPTIONS.find((option) => option.value === input.floorChoice)?.count ?? 0;
}

export function getFloorsLabel(floorChoice: FloorChoice, floorCount: number) {
  if (floorChoice === "ground") return "Ground floor";
  if (floorChoice === "groundPlus1") return "Ground + 1";
  if (floorChoice === "groundPlus2") return "Ground + 2";
  return `${floorCount} floors`;
}

export function validateCalculatorInput(
  input: CalculatorInput,
): EstimateValidationErrors {
  const errors: EstimateValidationErrors = {};
  const plotAreaSqFt = getPlotAreaSqFt(input.plotSize, input.plotUnit);
  const floorCount = getFloorCount(input);

  if (!input.location.trim() || input.location.trim().length < 2) {
    errors.location = "Please enter a city or area.";
  }
  if (!Number.isFinite(input.plotSize) || input.plotSize <= 0 || plotAreaSqFt > 2_000_000) {
    errors.plotSize = "Please enter a valid property size within a practical planning range.";
  }
  if (!Number.isFinite(input.coveredAreaValue) || input.coveredAreaValue <= 0) {
    errors.coveredAreaValue = "Please enter a covered-area value greater than zero.";
  }
  if (input.coveredAreaMode === "percentage" && input.coveredAreaValue > 100) {
    errors.coveredAreaValue = "Covered area percentage must be between 1 and 100.";
  }
  if (
    input.coveredAreaMode === "squareFeet" &&
    input.coveredAreaBasis === "total" &&
    input.coveredAreaValue > plotAreaSqFt * Math.max(floorCount, 1) * 1.05
  ) {
    errors.coveredAreaValue =
      "Total covered area is larger than the selected plot and floor count.";
  }
  if (
    input.coveredAreaMode === "squareFeet" &&
    input.coveredAreaBasis === "perFloor" &&
    input.coveredAreaValue > plotAreaSqFt
  ) {
    errors.coveredAreaValue = "Covered area cannot exceed the plot area for one floor.";
  }
  if (
    input.coveredAreaMode === "squareFeet" &&
    input.coveredAreaBasis === "total" &&
    input.coveredAreaValue > 5_000_000
  ) {
    errors.coveredAreaValue = "Please enter a smaller total covered area.";
  }
  if (input.floorChoice === "custom" && (!Number.isInteger(floorCount) || floorCount < 1 || floorCount > 10)) {
    errors.customFloorCount = "Choose a whole number of floors from 1 to 10.";
  }
  if (!input.constructionType) errors.constructionType = "Choose a construction type.";
  if (!input.quality) errors.quality = "Choose a construction quality.";
  return errors;
}

export function calculateConstructionEstimate(input: CalculatorInput): EstimateResult {
  const errors = validateCalculatorInput(input);
  if (Object.keys(errors).length > 0) {
    throw new Error(Object.values(errors)[0]);
  }

  const locationKey = locationKeyFromText(input.location);
  const plotAreaSqFt = Math.round(getPlotAreaSqFt(input.plotSize, input.plotUnit));
  const floorCount = getFloorCount(input);
  const perFloorCoveredArea =
    input.coveredAreaMode === "percentage"
      ? plotAreaSqFt * (input.coveredAreaValue / 100)
      : input.coveredAreaBasis === "perFloor"
        ? input.coveredAreaValue
        : input.coveredAreaValue / floorCount;
  const totalCoveredAreaSqFt = Math.round(
    input.coveredAreaMode === "squareFeet" && input.coveredAreaBasis === "total"
      ? input.coveredAreaValue
      : perFloorCoveredArea * floorCount,
  );
  const locationMultiplier =
    ESTIMATION_ASSUMPTIONS.locationMultipliers[locationKey];
  const floorMultiplier =
    input.floorChoice === "custom"
      ? 1 + Math.min(Math.max(floorCount - 1, 0), 4) * 0.02
      : ESTIMATION_ASSUMPTIONS.floorComplexity[input.floorChoice];
  const qualityRates = ESTIMATION_ASSUMPTIONS.qualityRates[input.quality];
  const multiplier = locationMultiplier * floorMultiplier;
  const greyMin = Math.round(totalCoveredAreaSqFt * qualityRates.greyMin * multiplier);
  const greyMax = Math.round(totalCoveredAreaSqFt * qualityRates.greyMax * multiplier);
  const finishingMin =
    input.constructionType === "complete"
      ? Math.round(totalCoveredAreaSqFt * qualityRates.finishingMin * multiplier)
      : 0;
  const finishingMax =
    input.constructionType === "complete"
      ? Math.round(totalCoveredAreaSqFt * qualityRates.finishingMax * multiplier)
      : 0;
  const estimatedMin = greyMin + finishingMin;
  const estimatedMax = greyMax + finishingMax;

  return {
    location: input.location.trim(),
    plotSize: input.plotSize,
    plotUnit: input.plotUnit,
    plotAreaSqFt,
    coveredAreaMode: input.coveredAreaMode,
    coveredAreaBasis: input.coveredAreaBasis,
    coveredAreaValue: input.coveredAreaValue,
    floorCount,
    floorsLabel: getFloorsLabel(input.floorChoice, floorCount),
    constructionType: input.constructionType,
    quality: input.quality,
    totalCoveredAreaSqFt,
    greyMin,
    greyMax,
    finishingMin,
    finishingMax,
    estimatedMin,
    estimatedMax,
    costPerSqFtMin: Math.round(estimatedMin / totalCoveredAreaSqFt),
    costPerSqFtMax: Math.round(estimatedMax / totalCoveredAreaSqFt),
    locationMultiplier,
    assumptionsLabel: `${ESTIMATION_ASSUMPTIONS.version}; ${ESTIMATION_ASSUMPTIONS.defaultMarlaSqFt} sq ft per marla default`,
  };
}

export function formatPkrRange(min: number, max: number) {
  return `PKR ${formatPkr(min)} – ${formatPkr(max)}`;
}

export function formatPkr(value: number) {
  if (value >= 1_000_000) {
    return `PKR ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 100_000) {
    return `PKR ${(value / 100_000).toFixed(1)} lac`;
  }
  return `PKR ${Math.round(value).toLocaleString("en-PK")}`;
}