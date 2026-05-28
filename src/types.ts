export type ThemeName = "dark" | "light" | "linear";
export type EquipmentSetName = "" | "defense" | "attack" | "hybrid";
export type AppView = "builder" | "shared";

export interface SlotState {
  assetId: string;
  label?: string;
  marked?: boolean;
}

export interface DeviceState {
  assetId: string;
  label: string;
  role: string;
}

export interface SkillRowState {
  assetId: string;
  title: string;
  body: string;
}

export interface UpgradeState {
  title: string;
  body: string;
  usable?: string;
  viable?: string;
}

export interface BuildState {
  theme: ThemeName;
  title: string;
  tags: string[];
  headers: Record<string, string>;
  colors: Record<string, string>;
  equipmentSet: EquipmentSetName;
  mainSkills: SlotState[];
  situationalSkills: SlotState[];
  equipment: SlotState[];
  devices: DeviceState[];
  skillRows: SkillRowState[];
  upgrades: UpgradeState[];
  notes: string;
  rank: string;
}

export interface BuildRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sharedAt: string | null;
  state: BuildState;
}

export interface BuildTombstone {
  id: string;
  deletedAt: string;
}

export interface BuildLibrary {
  schemaVersion: number;
  activeBuildId: string;
  builds: BuildRecord[];
  deletedBuilds: BuildTombstone[];
}

export interface CloudBuildRow {
  id: string;
  owner_id?: string;
  name: string;
  state_json: BuildState;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  shared_at: string | null;
}

export interface ProfileRow {
  user_id: string;
  username: string;
  username_key: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  userId: string;
  username: string;
  usernameKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface SharedBuildRow {
  id: string;
  owner_id: string;
  username: string;
  hero_name: string | null;
  name: string;
  state_json: BuildState;
  updated_at: string;
  shared_at: string;
}

export interface BuildShareRow {
  id: string;
  owner_id?: string;
  name: string;
  state_json: BuildState;
  updated_at: string;
  shared_at: string;
}

export interface SharedBuild {
  id: string;
  ownerId: string;
  username: string;
  heroName: string;
  name: string;
  state: BuildState;
  updatedAt: string;
  sharedAt: string;
}

export interface SharedBuildGroup {
  heroName: string;
  builds: SharedBuild[];
}

export interface CatalogAsset {
  id: string;
  kind: "skill" | "device" | "equipment";
  name: string;
  imageKey: string;
  crop?: { x: number; y: number; w: number; h: number };
}

export interface RenderBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DomRefs {
  appShell: HTMLDivElement;
  authGate: HTMLElement;
  authEmail: HTMLInputElement;
  authSignIn: HTMLButtonElement;
  authStatus: HTMLElement;
  usernameGate: HTMLElement;
  usernameInput: HTMLInputElement;
  usernameSave: HTMLButtonElement;
  usernameSignOut: HTMLButtonElement;
  usernameStatus: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  form: HTMLFormElement;
  pickerModal: HTMLDivElement;
  pickerGrid: HTMLDivElement;
  pickerTitle: HTMLElement;
  closePicker: HTMLButtonElement;
  clearSlot: HTMLButtonElement;
  builderTab: HTMLButtonElement;
  sharedTab: HTMLButtonElement;
  exportButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  sampleButton: HTMLButtonElement;
  saveStatus: HTMLElement;
  previewTitle: HTMLElement;
  exportModal: HTMLDivElement;
  closeExport: HTMLButtonElement;
  exportPreview: HTMLImageElement;
  downloadExport: HTMLAnchorElement;
  openExport: HTMLAnchorElement;
}

export interface CloudStatus {
  state: "local" | "syncing" | "synced" | "failed" | string;
  message: string;
}

export type CloudSchemaStatus =
  | { ok: true; missing: []; message: string }
  | { ok: false; missing: string[]; message: string };

export interface CardBuilderAppOptions {
  refs: DomRefs;
  storage?: Storage;
  clock?: () => number;
}

export type PickerKind = "skill" | "device" | "gear";

export interface PickerState {
  kind: PickerKind;
  path: string;
}

export interface RuntimeState {
  buildLibrary: BuildLibrary;
  state: BuildState;
  images: LoadedImages;
  activePicker: PickerState | null;
  currentExportUrl: string;
  formSectionOpenState: Record<string, boolean>;
  cloudClient: CloudSyncClient | null;
  cloudSession: AuthSession | null;
  cloudStatus: CloudStatus;
  magicLinkInFlight: boolean;
  magicLinkEmail: string;
  isSamplePreview: boolean;
}

export interface ScrollSnapshot {
  formTop: number;
  windowX: number;
  windowY: number;
}

export interface FocusState {
  selector: string;
  scrollState: ScrollSnapshot;
  selectionStart: number | null;
  selectionEnd: number | null;
}

export interface RenderFormOptions {
  deferWhenEditing?: boolean;
}

export interface SaveAndRenderOptions {
  form?: boolean;
}

export interface ScrollControlOptions {
  focus?: boolean;
  picker?: boolean;
}

export interface InteractiveRegion {
  type: "field" | "picker";
  path: string;
  rect: RenderBox;
  kind?: "skill" | "device" | "gear";
}

export type LoadedImages = Record<string, HTMLImageElement>;

export interface BuildFormViewModel {
  state: BuildState;
  buildLibrary: BuildLibrary;
  activeBuild: BuildRecord | undefined;
  previewing: boolean;
  cloudStatus: CloudStatus;
  cloudUser: string;
  cloudConfigured: boolean;
  magicLinkEmail: string;
  magicLinkInFlight: boolean;
  magicLinkRemaining: number;
  magicLinkButtonText: string;
  activeColors: Record<string, string>;
  formSectionOpenState: Record<string, boolean>;
  activeView: AppView;
  currentUserId: string;
  profileUsername: string;
  previewLabel: string;
  sharedPreview: SharedBuild | null;
  sharedBuildGroups: SharedBuildGroup[];
}

export interface SupabaseConfig {
  enabled?: boolean;
  url?: string;
  anonKey?: string;
  table?: string;
}

export interface AuthSession {
  user?: {
    id: string;
    email?: string | null;
  };
  [key: string]: unknown;
}

export interface SyncError {
  message?: string;
  code?: string;
  error_code?: string;
  status?: number;
  [key: string]: unknown;
}

export interface SyncQueryResult<T> {
  data?: T[] | null;
  error?: SyncError | null;
}

export interface SyncSingleResult<T> {
  data?: T | null;
  error?: SyncError | null;
}

export interface SyncAuthResult {
  data?: {
    session?: AuthSession | null;
    [key: string]: unknown;
  };
  error?: SyncError | null;
}

export interface SyncAuthClient {
  getSession(): Promise<SyncAuthResult>;
  onAuthStateChange?: (
    callback: (event: string, session: AuthSession | null) => void,
  ) => unknown;
  signInWithOtp(options: {
    email: string;
    options: { emailRedirectTo: string };
  }): Promise<{ data?: unknown; error?: SyncError | null }>;
  signOut(): Promise<{ error?: SyncError | null }>;
}

export interface SyncSelectQuery<T> {
  order(
    column: string,
    options: { ascending: boolean },
  ): Promise<SyncQueryResult<T>>;
  eq(column: string, value: unknown): SyncFilterQuery<T>;
}

export interface SyncUpsertQuery<T> {
  select(columns: string): Promise<SyncQueryResult<T>>;
}

export interface SyncFilterQuery<T> {
  order(
    column: string,
    options: { ascending: boolean },
  ): Promise<SyncQueryResult<T>>;
  maybeSingle(): Promise<SyncSingleResult<T>>;
  single(): Promise<SyncSingleResult<T>>;
}

export interface SyncSelectedUpsertQuery<T> {
  single(): Promise<SyncSingleResult<T>>;
}

export interface SyncGenericUpsertQuery<T> {
  select(columns: string): SyncSelectedUpsertQuery<T>;
}

export interface SyncDeleteQuery<T> {
  eq(column: string, value: unknown): Promise<SyncQueryResult<T>>;
}

export interface SyncTableClient<T> {
  select(columns: string): SyncSelectQuery<T>;
  upsert(
    rows: T[],
    options: { onConflict: string },
  ): SyncUpsertQuery<T>;
  upsert(
    row: T,
    options: { onConflict: string },
  ): SyncGenericUpsertQuery<T>;
  delete(): SyncDeleteQuery<T>;
}

export interface SyncSupabaseClient {
  auth: SyncAuthClient;
  from<T extends CloudBuildRow | ProfileRow | SharedBuildRow | BuildShareRow = CloudBuildRow>(
    table: string,
  ): SyncTableClient<T>;
}

export interface CloudSyncClient {
  supabase: SyncSupabaseClient;
  table: string;
  session: AuthSession | null;
}

declare global {
  // Runtime overrides are used by local tests and production deployment config.
  var CARD_BUILDER_SUPABASE: SupabaseConfig | undefined;
  var CARD_BUILDER_SUPABASE_URL: string | undefined;
  var CARD_BUILDER_SUPABASE_ANON_KEY: string | undefined;
  var __CARD_BUILDER_SUPABASE_CLIENT_FACTORY__:
    | ((config: SupabaseConfig) => SyncSupabaseClient | Promise<SyncSupabaseClient>)
    | undefined;
}
