import {
  getSupabaseConfig,
  isSupabaseConfigured,
} from "./supabase-config.ts";
import {
  isMagicLinkRateLimitError,
  magicLinkErrorMessage,
  rateLimitCode,
} from "./auth-errors.ts";
import {
  authRedirectMessage,
  parseAuthRedirect,
  replaceAuthRedirectUrl,
} from "./auth-redirect.ts";
import {
  createCloudSync,
  deleteBuildShare,
  fetchCloudBuildRows,
  fetchSharedBuildRows,
  fetchUserProfile,
  publishBuildShare,
  refreshSession,
  saveUserProfile,
  signInWithMagicLink,
  signOut,
  upsertCloudBuildRows,
  verifyCloudSchema,
} from "./cloud-sync.ts";
import {
  buildNameFromState,
  clone,
  defaultState,
  equipmentForSet,
  normalizeEquipmentSet,
  stripUpgradeNoteMarker,
  wendyState,
} from "./state-model.ts";
import {
  MAX_IMPORT_JSON_BYTES,
  buildLibraryFromImportedPayload,
  buildRecordToCloudRow,
  makeBuildRecord,
  mergeBuildLibraries,
  mergeTombstones,
  normalizeBuildLibrary,
  tombstoneToCloudRow,
} from "./build-library.ts";
import {
  loadBuildLibrary,
  saveBuildLibraryToStorage,
  saveLegacyState,
} from "./build-storage.ts";
import {
  canvasToPngBlob,
  ensureCardFontsReady,
  loadCardImages,
  renderCard,
} from "./card-renderer.ts";
import {
  SOURCE_SIZE,
  inRect as pointInRect,
  interactiveRegions as layoutInteractiveRegions,
  sectionKeyForPath as sectionKeyForControlPath,
  sourcePointFromClientPoint,
  themeConfig,
} from "./card-layout.ts";
import { assetPaths, catalogById } from "./card-catalog.ts";
import {
  formatCooldown,
  magicLinkCooldownMessage,
  magicLinkCooldownRemaining,
  normalizeEmail,
  writeMagicLinkCooldown,
} from "./magic-link-cooldown.ts";
import {
  buildRecordToShareRow,
  groupSharedBuilds,
  isDuplicateUsernameError,
  normalizeSharedBuildRows,
  normalizeUsername,
  usernameValidationMessage,
} from "./shared-builds.ts";
import { renderFormHtml } from "./form-view.ts";
import {
  renderAssetPicker,
  skillLabelPathForAssetPath,
} from "./asset-picker.ts";
import {
  buildSavedBuildItems,
  filterAndSortSavedBuilds,
  type SavedBuildFilter,
  type SavedBuildSort,
} from "./saved-builds.ts";
import {
  renderSavedBuildsListHtml,
  savedBuildsSummaryText,
} from "./saved-builds-view.ts";
import {
  closestFromEvent,
  bindCardBuilderEvents,
  eventTargetElement,
} from "./event-bindings.ts";
import {
  buildExportPayload,
  downloadJsonPayload,
  safeFileName,
} from "./export-actions.ts";
import {
  attrSelectorValue,
  FocusManager,
  focusWithoutScrolling,
} from "./focus-manager.ts";
import type {
  AuthSession,
  AppView,
  BuildLibrary,
  BuildRecord,
  BuildState,
  CardBuilderAppOptions,
  CloudStatus,
  CloudSyncClient,
  DomRefs,
  LoadedImages,
  PickerKind,
  PickerState,
  SharedBuild,
  RenderFormOptions,
  SaveAndRenderOptions,
  ScrollControlOptions,
  ScrollSnapshot,
  ThemeName,
  UserProfile,
} from "./types";

const EDITOR_IDLE_RENDER_MS = 1500;

type FieldControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

type ActiveThemeColors = {
  template: string;
  body: string;
  title: string;
  muted: string;
  ribbonText: string;
  smallRibbonText: string;
  marker: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isFieldControl(element: Element | null): element is FieldControl {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
}

function pickerKindFromValue(value: unknown): PickerKind | null {
  return value === "skill" || value === "device" || value === "gear"
    ? value
    : null;
}

function themeNameFromValue(value: unknown): ThemeName | null {
  return value === "dark" || value === "light" || value === "linear"
    ? value
    : null;
}

function savedBuildSortFromValue(value: unknown): SavedBuildSort | null {
  return value === "updated" ||
    value === "name" ||
    value === "hero" ||
    value === "published"
    ? value
    : null;
}

function savedBuildFilterFromValue(value: unknown): SavedBuildFilter | null {
  return value === "all" ||
    value === "published" ||
    value === "private" ||
    value === "local"
    ? value
    : null;
}

export class CardBuilderApp {
  private readonly refs: DomRefs;
  private readonly storage: Storage | undefined;
  private readonly focus: FocusManager;
  private buildLibrary: BuildLibrary;
  private state: BuildState;
  private images: LoadedImages = {};
  private activePicker: PickerState | null = null;
  private currentExportUrl = "";
  private formSectionOpenState: Record<string, boolean> = {};
  private cloudClient: CloudSyncClient | null = null;
  private cloudSession: AuthSession | null = null;
  private profile: UserProfile | null = null;
  private sharedBuilds: SharedBuild[] = [];
  private cloudStatus: CloudStatus = {
    state: "local",
    message: "Local only",
  };
  private cloudSyncTimer = 0;
  private magicLinkInFlight = false;
  private magicLinkEmail = "";
  private magicLinkCooldownTimer = 0;
  private isSamplePreview = false;
  private sharedPreview: SharedBuild | null = null;
  private activeView: AppView = "builder";
  private savedBuildsQuery = "";
  private savedBuildsSort: SavedBuildSort = "updated";
  private savedBuildsFilter: SavedBuildFilter = "all";
  private appInitialized = false;
  private authRedirectNotice = "";
  private pendingAuthRedirectCleanup = false;

  constructor({ refs, storage, clock }: CardBuilderAppOptions) {
    this.refs = refs;
    this.storage = storage;
    this.focus = new FocusManager({
      form: refs.form,
      idleMs: EDITOR_IDLE_RENDER_MS,
      now: clock,
    });
    this.buildLibrary = loadBuildLibrary(storage);
    this.state = clone(this.getActiveBuild()?.state || defaultState());
    this.bindEvents();
  }

  async init(): Promise<void> {
    const redirect = parseAuthRedirect();
    this.authRedirectNotice = authRedirectMessage(redirect);
    if (redirect.kind === "error") replaceAuthRedirectUrl();
    this.pendingAuthRedirectCleanup = redirect.kind === "session";
    this.renderAuthGate(this.authRedirectNotice || "Connecting to cloud...");
    await this.initializeCloudSync();
  }

  private bindEvents(): void {
    bindCardBuilderEvents(this.refs, {
      onCanvasClick: (event) => this.handleCanvasClick(event),
      onCanvasMouseMove: (event) => this.handleCanvasMouseMove(event),
      onFormPointerDown: (event) => this.handleFormPointerDown(event),
      onFormInput: (event) => this.handleFormInput(event),
      onFormChange: (event) => this.handleFormChange(event),
      onFormFocusOut: () => this.handleFormFocusOut(),
      onFormToggle: (event) => this.handleFormToggle(event),
      onFormClick: (event) => this.handleFormClick(event),
      onSavedBuildsModalInput: (event) =>
        this.handleSavedBuildsModalInput(event),
      onSavedBuildsModalChange: (event) =>
        this.handleSavedBuildsModalChange(event),
      onSavedBuildsModalClick: (event) =>
        this.handleSavedBuildsModalClick(event),
      onCloseSavedBuildsClick: () => this.closeSavedBuildsModal(),
      onThemeClick: (button) => this.handleThemeClick(button),
      onPickerGridClick: (event) => this.handlePickerGridClick(event),
      onClosePickerClick: () => this.closeAssetPicker(),
      onPickerModalClick: (event) => this.handlePickerModalClick(event),
      onClearSlotClick: () => this.handleClearSlotClick(),
      onSampleClick: () => this.enterSamplePreview(),
      onResetClick: () => this.handleResetClick(),
      onExportClick: () => {
        void this.handleExportClick();
      },
      onCloseExportClick: () => this.closeExportModal(),
      onExportModalClick: (event) => this.handleExportModalClick(event),
      onWindowKeydown: (event) => this.handleWindowKeydown(event),
      onAuthEmailInput: () => this.handleAuthEmailInput(),
      onAuthSignInClick: () => {
        void this.requestMagicLink();
      },
      onUsernameInput: () => this.handleUsernameInput(),
      onUsernameSaveClick: () => {
        void this.handleUsernameSave();
      },
      onUsernameSignOutClick: () => {
        void this.signOutOfCloud();
      },
      onBuilderTabClick: () => this.setActiveView("builder"),
      onSharedTabClick: () => this.setActiveView("shared"),
    });
  }

  private activeColors(): ActiveThemeColors {
    const theme = themeConfig[this.state.theme] || themeConfig.linear;
    const overrides = this.state.colors || {};
    return {
      ...theme,
      title: overrides.title || theme.title,
      muted: overrides.tags || theme.muted,
      body: overrides.body || theme.body,
      ribbonText: overrides.banner || theme.ribbonText,
      smallRibbonText: overrides.banner || theme.smallRibbonText,
      marker: overrides.marker || theme.marker,
    };
  }

  private getActiveBuild(): BuildRecord | undefined {
    return (
      this.buildLibrary.builds.find(
        (build) => build.id === this.buildLibrary.activeBuildId,
      ) || this.buildLibrary.builds[0]
    );
  }

  private isPreviewing(): boolean {
    return this.isSamplePreview || Boolean(this.sharedPreview);
  }

  private previewLabel(): string {
    if (this.sharedPreview) {
      return `Shared: ${this.sharedPreview.name}`;
    }
    if (this.isSamplePreview) return "Wendy Sample Preview";
    return "";
  }

  private currentUserId(): string {
    return this.cloudSession?.user?.id || "";
  }

  private setActiveView(view: AppView): void {
    this.activeView = view;
    if (view === "builder" && this.sharedPreview) {
      this.sharedPreview = null;
      this.state = clone(this.getActiveBuild()?.state || defaultState());
      this.renderCard();
    }
    this.updateViewControls();
    this.renderFormSafely();
  }

  private updateViewControls(): void {
    const isSharedView = this.activeView === "shared";
    this.refs.builderTab.classList.toggle("active", !isSharedView);
    this.refs.sharedTab.classList.toggle("active", isSharedView);
    this.refs.builderTab.setAttribute("aria-selected", String(!isSharedView));
    this.refs.sharedTab.setAttribute("aria-selected", String(isSharedView));
    this.refs.sampleButton.disabled = isSharedView;
    this.refs.resetButton.disabled = isSharedView;
    document.querySelectorAll<HTMLButtonElement>("[data-theme]").forEach((button) => {
      button.disabled = isSharedView;
    });
  }

  private hideAllScreens(): void {
    this.refs.authGate.hidden = true;
    this.refs.usernameGate.hidden = true;
    this.refs.appShell.hidden = true;
  }

  private renderAuthGate(message = this.cloudStatus.message): void {
    this.hideAllScreens();
    this.refs.authGate.hidden = false;
    this.refs.authEmail.value = this.magicLinkEmail;
    this.refs.authStatus.className = `cloud-status ${this.cloudStatus.state}`;
    this.refs.authStatus.textContent = message;
    this.updateMagicLinkControls();
  }

  private renderUsernameGate(message = "Use 3-24 letters, numbers, or underscores."): void {
    this.hideAllScreens();
    this.refs.usernameGate.hidden = false;
    this.refs.usernameStatus.className = "cloud-status local";
    this.refs.usernameStatus.textContent = message;
    this.refs.usernameInput.focus();
  }

  private renderBuilderShell(): void {
    this.refs.authGate.hidden = true;
    this.refs.usernameGate.hidden = true;
    this.refs.appShell.hidden = false;
    this.updateViewControls();
  }

  private async ensureEditorReady(): Promise<void> {
    if (this.appInitialized) return;
    this.images = await loadCardImages(assetPaths);
    await ensureCardFontsReady();
    this.appInitialized = true;
  }

  private async enterSignedInApp(): Promise<void> {
    await this.ensureEditorReady();
    this.renderBuilderShell();
    this.renderForm();
    this.renderCard();
    await this.syncBuildLibrary();
    await this.refreshSharedBuilds();
  }

  private async handleAuthenticatedSession(): Promise<void> {
    if (!this.cloudClient || !this.cloudSession?.user?.id) {
      this.renderAuthGate("Cloud ready. Sign in to continue.");
      return;
    }
    try {
      this.setCloudStatus("syncing", "Checking cloud schema...");
      const schemaStatus = await verifyCloudSchema(this.cloudClient);
      if (!schemaStatus.ok) {
        this.profile = null;
        this.sharedBuilds = [];
        this.sharedPreview = null;
        this.activeView = "builder";
        this.setCloudStatus("failed", schemaStatus.message);
        this.renderAuthGate(schemaStatus.message);
        return;
      }
      this.setCloudStatus("syncing", "Loading profile...");
      this.profile = await fetchUserProfile(
        this.cloudClient,
        this.cloudSession.user.id,
      );
      if (!this.profile) {
        this.renderUsernameGate();
        return;
      }
      await this.enterSignedInApp();
    } catch (error) {
      this.profile = null;
      this.renderUsernameGate(`Profile unavailable: ${errorMessage(error)}`);
    }
  }

  private saveBuildLibrary(): void {
    this.buildLibrary = saveBuildLibraryToStorage(
      normalizeBuildLibrary(this.buildLibrary),
      this.storage,
    );
  }

  private setCloudStatus(stateName: CloudStatus["state"], message: string): void {
    this.cloudStatus = { state: stateName, message };
    const statusNode = this.refs.form.querySelector<HTMLElement>(
      "[data-cloud-status]",
    );
    if (statusNode) {
      statusNode.className = `cloud-status ${stateName}`;
      statusNode.textContent = message;
    }
    if (!this.refs.authGate.hidden) {
      this.refs.authStatus.className = `cloud-status ${stateName}`;
      this.refs.authStatus.textContent = message;
    }
    if (!this.refs.usernameGate.hidden) {
      this.refs.usernameStatus.className = `cloud-status ${stateName}`;
      this.refs.usernameStatus.textContent = message;
    }
  }

  private updateMagicLinkControls(): void {
    const formInput = this.refs.form.querySelector<HTMLInputElement>(
      "[data-cloud-email]",
    );
    const formButton = this.refs.form.querySelector<HTMLButtonElement>(
      "[data-cloud-sign-in]",
    );
    const email = normalizeEmail(
      this.refs.authEmail.value || formInput?.value || this.magicLinkEmail,
    );
    const remaining = magicLinkCooldownRemaining(email);
    const cloudConfigured = isSupabaseConfigured(getSupabaseConfig());
    const disabled = !cloudConfigured || this.magicLinkInFlight || remaining > 0;
    const label = this.magicLinkInFlight
      ? "Sending..."
      : remaining > 0
        ? `Try again in ${formatCooldown(remaining)}`
        : "Send magic link";
    for (const button of [formButton, this.refs.authSignIn]) {
      if (!button) continue;
      button.disabled = disabled;
      button.textContent = label;
    }

    window.clearTimeout(this.magicLinkCooldownTimer);
    if (remaining > 0) {
      this.magicLinkCooldownTimer = window.setTimeout(
        () => this.updateMagicLinkControls(),
        1000,
      );
    }
  }

  private async syncBuildLibrary(): Promise<void> {
    if (!this.cloudClient || !this.cloudSession) return;
    try {
      this.setCloudStatus("syncing", "Syncing builds...");
      const preserveEditorState =
        this.isPreviewing() || Boolean(this.focus.activeEditorControl());
      const protectActiveBuild = preserveEditorState && !this.isPreviewing();
      const protectedBuildId = this.buildLibrary.activeBuildId;
      const protectedState = clone(this.state);
      const cloudRows = await fetchCloudBuildRows(this.cloudClient);
      this.buildLibrary = mergeBuildLibraries(this.buildLibrary, cloudRows);
      if (protectActiveBuild) {
        const active = this.buildLibrary.builds.find(
          (build) => build.id === protectedBuildId,
        );
        if (active) {
          active.state = protectedState;
          active.updatedAt = new Date().toISOString();
          this.buildLibrary.activeBuildId = protectedBuildId;
        }
      }
      const ownerId = this.cloudSession.user?.id;
      if (!ownerId) throw new Error("Cloud session is missing a user id.");
      await upsertCloudBuildRows(this.cloudClient, [
        ...this.buildLibrary.builds.map((build) =>
          buildRecordToCloudRow(build, ownerId),
        ),
        ...this.buildLibrary.deletedBuilds.map((tombstone) =>
          tombstoneToCloudRow(tombstone, ownerId),
        ),
      ]);
      this.saveBuildLibrary();
      const active = this.getActiveBuild();
      if (active && !preserveEditorState) {
        this.state = clone(active.state);
        saveLegacyState(this.state, this.storage);
      }
      this.renderFormSafely({ deferWhenEditing: true });
      this.renderCard();
      this.setCloudStatus(
        "synced",
        `Synced ${this.buildLibrary.builds.length} build${
          this.buildLibrary.builds.length === 1 ? "" : "s"
        }`,
      );
      await this.refreshSharedBuilds();
    } catch (error) {
      this.setCloudStatus("failed", `Sync failed: ${errorMessage(error)}`);
    }
  }

  private scheduleCloudSync(): void {
    if (!this.cloudClient || !this.cloudSession) return;
    window.clearTimeout(this.cloudSyncTimer);
    this.setCloudStatus("syncing", "Sync queued");
    this.cloudSyncTimer = window.setTimeout(() => {
      void this.syncBuildLibrary();
    }, 1200);
  }

  private async refreshSharedBuilds(): Promise<void> {
    if (!this.cloudClient || !this.cloudSession || !this.profile) return;
    try {
      this.sharedBuilds = normalizeSharedBuildRows(
        await fetchSharedBuildRows(this.cloudClient),
      );
      if (!this.refs.appShell.hidden) this.renderFormSafely({ deferWhenEditing: true });
    } catch (error) {
      this.setCloudStatus("failed", `Shared builds unavailable: ${errorMessage(error)}`);
    }
  }

  private async publishActiveBuild(): Promise<void> {
    if (this.isPreviewing()) return;
    const active = this.getActiveBuild();
    if (!active) return;
    if (!this.cloudClient || !this.cloudSession?.user?.id) {
      this.refs.saveStatus.textContent = "Sign in before publishing builds.";
      return;
    }
    const publishedAt = new Date().toISOString();
    const publishedBuild = {
      ...active,
      sharedAt: publishedAt,
      state: clone(this.state),
      updatedAt: publishedAt,
    };
    this.refs.saveStatus.textContent = `Publishing: ${active.name}`;
    try {
      await publishBuildShare(
        this.cloudClient,
        buildRecordToShareRow(
          publishedBuild,
          this.cloudSession.user.id,
          publishedAt,
        ),
      );
      await upsertCloudBuildRows(this.cloudClient, [
        buildRecordToCloudRow(publishedBuild, this.cloudSession.user.id),
      ]);
      active.sharedAt = publishedBuild.sharedAt;
      active.state = clone(publishedBuild.state);
      active.updatedAt = publishedBuild.updatedAt;
      this.saveBuildLibrary();
      this.renderFormSafely();
      this.renderCard();
      await this.refreshSharedBuilds();
      this.refs.saveStatus.textContent = `Published: ${active.name}`;
      this.setCloudStatus("synced", `Published ${active.name}`);
    } catch (error) {
      this.refs.saveStatus.textContent = `Publish failed: ${active.name}`;
      this.setCloudStatus("failed", `Publish failed: ${errorMessage(error)}`);
    }
  }

  private async unpublishBuildById(buildId: string): Promise<void> {
    if (!this.cloudClient || !this.cloudSession?.user?.id) {
      this.refs.saveStatus.textContent = "Sign in before unpublishing builds.";
      return;
    }
    const localBuild = this.buildLibrary.builds.find(
      (build) => build.id === buildId,
    );
    const previousSharedPreview = this.sharedPreview?.id === buildId;
    const unpublishedAt = new Date().toISOString();
    const unpublishedBuild = localBuild
      ? { ...localBuild, sharedAt: null, updatedAt: unpublishedAt }
      : null;
    this.refs.saveStatus.textContent = "Unpublishing build...";
    try {
      await deleteBuildShare(this.cloudClient, buildId);
      if (localBuild && unpublishedBuild) {
        await upsertCloudBuildRows(this.cloudClient, [
          buildRecordToCloudRow(unpublishedBuild, this.cloudSession.user.id),
        ]);
        localBuild.sharedAt = null;
        localBuild.updatedAt = unpublishedAt;
        this.saveBuildLibrary();
      }
      if (previousSharedPreview) {
        this.sharedPreview = null;
        if (localBuild) {
          this.activeView = "builder";
          this.buildLibrary.activeBuildId = localBuild.id;
          this.state = clone(localBuild.state);
          this.saveBuildLibrary();
          saveLegacyState(this.state, this.storage);
        }
      }
      await this.refreshSharedBuilds();
      this.updateViewControls();
      this.renderFormSafely();
      this.renderCard();
      this.refs.saveStatus.textContent = localBuild
        ? `Unpublished: ${localBuild.name}`
        : "Unpublished shared build";
      this.setCloudStatus("synced", "Shared build unpublished");
    } catch (error) {
      this.refs.saveStatus.textContent = "Unpublish failed";
      this.setCloudStatus("failed", `Unpublish failed: ${errorMessage(error)}`);
    }
  }

  private async unpublishActiveBuild(): Promise<void> {
    const active = this.getActiveBuild();
    if (!active || this.isPreviewing()) return;
    await this.unpublishBuildById(active.id);
  }

  private exportBuildJson(): void {
    const active = this.getActiveBuild();
    const payload = buildExportPayload({
      library: this.buildLibrary,
      activeBuild: active,
    });
    downloadJsonPayload(payload, `${this.safeBaseFileName()}-build.json`);
  }

  private async importBuildJson(file: File | null | undefined): Promise<void> {
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_JSON_BYTES) {
        throw new Error("Build JSON is too large.");
      }
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const imported = buildLibraryFromImportedPayload(
        this.buildLibrary,
        payload,
      );
      this.buildLibrary = imported.library;
      this.exitSamplePreview();
      this.activeView = "builder";
      this.state = clone(this.getActiveBuild()?.state || defaultState());
      this.saveBuildLibrary();
      saveLegacyState(this.state, this.storage);
      this.renderFormSafely();
      this.renderCard();
      this.refs.saveStatus.textContent = "Build JSON imported";
      this.scheduleCloudSync();
    } catch (error) {
      this.refs.saveStatus.textContent = `Import failed: ${errorMessage(error)}`;
    }
  }

  private saveState(): void {
    if (this.isPreviewing()) {
      this.refs.saveStatus.textContent =
        this.sharedPreview
          ? `Viewing shared build by @${this.sharedPreview.username}. Save As to keep it.`
          : "Previewing Wendy Sample. Save As to keep it.";
      return;
    }
    const active = this.getActiveBuild();
    if (active) {
      active.state = clone(this.state);
      active.updatedAt = new Date().toISOString();
      if (!active.name) active.name = buildNameFromState(this.state);
      this.saveBuildLibrary();
    }
    saveLegacyState(this.state, this.storage);
    this.refs.saveStatus.textContent = active
      ? `Autosaved: ${active.name}`
      : "Autosaved";
    this.scheduleCloudSync();
    if (active?.sharedAt) {
      this.renderFormSafely({ deferWhenEditing: true });
    }
  }

  private enterSamplePreview(): void {
    this.isSamplePreview = true;
    this.sharedPreview = null;
    this.activeView = "builder";
    this.state = wendyState();
    window.clearTimeout(this.cloudSyncTimer);
    this.updateViewControls();
    this.renderFormSafely();
    this.renderCard();
    this.refs.saveStatus.textContent =
      "Previewing Wendy Sample. Save As to keep it.";
  }

  private exitSamplePreview(): void {
    this.isSamplePreview = false;
    this.sharedPreview = null;
  }

  private enterSharedPreview(build: SharedBuild): void {
    this.isSamplePreview = false;
    this.sharedPreview = build;
    this.activeView = "shared";
    this.state = clone(build.state);
    window.clearTimeout(this.cloudSyncTimer);
    this.updateViewControls();
    this.renderFormSafely();
    this.renderCard();
    this.refs.saveStatus.textContent = `Viewing shared build by @${build.username}. Save As to keep it.`;
  }

  private sharedBuildById(buildId: string | undefined): SharedBuild | null {
    if (!buildId) return null;
    return this.sharedBuilds.find((build) => build.id === buildId) || null;
  }

  private saveSharedBuildAs(build: SharedBuild): void {
    this.enterSharedPreview(build);
    this.saveAsBuild();
  }

  private editOriginalSharedBuild(build: SharedBuild): void {
    if (build.ownerId !== this.currentUserId()) return;
    const localBuild = this.buildLibrary.builds.find(
      (item) => item.id === build.id,
    );
    if (localBuild) {
      this.activateBuild(localBuild.id);
      return;
    }
    this.saveSharedBuildAs(build);
  }

  private async unpublishSharedBuild(build: SharedBuild): Promise<void> {
    if (build.ownerId !== this.currentUserId()) {
      this.refs.saveStatus.textContent = "Only the owner can unpublish this build.";
      return;
    }
    await this.unpublishBuildById(build.id);
  }

  private getByPath(path: string): unknown {
    return path.split(".").reduce<unknown>((cursor, part) => {
      if (!cursor || typeof cursor !== "object") return undefined;
      return (cursor as Record<string, unknown>)[part];
    }, this.state);
  }

  private setByPath(path: string, value: unknown): void {
    const parts = path.split(".");
    let cursor: unknown = this.state;
    for (let index = 0; index < parts.length - 1; index += 1) {
      if (!cursor || typeof cursor !== "object") return;
      cursor = (cursor as Record<string, unknown>)[parts[index]];
    }
    if (!cursor || typeof cursor !== "object") return;
    (cursor as Record<string, unknown>)[parts[parts.length - 1]] = value;
  }

  private applyEquipmentSet(value: unknown): void {
    this.state.equipmentSet = normalizeEquipmentSet(value);
    this.state.equipment = equipmentForSet(this.state.equipmentSet);
  }

  private setFieldFromControl(field: FieldControl): void {
    const fieldPath = field.dataset.field;
    if (!fieldPath) return;
    const value =
      field instanceof HTMLInputElement && field.type === "checkbox"
        ? field.checked
        : field.value;
    if (fieldPath === "equipmentSet") {
      this.applyEquipmentSet(value);
      return;
    }
    this.setByPath(
      fieldPath,
      fieldPath === "upgrades.1.body" ? stripUpgradeNoteMarker(value) : value,
    );
  }

  private captureFormSectionState(): void {
    const sections = this.refs.form.querySelectorAll<HTMLDetailsElement>(
      ".form-section[data-section]",
    );
    if (!sections.length) return;
    this.formSectionOpenState = Object.fromEntries(
      Array.from(sections).map((section) => [
        section.dataset.section || "",
        section.open,
      ]),
    );
  }

  private renderFormSafely(options: RenderFormOptions = {}): boolean {
    return this.focus.renderSafely(() => this.renderForm(), options);
  }

  private openSectionForPath(path: string): HTMLDetailsElement | null {
    const key = sectionKeyForControlPath(path);
    if (!key) return null;
    this.formSectionOpenState[key] = true;
    const section = this.refs.form.querySelector<HTMLDetailsElement>(
      `.form-section[data-section="${attrSelectorValue(key)}"]`,
    );
    if (section) section.open = true;
    return section;
  }

  private controlForPath(
    path: string,
    options: ScrollControlOptions = {},
  ): Element | null {
    const attribute = options.picker ? "data-pick-path" : "data-field";
    return this.refs.form.querySelector(
      `[${attribute}="${attrSelectorValue(path)}"]`,
    );
  }

  private scrollControlForPath(
    path: string,
    options: ScrollControlOptions = {},
  ): void {
    this.openSectionForPath(path);
    requestAnimationFrame(() => {
      const target = this.controlForPath(path, options);
      if (!target) return;
      if (options.focus) focusWithoutScrolling(target);
      this.focus.scrollElementInForm(target);
      if (options.focus) focusWithoutScrolling(target);
    });
  }

  private renderForm(): void {
    const scrollState = this.focus.captureScrollState();
    this.captureFormSectionState();
    const magicLinkRemaining = magicLinkCooldownRemaining(this.magicLinkEmail);
    const cloudConfigured = isSupabaseConfigured(getSupabaseConfig());
    this.refs.form.innerHTML = renderFormHtml({
      state: this.state,
      buildLibrary: this.buildLibrary,
      activeBuild: this.getActiveBuild(),
      previewing: this.isPreviewing(),
      cloudStatus: this.cloudStatus,
      cloudUser: this.profile?.username || "",
      cloudConfigured,
      magicLinkEmail: this.magicLinkEmail,
      magicLinkInFlight: this.magicLinkInFlight,
      magicLinkRemaining,
      magicLinkButtonText: this.magicLinkInFlight
        ? "Sending..."
        : magicLinkRemaining > 0
          ? `Try again in ${formatCooldown(magicLinkRemaining)}`
          : "Send magic link",
      activeColors: this.activeColors(),
      formSectionOpenState: this.formSectionOpenState,
      activeView: this.activeView,
      currentUserId: this.currentUserId(),
      profileUsername: this.profile?.username || "",
      previewLabel: this.previewLabel(),
      sharedPreview: this.sharedPreview,
      sharedBuildGroups: groupSharedBuilds(this.sharedBuilds),
    });

    this.updateViewControls();
    this.updateThemeButtons();
    this.updateMagicLinkControls();
    this.focus.restoreScrollState(scrollState);
  }

  private updateThemeButtons(): void {
    document.querySelectorAll<HTMLElement>("[data-theme]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.theme === this.state.theme),
      );
    });
  }

  private renderCard(): void {
    renderCard({
      ctx: this.refs.ctx,
      state: this.state,
      images: this.images,
      colors: this.activeColors(),
      previewTitle: this.refs.previewTitle,
      catalogById,
    });
  }

  private async initializeCloudSync(): Promise<void> {
    const config = getSupabaseConfig();
    if (!isSupabaseConfigured(config)) {
      this.cleanPendingAuthRedirect();
      this.setCloudStatus("local", "Local only");
      this.renderAuthGate("Cloud sign-in is not configured.");
      return;
    }
    try {
      this.setCloudStatus("syncing", "Connecting to cloud...");
      this.cloudClient = await createCloudSync(config, async (session) => {
        this.cloudSession = session;
        if (this.cloudSession) await this.handleAuthenticatedSession();
        else {
          this.profile = null;
          this.sharedBuilds = [];
          this.sharedPreview = null;
          this.activeView = "builder";
          this.renderAuthGate("Signed out. Send a magic link to continue.");
        }
      });
      this.cloudSession =
        this.cloudClient.session || (await refreshSession(this.cloudClient));
      this.cleanPendingAuthRedirect();
      if (this.cloudSession) await this.handleAuthenticatedSession();
      else {
        const message =
          this.authRedirectNotice || "Cloud ready. Send a magic link to continue.";
        this.setCloudStatus("local", message);
        this.renderAuthGate(message);
      }
    } catch (error) {
      this.cleanPendingAuthRedirect();
      this.cloudClient = null;
      this.cloudSession = null;
      this.setCloudStatus(
        "failed",
        `Cloud unavailable: ${errorMessage(error)}`,
      );
      this.renderAuthGate(`Cloud unavailable: ${errorMessage(error)}`);
    }
  }

  private cleanPendingAuthRedirect(): void {
    if (!this.pendingAuthRedirectCleanup) return;
    replaceAuthRedirectUrl();
    this.pendingAuthRedirectCleanup = false;
  }

  private async requestMagicLink(): Promise<void> {
    const input = this.refs.form.querySelector<HTMLInputElement>(
      "[data-cloud-email]",
    );
    const email = normalizeEmail(
      this.refs.authEmail.value || input?.value || this.magicLinkEmail,
    );
    this.magicLinkEmail = email;
    this.refs.authEmail.value = email;

    if (!email) {
      this.setCloudStatus("failed", "Enter an email to sign in.");
      return;
    }
    if (this.magicLinkInFlight) return;

    const remaining = magicLinkCooldownRemaining(email);
    if (remaining > 0) {
      this.setCloudStatus(
        "synced",
        magicLinkCooldownMessage("Magic link sent.", email),
      );
      this.updateMagicLinkControls();
      return;
    }

    this.magicLinkInFlight = true;
    this.updateMagicLinkControls();
    this.setCloudStatus("syncing", "Sending magic link...");

    try {
      if (!this.cloudClient) await this.initializeCloudSync();
      if (!this.cloudClient) return;
      await signInWithMagicLink(this.cloudClient, email);
      writeMagicLinkCooldown(email);
      this.setCloudStatus(
        "synced",
        magicLinkCooldownMessage("Magic link sent. Check your email.", email),
      );
    } catch (error) {
      if (isMagicLinkRateLimitError(error)) {
        writeMagicLinkCooldown(email);
      }
      const message = magicLinkErrorMessage(error);
      this.setCloudStatus(
        "failed",
        rateLimitCode(error) === "over_request_rate_limit"
          ? message
          : magicLinkCooldownMessage(message, email),
      );
    } finally {
      this.magicLinkInFlight = false;
      this.updateMagicLinkControls();
    }
  }

  private handleAuthEmailInput(): void {
    this.magicLinkEmail = normalizeEmail(this.refs.authEmail.value);
    this.updateMagicLinkControls();
  }

  private handleUsernameInput(): void {
    const message = usernameValidationMessage(this.refs.usernameInput.value);
    this.refs.usernameStatus.className = `cloud-status ${message ? "local" : "synced"}`;
    this.refs.usernameStatus.textContent =
      message || `@${normalizeUsername(this.refs.usernameInput.value)} is available to try.`;
  }

  private async handleUsernameSave(): Promise<void> {
    const username = normalizeUsername(this.refs.usernameInput.value);
    const validation = usernameValidationMessage(username);
    if (validation) {
      this.refs.usernameStatus.className = "cloud-status failed";
      this.refs.usernameStatus.textContent = validation;
      return;
    }
    if (!this.cloudClient || !this.cloudSession?.user?.id) {
      this.renderAuthGate("Sign in again before choosing a username.");
      return;
    }
    try {
      this.refs.usernameSave.disabled = true;
      this.refs.usernameStatus.className = "cloud-status syncing";
      this.refs.usernameStatus.textContent = "Saving username...";
      this.profile = await saveUserProfile(this.cloudClient, {
        userId: this.cloudSession.user.id,
        username,
      });
      await this.enterSignedInApp();
    } catch (error) {
      this.refs.usernameStatus.className = "cloud-status failed";
      this.refs.usernameStatus.textContent = isDuplicateUsernameError(error)
        ? "That username is already taken."
        : `Username failed: ${errorMessage(error)}`;
    } finally {
      this.refs.usernameSave.disabled = false;
    }
  }

  private saveAndRender(options: SaveAndRenderOptions = {}): void {
    this.saveState();
    if (options.form) this.renderFormSafely();
    this.renderCard();
    this.updateThemeButtons();
  }

  private activateBuild(buildId: string): void {
    const target = this.buildLibrary.builds.find(
      (build) => build.id === buildId,
    );
    if (!target) return;
    this.exitSamplePreview();
    this.activeView = "builder";
    this.buildLibrary.activeBuildId = target.id;
    this.state = clone(target.state);
    this.saveBuildLibrary();
    this.renderFormSafely();
    this.renderCard();
    this.refs.previewTitle.textContent =
      this.state.title || target.name || "Untitled build";
    this.refs.saveStatus.textContent = `Loaded: ${target.name}`;
    this.scheduleCloudSync();
  }

  private createNewBuild(): void {
    this.exitSamplePreview();
    this.activeView = "builder";
    const record = makeBuildRecord(defaultState(), "Untitled build");
    this.buildLibrary.builds.unshift(record);
    this.buildLibrary.activeBuildId = record.id;
    this.state = clone(record.state);
    this.saveBuildLibrary();
    this.renderFormSafely();
    this.renderCard();
    this.refs.saveStatus.textContent = "New build created";
    this.scheduleCloudSync();
  }

  private saveActiveBuildName(name: string): void {
    if (this.isPreviewing()) return;
    const active = this.getActiveBuild();
    if (!active) return;
    active.name =
      String(name || buildNameFromState(this.state)).trim() || "Untitled build";
    active.state = clone(this.state);
    active.updatedAt = new Date().toISOString();
    this.saveBuildLibrary();
    saveLegacyState(this.state, this.storage);
    this.refs.saveStatus.textContent = `Saved: ${active.name}`;
    this.scheduleCloudSync();
  }

  private saveAsBuild(): void {
    const active = this.getActiveBuild();
    const defaultName = this.sharedPreview
      ? `${this.sharedPreview.name} Copy`
      : this.isSamplePreview
      ? buildNameFromState(this.state)
      : `${active?.name || buildNameFromState(this.state)} Copy`;
    const name = window.prompt("Save build as", defaultName);
    if (!name) return;
    const record = makeBuildRecord(this.state, name);
    this.buildLibrary.builds.unshift(record);
    this.buildLibrary.activeBuildId = record.id;
    this.exitSamplePreview();
    this.activeView = "builder";
    this.state = clone(record.state);
    this.saveBuildLibrary();
    saveLegacyState(this.state, this.storage);
    this.renderFormSafely();
    this.renderCard();
    this.refs.saveStatus.textContent = `Saved as: ${record.name}`;
    this.scheduleCloudSync();
  }

  private duplicateActiveBuild(): void {
    if (this.isPreviewing()) return;
    const active = this.getActiveBuild();
    if (!active) return;
    this.duplicateBuild(active.id);
  }

  private duplicateBuild(buildId: string): void {
    const source = this.buildLibrary.builds.find((build) => build.id === buildId);
    if (!source) return;
    const record = makeBuildRecord(source.state, `${source.name} Copy`);
    this.buildLibrary.builds.unshift(record);
    this.buildLibrary.activeBuildId = record.id;
    this.activeView = "builder";
    this.exitSamplePreview();
    this.state = clone(record.state);
    this.saveBuildLibrary();
    this.renderFormSafely();
    this.renderCard();
    this.refs.saveStatus.textContent = `Duplicated: ${record.name}`;
    this.scheduleCloudSync();
  }

  private deleteActiveBuild(): void {
    if (this.isPreviewing()) return;
    const active = this.getActiveBuild();
    if (!active) return;
    this.deleteBuild(active.id);
  }

  private deleteBuild(buildId: string): void {
    const target = this.buildLibrary.builds.find((build) => build.id === buildId);
    if (!target) return;
    const confirmed = window.confirm(`Delete "${target.name}"?`);
    if (!confirmed) return;
    const wasActive = target.id === this.buildLibrary.activeBuildId;
    const deletedAt = new Date().toISOString();
    this.buildLibrary.deletedBuilds = mergeTombstones(
      this.buildLibrary.deletedBuilds,
      [{ id: target.id, deletedAt }],
    );
    this.buildLibrary.builds = this.buildLibrary.builds.filter(
      (build) => build.id !== target.id,
    );
    if (!this.buildLibrary.builds.length) {
      const replacement = makeBuildRecord(defaultState(), "Untitled build");
      this.buildLibrary.builds.push(replacement);
    }
    if (wasActive) {
      this.exitSamplePreview();
      this.activeView = "builder";
      this.buildLibrary.activeBuildId = this.buildLibrary.builds[0].id;
      this.state = clone(this.buildLibrary.builds[0].state);
    }
    this.saveBuildLibrary();
    this.renderFormSafely();
    this.renderCard();
    this.refs.saveStatus.textContent = "Build deleted";
    this.scheduleCloudSync();
  }

  private renderSavedBuildsModal(): void {
    this.refs.savedBuildsSearch.value = this.savedBuildsQuery;
    this.refs.savedBuildsSort.value = this.savedBuildsSort;
    const allItems = buildSavedBuildItems(this.buildLibrary, {
      activeBuildId: this.buildLibrary.activeBuildId,
      profileUsername: this.profile?.username || "",
    });
    const items = filterAndSortSavedBuilds(allItems, {
      query: this.savedBuildsQuery,
      sort: this.savedBuildsSort,
      filter: this.savedBuildsFilter,
    });
    const model = {
      items,
      totalCount: allItems.length,
      query: this.savedBuildsQuery,
      filter: this.savedBuildsFilter,
    };
    this.refs.savedBuildsSummary.textContent = savedBuildsSummaryText(model);
    this.refs.savedBuildsList.innerHTML = renderSavedBuildsListHtml(model);
    this.refs.savedBuildsModal
      .querySelectorAll<HTMLButtonElement>("[data-saved-build-filter]")
      .forEach((button) => {
        const selected = button.dataset.savedBuildFilter === this.savedBuildsFilter;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
  }

  private openSavedBuildsModal(): void {
    this.renderSavedBuildsModal();
    this.refs.savedBuildsModal.hidden = false;
    requestAnimationFrame(() => this.refs.savedBuildsSearch.focus());
  }

  private closeSavedBuildsModal(): void {
    this.refs.savedBuildsModal.hidden = true;
  }

  private openAssetPicker(kind: PickerKind, path: string): void {
    this.activePicker = renderAssetPicker({
      kind,
      path,
      grid: this.refs.pickerGrid,
      title: this.refs.pickerTitle,
      images: this.images,
    });
    this.refs.pickerModal.hidden = false;
  }

  private closeAssetPicker(): void {
    this.refs.pickerModal.hidden = true;
    this.activePicker = null;
  }

  private safeBaseFileName(): string {
    const active = this.getActiveBuild();
    return safeFileName(this.state.title || active?.name || "card-build");
  }

  private revokeExportUrl(): void {
    if (this.currentExportUrl) {
      URL.revokeObjectURL(this.currentExportUrl);
      this.currentExportUrl = "";
    }
  }

  private showExportPreview(blob: Blob): void {
    this.revokeExportUrl();
    this.currentExportUrl = URL.createObjectURL(blob);
    const filename = `${this.safeBaseFileName()}.png`;
    this.refs.exportPreview.src = this.currentExportUrl;
    this.refs.downloadExport.href = this.currentExportUrl;
    this.refs.downloadExport.download = filename;
    this.refs.openExport.href = this.currentExportUrl;
    this.refs.exportModal.hidden = false;
  }

  private closeExportModal(): void {
    this.refs.exportModal.hidden = true;
    this.refs.exportPreview.removeAttribute("src");
    this.refs.downloadExport.removeAttribute("href");
    this.refs.openExport.removeAttribute("href");
    this.revokeExportUrl();
  }

  private triggerPngDownload(blob: Blob): void {
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${this.safeBaseFileName()}.png`;
      link.href = url;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.warn("Automatic PNG download was blocked.", error);
    }
  }

  private sourcePointFromEvent(event: MouseEvent): { x: number; y: number } {
    return sourcePointFromClientPoint(
      { clientX: event.clientX, clientY: event.clientY },
      this.refs.canvas.getBoundingClientRect(),
      SOURCE_SIZE,
    );
  }

  private focusField(path: string): void {
    this.scrollControlForPath(path, { focus: true });
  }

  private handleCanvasClick(event: MouseEvent): void {
    if (this.activeView === "shared") return;
    const point = this.sourcePointFromEvent(event);
    const region = layoutInteractiveRegions().find((item) =>
      pointInRect(point, item.rect),
    );
    if (!region) return;
    if (region.type === "picker" && region.kind) {
      this.scrollControlForPath(region.path, { picker: true });
      this.openAssetPicker(region.kind, region.path);
    } else {
      this.focusField(region.path);
    }
  }

  private handleCanvasMouseMove(event: MouseEvent): void {
    if (this.activeView === "shared") {
      this.refs.canvas.style.cursor = "default";
      return;
    }
    const point = this.sourcePointFromEvent(event);
    this.refs.canvas.style.cursor = layoutInteractiveRegions().some((item) =>
      pointInRect(point, item.rect),
    )
      ? "pointer"
      : "default";
  }

  private handleFormPointerDown(event: PointerEvent): void {
    const control = closestFromEvent<HTMLElement>(
      event,
      "[data-field], [data-build-name], [data-cloud-email], [data-pick-kind], [data-clear-path], .toggle-field",
    );
    if (control) this.focus.setPendingControlScrollState();
  }

  private handleFormInput(event: Event): void {
    if (this.activeView === "shared") return;
    this.focus.markEditorInput();
    const scrollState = this.focus.capturePendingOrCurrentScrollState();
    const cloudEmail = closestFromEvent<HTMLInputElement>(
      event,
      "[data-cloud-email]",
    );
    if (cloudEmail) {
      this.magicLinkEmail = normalizeEmail(cloudEmail.value);
      this.updateMagicLinkControls();
      this.focus.restoreScrollState(scrollState);
      this.focus.clearPendingControlScrollState();
      return;
    }
    const buildName = closestFromEvent<HTMLInputElement>(
      event,
      "[data-build-name]",
    );
    if (buildName) {
      const active = this.getActiveBuild();
      if (active) {
        active.name = buildName.value.trim() || "Untitled build";
        active.updatedAt = new Date().toISOString();
        this.saveBuildLibrary();
        this.refs.saveStatus.textContent = `Renamed: ${active.name}`;
      }
      this.focus.restoreScrollState(scrollState);
      this.focus.clearPendingControlScrollState();
      return;
    }
    const field = closestFromEvent<Element>(event, "[data-field]");
    if (!isFieldControl(field)) {
      this.focus.clearPendingControlScrollState();
      return;
    }
    this.setFieldFromControl(field);
    this.saveAndRender({ form: false });
    this.focus.restoreScrollState(scrollState);
    if (field instanceof HTMLInputElement && field.type === "checkbox") {
      focusWithoutScrolling(field);
      requestAnimationFrame(() => this.focus.clearPendingControlScrollState());
    } else {
      this.focus.clearPendingControlScrollState();
    }
  }

  private handleFormChange(event: Event): void {
    if (this.activeView === "shared") return;
    this.focus.markEditorInput();
    const scrollState = this.focus.capturePendingOrCurrentScrollState();
    const importFile = closestFromEvent<HTMLInputElement>(
      event,
      "[data-import-json-file]",
    );
    if (importFile) {
      void this.importBuildJson(importFile.files?.[0]);
      importFile.value = "";
      this.focus.clearPendingControlScrollState();
      return;
    }
    const field = closestFromEvent<Element>(event, "[data-field]");
    if (isFieldControl(field)) {
      if (field instanceof HTMLSelectElement) {
        this.setFieldFromControl(field);
        this.saveAndRender({ form: false });
      }
      this.focus.restoreScrollState(scrollState);
    }
    this.focus.clearPendingControlScrollState();
  }

  private handleFormFocusOut(): void {
    if (!this.focus.hasPendingSafeFormRender()) return;
    window.setTimeout(
      () => this.focus.runPendingSafeFormRender(() => this.renderForm()),
      0,
    );
  }

  private handleFormToggle(event: Event): void {
    const section = closestFromEvent<HTMLDetailsElement>(
      event,
      ".form-section[data-section]",
    );
    if (!section) return;
    const sectionKey = section.dataset.section;
    if (sectionKey) this.formSectionOpenState[sectionKey] = section.open;
  }

  private handleSavedBuildsModalInput(event: Event): void {
    const search = closestFromEvent<HTMLInputElement>(
      event,
      "[data-saved-build-search]",
    );
    if (!search) return;
    this.savedBuildsQuery = search.value;
    this.renderSavedBuildsModal();
  }

  private handleSavedBuildsModalChange(event: Event): void {
    const sort = closestFromEvent<HTMLSelectElement>(
      event,
      "[data-saved-build-sort]",
    );
    const value = savedBuildSortFromValue(sort?.value);
    if (!value) return;
    this.savedBuildsSort = value;
    this.renderSavedBuildsModal();
  }

  private handleSavedBuildsModalClick(event: MouseEvent): void {
    if (event.target === this.refs.savedBuildsModal) {
      this.closeSavedBuildsModal();
      return;
    }
    const filter = closestFromEvent<HTMLElement>(
      event,
      "[data-saved-build-filter]",
    );
    if (filter) {
      const value = savedBuildFilterFromValue(filter.dataset.savedBuildFilter);
      if (value) {
        this.savedBuildsFilter = value;
        this.renderSavedBuildsModal();
      }
      return;
    }
    const openButton = closestFromEvent<HTMLElement>(
      event,
      "[data-saved-build-open]",
    );
    if (openButton) {
      const buildId = openButton.dataset.savedBuildOpen;
      if (buildId) {
        this.closeSavedBuildsModal();
        this.activateBuild(buildId);
      }
      return;
    }
    const duplicateButton = closestFromEvent<HTMLElement>(
      event,
      "[data-saved-build-duplicate]",
    );
    if (duplicateButton) {
      const buildId = duplicateButton.dataset.savedBuildDuplicate;
      if (buildId) {
        this.closeSavedBuildsModal();
        this.duplicateBuild(buildId);
      }
      return;
    }
    const deleteButton = closestFromEvent<HTMLElement>(
      event,
      "[data-saved-build-delete]",
    );
    if (deleteButton) {
      const buildId = deleteButton.dataset.savedBuildDelete;
      if (buildId) {
        this.deleteBuild(buildId);
        this.renderSavedBuildsModal();
      }
    }
  }

  private handleFormClick(event: MouseEvent): void {
    const target = eventTargetElement(event);
    if (
      target &&
      !target.closest(
        "[data-field], [data-build-name], [data-cloud-email], .toggle-field",
      )
    ) {
      this.focus.clearPendingControlScrollState();
    }
    if (closestFromEvent(event, "[data-cloud-sign-in]")) {
      void this.requestMagicLink();
      return;
    }
    if (closestFromEvent(event, "[data-cloud-sign-out]")) {
      void this.signOutOfCloud();
      return;
    }
    if (closestFromEvent(event, "[data-cloud-sync]")) {
      void this.syncBuildLibrary();
      return;
    }
    if (closestFromEvent(event, "[data-publish-build]")) {
      void this.publishActiveBuild();
      return;
    }
    if (closestFromEvent(event, "[data-unpublish-build]")) {
      void this.unpublishActiveBuild();
      return;
    }
    const sharedSaveAsButton = closestFromEvent<HTMLElement>(
      event,
      "[data-shared-save-as-id]",
    );
    if (sharedSaveAsButton) {
      const build = this.sharedBuildById(sharedSaveAsButton.dataset.sharedSaveAsId);
      if (build) this.saveSharedBuildAs(build);
      return;
    }
    if (closestFromEvent(event, "[data-shared-save-as]")) {
      if (this.sharedPreview) this.saveSharedBuildAs(this.sharedPreview);
      return;
    }
    const sharedEditOriginalButton = closestFromEvent<HTMLElement>(
      event,
      "[data-shared-edit-original]",
    );
    if (sharedEditOriginalButton) {
      const build = this.sharedBuildById(
        sharedEditOriginalButton.dataset.sharedEditOriginal,
      );
      if (build) this.editOriginalSharedBuild(build);
      return;
    }
    const sharedUnpublishButton = closestFromEvent<HTMLElement>(
      event,
      "[data-shared-unpublish]",
    );
    if (sharedUnpublishButton) {
      const build = this.sharedBuildById(
        sharedUnpublishButton.dataset.sharedUnpublish,
      );
      if (build) void this.unpublishSharedBuild(build);
      return;
    }
    const sharedBuildButton = closestFromEvent<HTMLElement>(
      event,
      "[data-shared-build-id]",
    );
    if (sharedBuildButton) {
      const sharedBuildId = sharedBuildButton.dataset.sharedBuildId;
      const build = this.sharedBuilds.find((item) => item.id === sharedBuildId);
      if (build) this.enterSharedPreview(build);
      return;
    }
    if (closestFromEvent(event, "[data-export-json]")) {
      this.exportBuildJson();
      return;
    }
    if (closestFromEvent(event, "[data-import-json]")) {
      this.refs.form
        .querySelector<HTMLInputElement>("[data-import-json-file]")
        ?.click();
      return;
    }
    if (closestFromEvent(event, "[data-open-saved-builds]")) {
      this.openSavedBuildsModal();
      return;
    }
    if (closestFromEvent(event, "[data-build-new]")) {
      this.createNewBuild();
      return;
    }
    if (closestFromEvent(event, "[data-build-save]")) {
      const nameInput = this.refs.form.querySelector<HTMLInputElement>(
        "[data-build-name]",
      );
      this.saveActiveBuildName(
        nameInput?.value || this.getActiveBuild()?.name || "",
      );
      this.renderFormSafely();
      return;
    }
    if (closestFromEvent(event, "[data-build-save-as]")) {
      this.saveAsBuild();
      return;
    }
    if (closestFromEvent(event, "[data-build-duplicate]")) {
      this.duplicateActiveBuild();
      return;
    }
    if (closestFromEvent(event, "[data-build-delete]")) {
      this.deleteActiveBuild();
      return;
    }
    const pickButton = closestFromEvent<HTMLElement>(event, "[data-pick-kind]");
    if (pickButton) {
      const path = pickButton.dataset.pickPath;
      const kind = pickerKindFromValue(pickButton.dataset.pickKind);
      if (path && kind) {
        this.scrollControlForPath(path, { picker: true });
        this.openAssetPicker(kind, path);
      }
      return;
    }
    const clearButton = closestFromEvent<HTMLElement>(
      event,
      "[data-clear-path]",
    );
    if (clearButton) {
      const clearPath = clearButton.dataset.clearPath;
      if (clearPath) {
        this.setByPath(clearPath, "");
        this.saveAndRender({ form: true });
        this.scrollControlForPath(clearPath, { picker: true });
      }
      return;
    }
    if (closestFromEvent(event, "[data-reset-colors]")) {
      this.state.colors = clone(defaultState().colors);
      this.saveAndRender({ form: true });
    }
  }

  private async signOutOfCloud(): Promise<void> {
    try {
      if (this.cloudClient) await signOut(this.cloudClient);
      this.cloudSession = null;
      this.profile = null;
      this.sharedBuilds = [];
      this.exitSamplePreview();
      this.activeView = "builder";
      this.setCloudStatus("local", "Signed out. Send a magic link to continue.");
      this.renderAuthGate("Signed out. Send a magic link to continue.");
    } catch (error) {
      this.setCloudStatus("failed", `Sign out failed: ${errorMessage(error)}`);
    }
  }

  private handleThemeClick(button: HTMLElement): void {
    if (this.activeView === "shared") return;
    const theme = themeNameFromValue(button.dataset.theme);
    if (!theme) return;
    this.state.theme = theme;
    this.saveAndRender({ form: true });
  }

  private handlePickerGridClick(event: MouseEvent): void {
    const button = closestFromEvent<HTMLElement>(event, "[data-asset-id]");
    if (!button || !this.activePicker) return;
    const assetId = button.dataset.assetId;
    if (!assetId) return;
    const pickedPath = this.activePicker.path;
    this.setByPath(pickedPath, assetId);
    if (this.activePicker.kind === "skill") {
      const labelPath = skillLabelPathForAssetPath(pickedPath);
      if (labelPath) {
        this.setByPath(labelPath, catalogById.get(assetId)?.name || "");
      }
    }
    this.closeAssetPicker();
    this.saveAndRender({ form: true });
    this.scrollControlForPath(pickedPath, { picker: true });
  }

  private handlePickerModalClick(event: MouseEvent): void {
    if (event.target === this.refs.pickerModal) this.closeAssetPicker();
  }

  private handleClearSlotClick(): void {
    if (!this.activePicker) return;
    const clearedPath = this.activePicker.path;
    this.setByPath(clearedPath, "");
    this.closeAssetPicker();
    this.saveAndRender({ form: true });
    this.scrollControlForPath(clearedPath, { picker: true });
  }

  private handleResetClick(): void {
    if (this.activeView === "shared") return;
    const confirmed = window.confirm(
      "Reset this build? This clears the autosaved card.",
    );
    if (!confirmed) return;
    this.state = defaultState();
    this.saveAndRender({ form: true });
  }

  private async handleExportClick(): Promise<void> {
    try {
      this.refs.saveStatus.textContent = "Exporting...";
      await ensureCardFontsReady();
      this.renderCard();
      const blob = await canvasToPngBlob(this.refs.canvas);
      this.showExportPreview(blob);
      this.triggerPngDownload(blob);
      this.refs.saveStatus.textContent = "Export ready";
    } catch (error) {
      this.refs.saveStatus.textContent = "Export failed";
      console.error(error);
    }
  }

  private handleExportModalClick(event: MouseEvent): void {
    if (event.target === this.refs.exportModal) this.closeExportModal();
  }

  private handleWindowKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    if (!this.refs.savedBuildsModal.hidden) this.closeSavedBuildsModal();
    if (!this.refs.pickerModal.hidden) this.closeAssetPicker();
    if (!this.refs.exportModal.hidden) this.closeExportModal();
  }
}
