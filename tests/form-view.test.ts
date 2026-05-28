import { describe, expect, it } from "vitest";
import { renderFormHtml } from "../src/form-view";
import { makeBuildRecord } from "../src/build-library";
import { defaultState, equipmentForSet } from "../src/state-model";
import type { BuildFormViewModel } from "../src/types";

function viewModel(overrides: Partial<BuildFormViewModel> = {}): BuildFormViewModel {
  const state = defaultState();
  state.title = "Wendy";
  const activeBuild = makeBuildRecord(state, "Wendy Build");
  const model = {
    state,
    buildLibrary: {
      schemaVersion: 3,
      activeBuildId: activeBuild.id,
      builds: [activeBuild],
      deletedBuilds: [],
    },
    activeBuild,
    previewing: false,
    cloudStatus: { state: "local", message: "Local only" },
    cloudUser: "",
    cloudConfigured: false,
    magicLinkEmail: "",
    magicLinkInFlight: false,
    magicLinkRemaining: 0,
    magicLinkButtonText: "Send magic link",
    activeColors: {
      title: "#000000",
      muted: "#111111",
      body: "#222222",
      ribbonText: "#333333",
      marker: "#444444",
    },
    formSectionOpenState: {},
    activeView: "builder",
    currentUserId: "user-1",
    profileUsername: "",
    previewLabel: "Preview",
    sharedPreview: null,
    sharedBuildGroups: [],
    ...overrides,
  };
  const activeView: BuildFormViewModel["activeView"] =
    overrides.activeView ?? "builder";
  return {
    ...model,
    activeView,
    currentUserId: model.currentUserId || "user-1",
    sharedPreview: model.sharedPreview || null,
  };
}

describe("form-view", () => {
  it("renders normal build controls and cloud setup help", () => {
    const html = renderFormHtml(viewModel());

    expect(html).toContain('data-build-save ');
    expect(html).toContain('value="Wendy Build"');
    expect(html).toContain("src/supabase-config.ts");
    expect(html).toContain("Send magic link");
  });

  it("renders Wendy preview controls with destructive actions disabled", () => {
    const html = renderFormHtml(viewModel({ previewing: true }));

    expect(html).toContain('value="Preview" disabled');
    expect(html).toContain("data-build-save disabled");
    expect(html).toContain("data-build-duplicate disabled");
    expect(html).toContain("data-build-delete disabled");
    expect(html).toContain("data-build-save-as");
  });

  it("renders equipment set choices and selected state", () => {
    const state = defaultState();
    state.equipmentSet = "hybrid";
    state.equipment = equipmentForSet("hybrid");
    const html = renderFormHtml(viewModel({ state }));

    expect(html).toContain("Choose equipment set");
    expect(html).toContain("Defense - Eternal Daylight Set");
    expect(html).toContain("Attack - Dawn Radiance Set");
    expect(html).toContain('value="hybrid" selected');
  });

  it("escapes user-controlled values", () => {
    const state = defaultState();
    state.title = '<script>alert("x")</script>';
    state.tags = ['Magic"', "<Forest>", "Ancient", ""];
    state.notes = "Use <control> & buffs";
    const activeBuild = makeBuildRecord(state, 'Wendy "Unsafe" <Build>');
    const html = renderFormHtml(
      viewModel({
        state,
        activeBuild,
        buildLibrary: {
          schemaVersion: 3,
          activeBuildId: activeBuild.id,
          builds: [activeBuild],
          deletedBuilds: [],
        },
      }),
    );

    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("Magic&quot;");
    expect(html).toContain("&lt;Forest&gt;");
    expect(html).toContain("Use &lt;control&gt; &amp; buffs");
    expect(html).toContain("Wendy &quot;Unsafe&quot; &lt;Build&gt;");
    expect(html).not.toContain("<script>");
  });

  it("renders split Upgrade 2 usability controls", () => {
    const state = defaultState();
    state.upgrades[1] = {
      title: "2. USABLE & VIABLE?",
      usable: "10 star",
      viable: "11 star a5",
      body: "Elo dependent.",
    };
    const html = renderFormHtml(viewModel({ state }));

    expect(html).toContain("Upgrade Title 2");
    expect(html).toContain("Upgrade Usable");
    expect(html).toContain('data-field="upgrades.1.usable" value="10 star"');
    expect(html).toContain("Upgrade Viable");
    expect(html).toContain('data-field="upgrades.1.viable" value="11 star a5"');
    expect(html).toContain("Upgrade Note 2");
    expect(html).toContain("Elo dependent.");
  });

  it("renders signed-in cloud controls", () => {
    const html = renderFormHtml(
      viewModel({
        cloudConfigured: true,
        profileUsername: "builder",
        cloudStatus: { state: "synced", message: "Synced 1 build" },
      }),
    );

    expect(html).toContain("Signed in as");
    expect(html).toContain("@builder");
    expect(html).toContain("data-cloud-sync");
    expect(html).toContain("data-cloud-sign-out");
    expect(html).not.toContain("Email for cloud sync");
  });

  it("renders shared build groups", () => {
    const html = renderFormHtml(
      viewModel({
        activeView: "shared",
        currentUserId: "user-1",
        profileUsername: "builder",
        sharedBuildGroups: [
          {
            heroName: "Wendy",
            builds: [
              {
                id: "shared-1",
                ownerId: "user-2",
                username: "other_builder",
                heroName: "Wendy",
                name: "Control Wendy",
                state: defaultState(),
                updatedAt: "2026-01-02T00:00:00.000Z",
                sharedAt: "2026-01-03T00:00:00.000Z",
              },
            ],
          },
        ],
      }),
    );

    expect(html).toContain("Shared builds");
    expect(html).toContain("Control Wendy");
    expect(html).toContain("@other_builder");
    expect(html).toContain('data-shared-build-id="shared-1"');
  });
});
