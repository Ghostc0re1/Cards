import { expect, test } from "playwright/test";

const SOURCE_SIZE = { width: 1086, height: 1448 };

async function openBuilder(page, options = {}) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.addInitScript(() => {
    localStorage.clear();
  });

  await page.addInitScript((settings) => {
    const now = new Date().toISOString();
    const session = settings.signedOut
      ? null
      : { user: { id: "user-1", email: "builder@example.com" } };
    const cloudRows = [...(settings.initialCloudRows || [])].map((row) => ({
      owner_id: row.owner_id || "user-1",
      shared_at: row.shared_at || null,
      deleted_at: row.deleted_at || null,
      ...row,
    }));
    const buildShareRows = [...(settings.initialBuildShareRows || [])];
    let sharedBuildSelectCalls = 0;
    let sharedRowsError = null;
    let publishError = settings.publishError
      ? { message: "relation build_shares does not exist" }
      : null;
    let unpublishError = settings.unpublishError
      ? { message: "delete blocked" }
      : null;
    let profileRow = settings.noProfile
      ? null
      : {
          user_id: "user-1",
          username: "builder",
          username_key: "builder",
          created_at: now,
          updated_at: now,
        };
    let otpCalls = 0;

    const sharedRows = () =>
      [
        ...(settings.initialSharedRows || []),
        ...buildShareRows
          .map((row) => ({
            id: row.id,
            owner_id: row.owner_id || "user-1",
            username:
              row.owner_id === "user-1"
                ? profileRow?.username || "builder"
                : row.username || "other_builder",
            hero_name: row.state_json?.title || "Untitled hero",
            name: row.name,
            state_json: row.state_json,
            updated_at: row.updated_at,
            shared_at: row.shared_at,
          })),
      ];

    const filterRows = (rows, filter) =>
      filter ? rows.filter((row) => row[filter.column] === filter.value) : rows;

    window.CARD_BUILDER_SUPABASE = {
      enabled: true,
      url: "https://example.supabase.co",
      anonKey: "test-anon-key",
    };
    window.__CARD_BUILDER_OTP_CALLS__ = () => otpCalls;
    window.__CARD_BUILDER_CLOUD_ROWS__ = () => cloudRows;
    window.__CARD_BUILDER_SHARE_ROWS__ = () => buildShareRows;
    window.__CARD_BUILDER_PROFILE__ = () => profileRow;
    window.__CARD_BUILDER_SHARED_ROWS__ = () => sharedRows();
    window.__CARD_BUILDER_SET_OTP_ERROR__ = (error) => {
      window.__CARD_BUILDER_OTP_ERROR__ = error;
    };
    window.__CARD_BUILDER_SET_SHARED_ROWS_ERROR__ = (error) => {
      sharedRowsError = error;
    };
    window.__CARD_BUILDER_SET_PUBLISH_ERROR__ = (error) => {
      publishError = error;
    };
    window.__CARD_BUILDER_SET_UNPUBLISH_ERROR__ = (error) => {
      unpublishError = error;
    };
    window.__CARD_BUILDER_SUPABASE_CLIENT_FACTORY__ = () => ({
      auth: {
        getSession: async () => ({ data: { session } }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe() {} } },
        }),
        signInWithOtp: async () => {
          otpCalls += 1;
          if (settings.otpDelay) {
            await new Promise((resolve) =>
              setTimeout(resolve, settings.otpDelay),
            );
          }
          return {
            data: {},
            error: window.__CARD_BUILDER_OTP_ERROR__ || null,
          };
        },
        signOut: async () => ({ error: null }),
      },
      from: (table) => {
        let filter = null;
        const schemaError = () => {
          if (table !== settings.schemaErrorTable) return null;
          return {
            message:
              table === "builds"
                ? "column shared_at does not exist"
                : `relation ${table} does not exist`,
          };
        };
        const api = {
          select() {
            return api;
          },
          eq(column, value) {
            filter = { column, value };
            return api;
          },
          maybeSingle() {
            const error = schemaError();
            if (error) return Promise.resolve({ data: null, error });
            if (table === "profiles") {
              return Promise.resolve({
                data: filterRows(profileRow ? [profileRow] : [], filter)[0] || null,
                error: null,
              });
            }
            return Promise.resolve({ data: null, error: null });
          },
          single() {
            const error = schemaError();
            if (error) return Promise.resolve({ data: null, error });
            if (table === "profiles" && profileRow) {
              return Promise.resolve({ data: profileRow, error: null });
            }
            return Promise.resolve({ data: null, error: { message: "No rows" } });
          },
          order() {
            const error = schemaError();
            if (error) return Promise.resolve({ data: null, error });
            if (table === "shared_builds") {
              sharedBuildSelectCalls += 1;
              if (
                sharedRowsError ||
                (settings.sharedRowsErrorAfterPreflight &&
                  sharedBuildSelectCalls > 1)
              ) {
                return Promise.resolve({
                  data: null,
                  error: sharedRowsError || { message: "shared view unavailable" },
                });
              }
              return Promise.resolve({ data: sharedRows(), error: null });
            }
            if (table === "build_shares") {
              return Promise.resolve({
                data: filterRows(buildShareRows, filter),
                error: null,
              });
            }
            if (table === "profiles") {
              return Promise.resolve({
                data: filterRows(profileRow ? [profileRow] : [], filter),
                error: null,
              });
            }
            return Promise.resolve({
              data: filterRows(cloudRows, filter),
              error: null,
            });
          },
          upsert(value) {
            if (table === "profiles") {
              if (settings.duplicateUsername) {
                return {
                  select: () => ({
                    single: async () => ({
                      data: null,
                      error: {
                        code: "23505",
                        message: "duplicate key value violates unique constraint",
                      },
                    }),
                  }),
                };
              }
              profileRow = {
                ...value,
                username_key: String(value.username_key || value.username).toLowerCase(),
                created_at: value.created_at || now,
                updated_at: value.updated_at || now,
              };
              return {
                select: () => ({
                  single: async () => ({ data: profileRow, error: null }),
                }),
              };
            }
            if (table === "build_shares") {
              if (publishError) {
                return {
                  select: () => ({
                    single: async () => ({ data: null, error: publishError }),
                  }),
                };
              }
              const row = value;
              const existingIndex = buildShareRows.findIndex(
                (item) => item.id === row.id,
              );
              if (existingIndex >= 0) {
                buildShareRows.splice(existingIndex, 1, row);
              } else {
                buildShareRows.push(row);
              }
              return {
                select: () => ({
                  single: async () => ({ data: row, error: null }),
                }),
              };
            }
            const rows = Array.isArray(value) ? value : [value];
            cloudRows.splice(0, cloudRows.length, ...rows);
            return {
              select: async () => ({ data: rows, error: null }),
            };
          },
          delete() {
            return {
              eq: async (column, value) => {
                if (unpublishError) {
                  return { data: null, error: unpublishError };
                }
                if (table === "build_shares" && column === "id") {
                  const index = buildShareRows.findIndex(
                    (row) => row.id === value,
                  );
                  if (index >= 0) buildShareRows.splice(index, 1);
                }
                return { data: [], error: null };
              },
            };
          },
        };
        return api;
      },
    });
  }, {
    signedOut: Boolean(options.mockMagicLink || options.signedOut),
    noProfile: Boolean(options.noProfile),
    duplicateUsername: Boolean(options.duplicateUsername),
    otpDelay: options.otpDelay || 0,
    initialCloudRows: options.initialCloudRows || [],
    initialBuildShareRows: options.initialBuildShareRows || [],
    initialSharedRows: options.initialSharedRows || [],
    schemaErrorTable: options.schemaErrorTable || "",
    publishError: Boolean(options.publishError),
    unpublishError: Boolean(options.unpublishError),
    sharedRowsErrorAfterPreflight: Boolean(options.sharedRowsErrorAfterPreflight),
  });

  await page.goto(options.initialPath || "/");
  if (options.expectAuthGate || options.mockMagicLink || options.signedOut) {
    await expect(page.locator("#authGate")).toBeVisible();
  } else if (options.expectUsernameGate || options.noProfile) {
    await expect(page.locator("#usernameGate")).toBeVisible();
  } else {
    await expect(page.locator("#cardCanvas")).toBeVisible();
  }
  await page.waitForTimeout(500);
  return errors;
}

async function clickCanvasSource(page, x, y) {
  const box = await page.locator("#cardCanvas").boundingBox();
  await page.mouse.click(
    box.x + (x / SOURCE_SIZE.width) * box.width,
    box.y + (y / SOURCE_SIZE.height) * box.height,
  );
}

async function activeBuildState(page) {
  return page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem("card-builder-library-v1"));
    const active =
      library.builds.find((build) => build.id === library.activeBuildId) ||
      library.builds[0];
    return active.state;
  });
}

async function buildLibrarySnapshot(page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("card-builder-library-v1")),
  );
}

async function openSavedBuildsModal(page) {
  await page.locator("[data-open-saved-builds]").click();
  await expect(page.locator("#savedBuildsModal")).toBeVisible();
}

async function openSavedBuildById(page, buildId) {
  await openSavedBuildsModal(page);
  await page.locator(`[data-saved-build-open="${buildId}"]`).first().click();
  await expect(page.locator("#savedBuildsModal")).toBeHidden();
}

test("loads the builder without console errors", async ({ page }) => {
  const errors = await openBuilder(page);

  await expect(page).toHaveTitle("Card Builder");
  await expect(page.locator("#saveStatus")).toContainText("Autosaved");
  expect(errors).toEqual([]);
});

test("loads with bundled Supabase and no CDN import errors", async ({ page }) => {
  const errors = await openBuilder(page);

  expect(errors).toEqual([]);
  const scriptSources = await page.evaluate(() =>
    Array.from(document.scripts).map((script) => script.src),
  );
  expect(scriptSources.join("\n")).not.toContain("cdn.jsdelivr.net");
  await expect(page.locator("[data-cloud-status]")).not.toContainText(
    "jsdelivr",
  );
});

test("declares a browser favicon", async ({ page }) => {
  await openBuilder(page);

  await expect(page.locator("link[rel='icon']")).toHaveAttribute(
    "href",
    "/assets/favicon.svg",
  );
});

test("signed-out visitors see the auth gate instead of the builder", async ({
  page,
}) => {
  await openBuilder(page, { signedOut: true, expectAuthGate: true });

  await expect(page.locator("#authGate")).toBeVisible();
  await expect(page.locator("#authSignIn")).toBeVisible();
  await expect(page.locator("#appShell")).toBeHidden();
  await expect(page.locator("#cardCanvas")).toBeHidden();
});

test("signed-out expired magic-link redirects show auth guidance and clean the URL", async ({
  page,
}) => {
  await openBuilder(page, {
    signedOut: true,
    expectAuthGate: true,
    initialPath:
      "/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=",
  });

  await expect(page.locator("#authGate")).toBeVisible();
  await expect(page.locator("#authStatus")).toContainText(
    "invalid or expired",
  );
  expect(page.url()).not.toContain("error=");
  expect(page.url()).not.toContain("otp_expired");
});

test("signed-in expired magic-link redirects keep the cached session and clean the URL", async ({
  page,
}) => {
  await openBuilder(page, {
    initialPath:
      "/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=",
  });

  await expect(page.locator("#cardCanvas")).toBeVisible();
  await expect(page.locator(".cloud-user")).toContainText("@builder");
  expect(page.url()).not.toContain("error=");
  expect(page.url()).not.toContain("otp_expired");

  await page.locator("[data-field='title']").fill("Cached Session Hero");
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__CARD_BUILDER_CLOUD_ROWS__()[0]?.state_json?.title,
      ),
    )
    .toBe("Cached Session Hero");
});

test("first signed-in visit requires a username before entering the builder", async ({
  page,
}) => {
  await openBuilder(page, { noProfile: true, expectUsernameGate: true });

  await expect(page.locator("#usernameGate")).toBeVisible();
  await expect(page.locator("#appShell")).toBeHidden();

  await page.locator("#usernameInput").fill("ab");
  await page.locator("#usernameSave").click();
  await expect(page.locator("#usernameStatus")).toContainText(
    "at least 3 characters",
  );

  await page.locator("#usernameInput").fill("User_One");
  await page.locator("#usernameSave").click();

  await expect(page.locator("#cardCanvas")).toBeVisible();
  await expect(page.locator(".cloud-user")).toContainText("@user_one");
  const profile = await page.evaluate(() => window.__CARD_BUILDER_PROFILE__());
  expect(profile.username).toBe("user_one");
});

test("missing v3 cloud schema blocks the signed-in app with a clear message", async ({
  page,
}) => {
  await openBuilder(page, {
    expectAuthGate: true,
    schemaErrorTable: "build_shares",
  });

  await expect(page.locator("#authGate")).toBeVisible();
  await expect(page.locator("#appShell")).toBeHidden();
  await expect(page.locator("#authStatus")).toContainText(
    "Cloud schema needs v3 migration",
  );
  await expect(page.locator("#authStatus")).toContainText(
    "Run supabase/schema.sql",
  );
});

test("duplicate usernames stay on setup with a friendly error", async ({
  page,
}) => {
  await openBuilder(page, {
    noProfile: true,
    duplicateUsername: true,
    expectUsernameGate: true,
  });

  await page.locator("#usernameInput").fill("taken_name");
  await page.locator("#usernameSave").click();

  await expect(page.locator("#usernameStatus")).toContainText(
    "already taken",
  );
  await expect(page.locator("#usernameGate")).toBeVisible();
  await expect(page.locator("#cardCanvas")).toBeHidden();
});

test("keeps the export canvas and desktop panels sized correctly", async ({ page }) => {
  await openBuilder(page);

  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector("#cardCanvas");
    const panel = document.querySelector(".control-panel").getBoundingClientRect();
    const preview = document.querySelector(".preview-panel").getBoundingClientRect();
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      panelHeight: panel.height,
      previewHeight: preview.height,
      windowY: window.scrollY,
    };
  });

  expect(metrics.canvasWidth).toBe(1080);
  expect(metrics.canvasHeight).toBe(1440);
  expect(Math.abs(metrics.panelHeight - metrics.previewHeight)).toBeLessThan(1);
  expect(metrics.windowY).toBe(0);
});

test("canvas clicks open matching sidebar controls and asset picker", async ({ page }) => {
  await openBuilder(page);

  await clickCanvasSource(page, 543, 86);
  await expect(page.locator("[data-field='title']")).toBeFocused();

  await clickCanvasSource(page, 108, 304);
  await expect(page.locator("#pickerModal")).toBeVisible();
  await expect(page.locator("#pickerTitle")).toHaveText("Choose skill");
});

test("canvas clicks focus the equipment set selector", async ({ page }) => {
  await openBuilder(page);

  await clickCanvasSource(page, 220, 590);

  await expect(page.locator("[data-field='equipmentSet']")).toBeFocused();
  await expect(page.locator("#pickerModal")).toBeHidden();
});

test("canvas clicks focus split upgrade 2 fields", async ({ page }) => {
  await openBuilder(page);
  await page.locator(".canvas-frame").evaluate((frame) => {
    frame.scrollTop = frame.scrollHeight;
  });

  await clickCanvasSource(page, 812, 1048);
  await expect(page.locator("[data-field='upgrades.1.title']")).toBeFocused();

  await clickCanvasSource(page, 760, 1090);
  await expect(page.locator("[data-field='upgrades.1.usable']")).toBeFocused();

  await clickCanvasSource(page, 760, 1114);
  await expect(page.locator("[data-field='upgrades.1.viable']")).toBeFocused();

  await clickCanvasSource(page, 760, 1142);
  await expect(page.locator("[data-field='upgrades.1.body']")).toBeFocused();
});

test("picker selection fills skill labels and keeps the sidebar steady", async ({ page }) => {
  await openBuilder(page);

  await page.locator("details[data-section='main-skills'] > summary").click();
  await page.locator("[data-pick-path='mainSkills.0.assetId']").click();
  await page.locator("[data-asset-id='skill-m-combo']").click();

  await expect(page.locator("[data-field='mainSkills.0.label']")).toHaveValue("M. Combo");
  const scrollState = await page.evaluate(() => ({
    windowY: window.scrollY,
    mainOpen: document.querySelector("[data-section='main-skills']").open,
  }));
  expect(scrollState.windowY).toBe(0);
  expect(scrollState.mainOpen).toBe(true);
});

test("primary toggle does not scroll the window", async ({ page }) => {
  await openBuilder(page);

  await page.locator("details[data-section='main-skills'] > summary").click();
  await page
    .locator("xpath=//input[@data-field='mainSkills.0.marked']/ancestor::label[contains(@class,'toggle-field')]")
    .click();

  await expect(page.locator("[data-field='mainSkills.0.marked']")).toBeChecked();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("export opens a PNG preview modal", async ({ page }) => {
  await openBuilder(page);

  await page.locator("#exportButton").click();
  await expect(page.locator("#exportModal")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#exportPreview")).toHaveAttribute("src", /blob:/);
});

test("magic-link button disables while request is in flight", async ({ page }) => {
  await openBuilder(page, { mockMagicLink: true, otpDelay: 2000 });

  await page.locator("#authEmail").fill("builder@example.com");
  await page.locator("#authSignIn").click();

  await expect(page.locator("#authSignIn")).toBeDisabled();
  await expect(page.locator("#authSignIn")).toHaveText("Sending...");
  await expect(page.locator("#authStatus")).toContainText(
    "Sending magic link",
  );
  await expect
    .poll(() => page.evaluate(() => window.__CARD_BUILDER_OTP_CALLS__()))
    .toBe(1);
});

test("double-clicking magic link sends only one OTP request", async ({ page }) => {
  await openBuilder(page, { mockMagicLink: true });

  await page.locator("#authEmail").fill("builder@example.com");
  await page.locator("#authSignIn").dispatchEvent("click");
  await page.locator("#authSignIn").dispatchEvent("click");

  await expect
    .poll(() => page.evaluate(() => window.__CARD_BUILDER_OTP_CALLS__()))
    .toBe(1);
  await expect(page.locator("#authStatus")).toContainText(
    "Magic link sent",
  );
  await expect(page.locator("#authSignIn")).toBeDisabled();
});

test("successful magic link request starts a local cooldown", async ({ page }) => {
  await openBuilder(page, { mockMagicLink: true });

  await page.locator("#authEmail").fill("BUILDER@example.COM");
  await page.locator("#authSignIn").click();

  await expect(page.locator("#authStatus")).toContainText(
    "Check your email",
  );
  await expect(page.locator("#authStatus")).toContainText(
    "Try again in",
  );
  await expect(page.locator("#authSignIn")).toBeDisabled();
  await expect(page.locator("#authSignIn")).toContainText(
    "Try again in",
  );
});

test("429 magic-link responses show a friendly cooldown message", async ({
  page,
}) => {
  await openBuilder(page, { mockMagicLink: true });
  await page.evaluate(() => {
    window.__CARD_BUILDER_SET_OTP_ERROR__({
      status: 429,
      code: "over_email_send_rate_limit",
      message: "Too Many Requests",
    });
  });

  await page.locator("#authEmail").fill("builder@example.com");
  await page.locator("#authSignIn").click();

  await expect(page.locator("#authStatus")).toContainText(
    "Please wait before requesting another link.",
  );
  await expect(page.locator("#authStatus")).toContainText(
    "Try again in",
  );
  await expect(page.locator("#authSignIn")).toBeDisabled();
});

test("500 magic-link responses show an auth delivery message", async ({
  page,
}) => {
  await openBuilder(page, { mockMagicLink: true });
  await page.evaluate(() => {
    window.__CARD_BUILDER_SET_OTP_ERROR__({
      status: 500,
      code: "unexpected_failure",
      message: "500: Error sending confirmation email",
    });
  });

  await page.locator("#authEmail").fill("builder@example.com");
  await page.locator("#authSignIn").click();

  await expect(page.locator("#authStatus")).toContainText(
    "Email delivery failed in Supabase Auth",
  );
});

test("blocked magic-link requests show a browser or network message", async ({
  page,
}) => {
  await openBuilder(page, { mockMagicLink: true });
  await page.evaluate(() => {
    window.__CARD_BUILDER_SET_OTP_ERROR__(
      new TypeError("Failed to fetch: net::ERR_BLOCKED_BY_CLIENT"),
    );
  });

  await page.locator("#authEmail").fill("builder@example.com");
  await page.locator("#authSignIn").click();

  await expect(page.locator("#authStatus")).toContainText(
    "blocked by the browser or network",
  );
});

test("local build library can save and load a named build", async ({ page }) => {
  await openBuilder(page);

  await page.locator("[data-build-name]").fill("Smoke Build");
  await page.locator("[data-build-save]").click();
  await openSavedBuildsModal(page);
  await expect(page.locator("#savedBuildsList")).toContainText("Smoke Build");
  await page.locator("#closeSavedBuilds").click();

  await page.locator("[data-build-new]").click();
  await openSavedBuildsModal(page);
  await page
    .locator("[data-saved-build-open]")
    .filter({ hasText: "Smoke Build" })
    .first()
    .click();
  await expect(page.locator("[data-build-name]")).toHaveValue("Smoke Build");
});

test("saved builds modal searches sorts filters and opens without overwriting", async ({
  page,
}) => {
  const early = "2026-01-01T00:00:00.000Z";
  const middle = "2026-01-02T00:00:00.000Z";
  const late = "2026-01-03T00:00:00.000Z";
  await openBuilder(page, {
    initialCloudRows: [
      {
        id: "alpha",
        name: "Arena Wendy",
        state_json: { title: "Wendy", tags: ["Arena"], notes: "Control lane" },
        created_at: early,
        updated_at: middle,
        deleted_at: null,
        shared_at: null,
      },
      {
        id: "beta",
        name: "Boss Merlin",
        state_json: { title: "Merlin", tags: ["Boss"], notes: "Frost timing" },
        created_at: early,
        updated_at: late,
        deleted_at: null,
        shared_at: null,
      },
      {
        id: "public",
        name: "Public Gwen",
        state_json: { title: "Gwen", tags: ["Hybrid"], notes: "Published plan" },
        created_at: early,
        updated_at: middle,
        deleted_at: null,
        shared_at: middle,
      },
    ],
  });

  await page.locator("[data-field='title']").fill("Original Hero");
  await expect
    .poll(async () => (await activeBuildState(page)).title)
    .toBe("Original Hero");

  await openSavedBuildsModal(page);
  await expect(page.locator("#savedBuildsList")).toContainText("Arena Wendy");
  await expect(page.locator("#savedBuildsList")).toContainText("Boss Merlin");
  await expect(page.locator("#savedBuildsList")).toContainText("Public Gwen");

  await page.locator("#savedBuildsSearch").fill("frost");
  await expect(page.locator("#savedBuildsList")).toContainText("Boss Merlin");
  await expect(page.locator("#savedBuildsList")).not.toContainText("Arena Wendy");

  await page.locator("#savedBuildsSearch").fill("");
  await page.locator("#savedBuildsSort").selectOption("name");
  await expect(page.locator(".saved-build-name").first()).toHaveText(
    "Arena Wendy",
  );

  await page.locator("[data-saved-build-filter='published']").click();
  await expect(page.locator("#savedBuildsList")).toContainText("Public Gwen");
  await expect(page.locator("#savedBuildsList")).not.toContainText(
    "Boss Merlin",
  );

  await page.locator("[data-saved-build-filter='all']").click();
  await page.locator('[data-saved-build-open="beta"]').first().click();
  await expect(page.locator("[data-build-name]")).toHaveValue("Boss Merlin");
  await expect(page.locator("[data-field='title']")).toHaveValue("Merlin");
  const library = await buildLibrarySnapshot(page);
  expect(
    library.builds.some((build) => build.state.title === "Original Hero"),
  ).toBe(true);
});

test("saved builds modal duplicate and delete row actions update the library", async ({
  page,
}) => {
  const now = new Date().toISOString();
  page.on("dialog", (dialog) => dialog.accept());
  await openBuilder(page, {
    initialCloudRows: [
      {
        id: "modal-target",
        name: "Modal Target",
        state_json: { title: "Target Hero", tags: ["Test"], notes: "Copy me" },
        created_at: now,
        updated_at: now,
        deleted_at: null,
        shared_at: null,
      },
    ],
  });

  await openSavedBuildsModal(page);
  await page.locator('[data-saved-build-duplicate="modal-target"]').click();
  await expect(page.locator("[data-build-name]")).toHaveValue(
    "Modal Target Copy",
  );
  let library = await buildLibrarySnapshot(page);
  expect(library.builds.some((build) => build.name === "Modal Target Copy")).toBe(
    true,
  );

  await openSavedBuildsModal(page);
  await page.locator('[data-saved-build-delete="modal-target"]').click();
  await expect(page.locator('[data-saved-build-row="modal-target"]')).toHaveCount(0);
  library = await buildLibrarySnapshot(page);
  expect(library.builds.some((build) => build.id === "modal-target")).toBe(
    false,
  );
  await page.locator("#closeSavedBuilds").click();
});

test("wendy sample preview does not overwrite the active build", async ({
  page,
}) => {
  await openBuilder(page);

  await page.locator("[data-field='title']").fill("Original Hero");
  await expect
    .poll(async () => (await activeBuildState(page)).title)
    .toBe("Original Hero");

  await page.locator("#sampleButton").click();

  await expect(page.locator("[data-field='title']")).toHaveValue("Wendy");
  await expect(page.locator("#saveStatus")).toContainText(
    "Previewing Wendy Sample",
  );
  await expect(page.locator("[data-build-save]")).toBeDisabled();
  await expect(page.locator("[data-build-name]")).toBeDisabled();
  await expect
    .poll(async () => (await activeBuildState(page)).title)
    .toBe("Original Hero");
});

test("wendy sample preview edits stay unsaved until save as", async ({
  page,
}) => {
  await openBuilder(page);

  await page.locator("[data-field='title']").fill("Original Hero");
  await expect
    .poll(async () => (await activeBuildState(page)).title)
    .toBe("Original Hero");

  await page.locator("#sampleButton").click();
  await page.locator("[data-field='title']").fill("Edited Preview Wendy");
  await page.waitForTimeout(1700);

  await expect(page.locator("[data-field='title']")).toHaveValue(
    "Edited Preview Wendy",
  );
  await expect
    .poll(async () => (await activeBuildState(page)).title)
    .toBe("Original Hero");
});

test("save as from wendy preview creates a real build and resumes autosave", async ({
  page,
}) => {
  await openBuilder(page);

  await page.locator("#sampleButton").click();
  page.once("dialog", (dialog) => {
    expect(dialog.defaultValue()).toBe("Wendy");
    dialog.accept("Wendy Saved");
  });
  await page.locator("[data-build-save-as]").click();

  await expect(page.locator("#saveStatus")).toContainText(
    "Saved as: Wendy Saved",
  );
  await expect(page.locator("[data-build-save]")).toBeEnabled();
  await expect(page.locator("[data-build-name]")).toBeEnabled();
  const library = await buildLibrarySnapshot(page);
  const active = library.builds.find(
    (build) => build.id === library.activeBuildId,
  );
  expect(active.name).toBe("Wendy Saved");
  expect(active.state.title).toBe("Wendy");

  await page.locator("[data-field='title']").fill("Wendy Real Build");
  await expect
    .poll(async () => (await activeBuildState(page)).title)
    .toBe("Wendy Real Build");
});

test("local build JSON import rejects malformed payloads", async ({ page }) => {
  await openBuilder(page);

  await page.locator("[data-import-json-file]").setInputFiles({
    name: "bad-build.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ builds: { nope: true } })),
  });

  await expect(page.locator("#saveStatus")).toContainText("Import failed");
});

test("equipment set selector applies defense attack and hybrid presets", async ({
  page,
}) => {
  await openBuilder(page);
  await page.locator("details[data-section='equipment'] > summary").click();

  const cases = [
    {
      value: "defense",
      label: "Eternal Daylight Set",
      assets: [
        "equipment-def-sword",
        "equipment-def-chest",
        "equipment-def-ring",
        "equipment-def-boots",
      ],
    },
    {
      value: "attack",
      label: "Dawn Radiance Set",
      assets: [
        "equipment-atk-sword",
        "equipment-atk-chest",
        "equipment-atk-ring",
        "equipment-atk-boots",
      ],
    },
    {
      value: "hybrid",
      label: "Hybrid Set",
      assets: [
        "equipment-atk-sword",
        "equipment-def-chest",
        "equipment-atk-ring",
        "equipment-def-boots",
      ],
    },
  ];

  for (const expected of cases) {
    await page.locator("[data-field='equipmentSet']").selectOption(expected.value);
    await expect(page.locator("[data-field='equipmentSet']")).toHaveValue(
      expected.value,
    );
    const selectedLabel = await page
      .locator("[data-field='equipmentSet']")
      .evaluate((select) => select.selectedOptions[0].textContent);
    expect(selectedLabel).toContain(expected.label);

    const state = await activeBuildState(page);
    expect(state.equipmentSet).toBe(expected.value);
    expect(state.equipment.map((item) => item.assetId)).toEqual(
      expected.assets,
    );
  }
});

test("legacy hybrid equipment imports as hybrid set", async ({ page }) => {
  await openBuilder(page);

  const now = new Date().toISOString();
  await page.locator("[data-import-json-file]").setInputFiles({
    name: "legacy-hybrid-equipment.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        builds: [
          {
            id: "legacy-hybrid-equipment",
            name: "Legacy Hybrid Equipment",
            createdAt: now,
            updatedAt: now,
            state: {
              title: "Legacy Hybrid Equipment",
              equipment: [
                { assetId: "equipment-atk-sword" },
                { assetId: "equipment-def-chest" },
                { assetId: "equipment-atk-ring" },
                { assetId: "equipment-def-boots" },
              ],
            },
          },
        ],
      }),
    ),
  });

  await expect(page.locator("#saveStatus")).toContainText("Build JSON imported");
  await expect(page.locator("[data-field='equipmentSet']")).toHaveValue("hybrid");
  const state = await activeBuildState(page);
  expect(state.equipmentSet).toBe("hybrid");
  expect(state.equipment.map((item) => item.assetId)).toEqual([
    "equipment-atk-sword",
    "equipment-def-chest",
    "equipment-atk-ring",
    "equipment-def-boots",
  ]);
});

test("legacy custom equipment keeps icons without selecting a set", async ({
  page,
}) => {
  await openBuilder(page);

  const now = new Date().toISOString();
  const customAssets = [
    "equipment-def-sword",
    "equipment-atk-chest",
    "equipment-def-ring",
    "equipment-atk-boots",
  ];
  await page.locator("[data-import-json-file]").setInputFiles({
    name: "legacy-custom-equipment.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        builds: [
          {
            id: "legacy-custom-equipment",
            name: "Legacy Custom Equipment",
            createdAt: now,
            updatedAt: now,
            state: {
              title: "Legacy Custom Equipment",
              equipment: customAssets.map((assetId) => ({ assetId })),
            },
          },
        ],
      }),
    ),
  });

  await expect(page.locator("#saveStatus")).toContainText("Build JSON imported");
  await expect(page.locator("[data-field='equipmentSet']")).toHaveValue("");
  const state = await activeBuildState(page);
  expect(state.equipmentSet).toBe("");
  expect(state.equipment.map((item) => item.assetId)).toEqual(customAssets);
});

test("upgrade 2 usability fields save separately", async ({ page }) => {
  await openBuilder(page);

  await page.locator("details[data-section='how-i-upgraded'] > summary").click();
  await page.locator("[data-field='upgrades.1.usable']").fill("10 \u2b50");
  await page.locator("[data-field='upgrades.1.viable']").fill("11 \u2b50 a5");
  await page
    .locator("[data-field='upgrades.1.body']")
    .fill(
      "\u2020Usability and Viability are based on elo. This could be very different depending on numerous factors.",
    );

  const upgrade = await page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem("card-builder-library-v1"));
    return library.builds[0].state.upgrades[1];
  });
  expect(upgrade.usable).toBe("10 \u2b50");
  expect(upgrade.viable).toBe("11 \u2b50 a5");
  expect(upgrade.body).toBe(
    "Usability and Viability are based on elo. This could be very different depending on numerous factors.",
  );
});

test("legacy upgrade 2 body imports into usability fields", async ({ page }) => {
  await openBuilder(page);

  const now = new Date().toISOString();
  const note =
    "Usability and Viability are based on elo. This could be very different depending on numerous factors.";
  await page.locator("[data-import-json-file]").setInputFiles({
    name: "legacy-upgrade-build.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        builds: [
          {
            id: "legacy-upgrade-build",
            name: "Legacy Upgrade Build",
            createdAt: now,
            updatedAt: now,
            state: {
              title: "Legacy Upgrade Build",
              upgrades: [
                { title: "1. PROGRESSION", body: "" },
                {
                  title: "2. USABLE & VIABLE?",
                  body: `\u25b8 Usable: 10 \u2b50\n\u25b8 Viable: 11 \u2b50 a5\n\u2020${note}`,
                },
              ],
            },
          },
        ],
      }),
    ),
  });

  await expect(page.locator("#saveStatus")).toContainText("Build JSON imported");
  await expect(page.locator("[data-field='upgrades.1.usable']")).toHaveValue(
    "10 \u2b50",
  );
  await expect(page.locator("[data-field='upgrades.1.viable']")).toHaveValue(
    "11 \u2b50 a5",
  );
  await expect(page.locator("[data-field='upgrades.1.body']")).toHaveValue(note);
});

test("mocked cloud sync signs in and syncs local builds", async ({ page }) => {
  await openBuilder(page, { mockCloud: true });

  await expect(page.locator("[data-cloud-status]")).toContainText("Synced");
  await expect(page.locator(".cloud-user")).toContainText("@builder");

  await page.locator("[data-build-name]").fill("Cloud Smoke Build");
  await page.locator("[data-build-save]").click();
  await page.locator("[data-cloud-sync]").click();

  await expect(page.locator("[data-cloud-status]")).toContainText("Synced");
});

test("sharing a build updates cloud state and appears in shared builds", async ({
  page,
}) => {
  await openBuilder(page);

  await page.locator("[data-field='title']").fill("Shared Wendy");
  await page.locator("[data-build-name]").fill("Public Wendy");
  await page.locator("[data-build-save]").click();
  await page.locator("[data-publish-build]").click();
  await expect(page.locator("#saveStatus")).toContainText(
    "Published: Public Wendy",
  );

  await expect(page.locator("[data-cloud-status]")).toContainText("Synced");
  await page.locator("#sharedTab").click();
  await expect(page.locator("[data-section='shared-builds']")).toContainText(
    "Shared Wendy",
  );
  await expect(page.locator("[data-section='shared-builds']")).toContainText(
    "Public Wendy",
  );
  await expect(page.locator("[data-section='shared-builds']")).toContainText(
    "@builder",
  );

  const sharedRow = await page.evaluate(() =>
    window
      .__CARD_BUILDER_SHARE_ROWS__()
      .find((row) => row.name === "Public Wendy"),
  );
  expect(sharedRow.shared_at).toBeTruthy();
});

test("failed publish does not mark the local build as published", async ({
  page,
}) => {
  await openBuilder(page, { publishError: true });

  await page.locator("[data-field='title']").fill("Publish Failure Wendy");
  await page.locator("[data-build-name]").fill("Publish Failure");
  await page.locator("[data-build-save]").click();
  await page.locator("[data-publish-build]").click();

  await expect(page.locator("#saveStatus")).toContainText("Publish failed");
  await expect(page.locator("[data-cloud-status]")).toContainText(
    "Publish failed",
  );
  const library = await buildLibrarySnapshot(page);
  const active = library.builds.find(
    (build) => build.id === library.activeBuildId,
  );
  expect(active.sharedAt).toBeNull();
  expect(await page.evaluate(() => window.__CARD_BUILDER_SHARE_ROWS__())).toEqual(
    [],
  );
  await expect(page.locator("[data-publish-build]")).toHaveText("Publish build");
});

test("shared builds open read-only and save as copies to the user library", async ({
  page,
}) => {
  const now = new Date().toISOString();
  await openBuilder(page, {
    initialSharedRows: [
      {
        id: "shared-merlin",
        owner_id: "user-2",
        username: "other_builder",
        hero_name: "Merlin",
        name: "Public Merlin",
        state_json: { title: "Shared Merlin" },
        updated_at: now,
        shared_at: now,
      },
    ],
  });

  await page.locator("[data-field='title']").fill("Original Hero");
  await expect
    .poll(async () => (await activeBuildState(page)).title)
    .toBe("Original Hero");

  await page.locator("#sharedTab").click();
  await page.locator("[data-shared-build-id='shared-merlin']").click();

  await expect(page.locator("[data-field='title']")).toHaveCount(0);
  await expect(page.locator("#saveStatus")).toContainText(
    "Viewing shared build by @other_builder",
  );
  await expect(page.locator("[data-build-save]")).toHaveCount(0);
  await expect(page.locator("[data-publish-build]")).toHaveCount(0);
  await expect
    .poll(async () => (await activeBuildState(page)).title)
    .toBe("Original Hero");

  page.once("dialog", (dialog) => {
    expect(dialog.defaultValue()).toBe("Public Merlin Copy");
    dialog.accept("Copied Merlin");
  });
  await page.locator("[data-shared-save-as]").click();

  await expect(page.locator("#saveStatus")).toContainText(
    "Saved as: Copied Merlin",
  );
  await expect(page.locator("[data-build-save]")).toBeEnabled();
  await expect(page.locator("#builderTab")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const library = await buildLibrarySnapshot(page);
  const active = library.builds.find(
    (build) => build.id === library.activeBuildId,
  );
  expect(active.name).toBe("Copied Merlin");
  expect(active.state.title).toBe("Shared Merlin");
});

test("shared preview stays read-only when shared refresh fails", async ({
  page,
}) => {
  const now = new Date().toISOString();
  await openBuilder(page, {
    initialSharedRows: [
      {
        id: "shared-refresh-failure",
        owner_id: "user-2",
        username: "other_builder",
        hero_name: "Merlin",
        name: "Refresh Failure Merlin",
        state_json: { title: "Refresh Failure Merlin" },
        updated_at: now,
        shared_at: now,
      },
    ],
  });

  await page.locator("#sharedTab").click();
  await page.locator("[data-shared-build-id='shared-refresh-failure']").click();
  await page.evaluate(() => {
    window.__CARD_BUILDER_SET_SHARED_ROWS_ERROR__({
      message: "shared view unavailable",
    });
  });
  await page.locator("[data-cloud-sync]").click();

  await expect(page.locator("[data-cloud-status]")).toContainText(
    "Shared builds unavailable",
  );
  await expect(page.locator("[data-field='title']")).toHaveCount(0);
  await expect(page.locator("[data-build-save]")).toHaveCount(0);
  await expect(page.locator("#saveStatus")).toContainText(
    "Viewing shared build by @other_builder",
  );
  await expect
    .poll(async () => (await activeBuildState(page)).title)
    .toBe("");
});

test("editing a published build stays private until publish changes", async ({
  page,
}) => {
  await openBuilder(page);

  await page.locator("[data-field='title']").fill("Published Wendy");
  await page.locator("[data-build-name]").fill("Public Wendy");
  await page.locator("[data-build-save]").click();
  await page.locator("[data-publish-build]").click();
  await expect(page.locator("#saveStatus")).toContainText(
    "Published: Public Wendy",
  );

  await page.locator("[data-field='title']").fill("Private Wendy Edit");
  await expect
    .poll(async () => (await activeBuildState(page)).title)
    .toBe("Private Wendy Edit");
  await expect(page.locator("[data-publish-build]")).toHaveText(
    "Publish changes",
    { timeout: 3000 },
  );

  await page.locator("#sharedTab").click();
  await expect(page.locator("[data-section='shared-builds']")).toContainText(
    "Published Wendy",
  );
  await expect(page.locator("[data-section='shared-builds']")).not.toContainText(
    "Private Wendy Edit",
  );
  let shareRows = await page.evaluate(() => window.__CARD_BUILDER_SHARE_ROWS__());
  expect(shareRows[0].state_json.title).toBe("Published Wendy");

  await page.locator("#builderTab").click();
  await page.locator("[data-publish-build]").click();
  await expect(page.locator("#saveStatus")).toContainText(
    "Published: Public Wendy",
  );
  shareRows = await page.evaluate(() => window.__CARD_BUILDER_SHARE_ROWS__());
  expect(shareRows[0].state_json.title).toBe("Private Wendy Edit");
});

test("owners can edit originals and unpublish shared rows", async ({ page }) => {
  const now = new Date().toISOString();
  await openBuilder(page, {
    initialCloudRows: [
      {
        id: "owner-build",
        owner_id: "user-1",
        name: "Owner Public",
        state_json: { title: "Owner Wendy" },
        created_at: now,
        updated_at: now,
        deleted_at: null,
        shared_at: now,
      },
    ],
    initialBuildShareRows: [
      {
        id: "owner-build",
        owner_id: "user-1",
        name: "Owner Public",
        state_json: { title: "Owner Wendy" },
        updated_at: now,
        shared_at: now,
      },
    ],
  });

  await page.locator("#sharedTab").click();
  await expect(page.locator("[data-section='shared-builds']")).toContainText(
    "Owner Public",
  );
  await page.locator("[data-shared-edit-original='owner-build']").first().click();
  await expect(page.locator("#builderTab")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("[data-build-name]")).toHaveValue("Owner Public");
  await expect(page.locator("[data-field='title']")).toHaveValue("Owner Wendy");

  await page.locator("#sharedTab").click();
  await page.locator("[data-shared-unpublish='owner-build']").first().click();
  await expect(page.locator("#saveStatus")).toContainText("Unpublished");
  await expect(page.locator("[data-section='shared-builds']")).not.toContainText(
    "Owner Public",
  );
  const shareRows = await page.evaluate(() => window.__CARD_BUILDER_SHARE_ROWS__());
  expect(shareRows).toEqual([]);
  const library = await buildLibrarySnapshot(page);
  const original = library.builds.find((build) => build.id === "owner-build");
  expect(original.sharedAt).toBeNull();
});

test("failed unpublish keeps the local published status and shared row", async ({
  page,
}) => {
  const now = new Date().toISOString();
  await openBuilder(page, {
    unpublishError: true,
    initialCloudRows: [
      {
        id: "owner-build",
        owner_id: "user-1",
        name: "Owner Public",
        state_json: { title: "Owner Wendy" },
        created_at: now,
        updated_at: now,
        deleted_at: null,
        shared_at: now,
      },
    ],
    initialBuildShareRows: [
      {
        id: "owner-build",
        owner_id: "user-1",
        name: "Owner Public",
        state_json: { title: "Owner Wendy" },
        updated_at: now,
        shared_at: now,
      },
    ],
  });

  await openSavedBuildById(page, "owner-build");
  await page.locator("[data-unpublish-build]").click();

  await expect(page.locator("#saveStatus")).toContainText("Unpublish failed");
  await expect(page.locator("[data-cloud-status]")).toContainText(
    "Unpublish failed",
  );
  const library = await buildLibrarySnapshot(page);
  const original = library.builds.find((build) => build.id === "owner-build");
  expect(original.sharedAt).toBe(now);
  expect(await page.evaluate(() => window.__CARD_BUILDER_SHARE_ROWS__())).toHaveLength(
    1,
  );
});

test("cloud sync preserves focused text fields while typing", async ({ page }) => {
  await openBuilder(page, { mockCloud: true });

  const titleField = page.locator("[data-field='title']");
  await titleField.fill("Cloud Focus Hero");
  await expect(titleField).toBeFocused();

  await page.waitForTimeout(3200);

  await expect(titleField).toBeFocused();
  await expect(titleField).toHaveValue("Cloud Focus Hero");
  await expect
    .poll(async () => (await activeBuildState(page)).title)
    .toBe("Cloud Focus Hero");
});

test("cloud build deletion does not resurrect after sync", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await openBuilder(page, { mockCloud: true });

  await page.locator("[data-build-name]").fill("Delete Smoke Build");
  await page.locator("[data-build-save]").click();
  await page.locator("[data-cloud-sync]").click();
  await expect(page.locator("[data-cloud-status]")).toContainText("Synced");

  await page.locator("[data-build-delete]").click();
  await openSavedBuildsModal(page);
  await expect(page.locator("#savedBuildsList")).not.toContainText(
    "Delete Smoke Build",
  );
  await page.locator("#closeSavedBuilds").click();
  await page.locator("[data-cloud-sync]").click();

  await expect(page.locator("[data-cloud-status]")).toContainText("Synced");
  await openSavedBuildsModal(page);
  await expect(page.locator("#savedBuildsList")).not.toContainText(
    "Delete Smoke Build",
  );
  await page.locator("#closeSavedBuilds").click();
  const cloudRows = await page.evaluate(() => window.__CARD_BUILDER_CLOUD_ROWS__());
  expect(cloudRows.some((row) => row.name === "Delete Smoke Build")).toBe(
    false,
  );
  expect(cloudRows.some((row) => row.deleted_at)).toBe(true);
});

test("tombstoned cloud builds are hidden during sync", async ({ page }) => {
  const now = new Date().toISOString();
  await openBuilder(page, {
    mockCloud: true,
    initialCloudRows: [
      {
        id: "cloud-live",
        name: "Live Cloud Build",
        state_json: { title: "Live Cloud Build" },
        created_at: now,
        updated_at: now,
        deleted_at: null,
      },
      {
        id: "cloud-deleted",
        name: "Deleted Cloud Build",
        state_json: { title: "Deleted Cloud Build" },
        created_at: now,
        updated_at: now,
        deleted_at: now,
      },
    ],
  });

  await expect(page.locator("[data-cloud-status]")).toContainText("Synced");
  await openSavedBuildsModal(page);
  await expect(page.locator("#savedBuildsList")).toContainText(
    "Live Cloud Build",
  );
  await expect(page.locator("#savedBuildsList")).not.toContainText(
    "Deleted Cloud Build",
  );
  await page.locator("#closeSavedBuilds").click();
});
