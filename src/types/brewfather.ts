export type BatchStatus =
  | 'Planning'
  | 'Brewing'
  | 'Fermenting'
  | 'Conditioning'
  | 'Completed'
  | 'Archived';

export interface BrewfatherStyle {
  name?: string;
  category?: string;
  styleGuide?: string;
  abvMin?: number;
  abvMax?: number;
  ibuMin?: number;
  ibuMax?: number;
  colorMin?: number;
  colorMax?: number;
}

export interface BrewfatherFermentable {
  _id?: string;
  name: string;
  amount?: number;
  percentage?: number;
  color?: number;
  type?: string;
}

export interface BrewfatherHop {
  _id?: string;
  name: string;
  amount?: number;
  alpha?: number;
  time?: number;
  use?: string;
  temp?: number;
}

export interface BrewfatherYeast {
  _id?: string;
  name: string;
  laboratory?: string;
  productId?: string;
  attenuation?: number;
  type?: string;
}

export interface BrewfatherRecipe {
  _id?: string;
  name?: string;
  author?: string;
  type?: string;
  style?: BrewfatherStyle;
  abv?: number;
  ibu?: number;
  color?: number;
  og?: number;
  fg?: number;
  boilTime?: number;
  batchSize?: number;
  fermentables?: BrewfatherFermentable[];
  hops?: BrewfatherHop[];
  yeasts?: BrewfatherYeast[];
  notes?: string;
}

export interface BrewfatherNote {
  timestamp?: number;
  note?: string;
  type?: string;
  status?: string;
}

export interface BrewfatherBatch {
  _id: string;
  name?: string;
  batchNo?: number;
  status: BatchStatus;
  brewer?: string;
  brewDate?: number;
  fermentationStartDate?: number;
  bottlingDate?: number;
  style?: string;
  abv?: number;
  measuredAbv?: number;
  ibu?: number;
  measuredIbu?: number;
  estimatedIbu?: number;
  color?: number;
  measuredColor?: number;
  estimatedColor?: number;
  og?: number;
  measuredOg?: number;
  estimatedOg?: number;
  fg?: number;
  measuredFg?: number;
  estimatedFg?: number;
  batchNotes?: string;
  tastingNotes?: string;
  notes?: BrewfatherNote[];
  recipe?: BrewfatherRecipe;
  readings?: BrewfatherReading[];
}

export interface BrewfatherReading {
  time: number;
  sg?: number;
  temp?: number;
  angle?: number;
  battery?: number;
  rssi?: number;
  pressure?: number;
  comment?: string;
  type?: string;
  id?: string;
}

export type TempUnit = 'F' | 'C';
export type LayoutMode = 'auto' | 'landscape' | 'portrait';
export type SectionFilter = 'all' | 'tap' | 'fermenting' | 'planning';

export interface TaproomSettings {
  breweryName: string;
  tapLabels: string[];
  tempUnit: TempUnit;
  layoutMode: LayoutMode;
  refreshMinutes: number;
  includeConditioningOnTap: boolean;
  showHiddenBatches: boolean;
}

/**
 * Assignment value stored per batchId:
 * - "tap:0", "tap:1", ... for configured tap index
 * - "on-deck" for next keg up
 * - "hidden" to hide older completed Brewfather batches from the taplist
 */
export type TapAssignment = string;

export interface TaproomData {
  completed: BrewfatherBatch[];
  conditioning: BrewfatherBatch[];
  fermenting: BrewfatherBatch[];
  brewing: BrewfatherBatch[];
  planning: BrewfatherBatch[];
  readingsByBatch: Record<string, BrewfatherReading[]>;
  fetchedAt: number;
}
