import type { SavedBuildFilter, SavedBuildListItem } from "./saved-builds";
import { savedBuildFilterLabel } from "./saved-builds";

export interface SavedBuildsModalViewModel {
  items: SavedBuildListItem[];
  totalCount: number;
  query: string;
  filter: SavedBuildFilter;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildCountLabel(count: number): string {
  return `${count} ${count === 1 ? "build" : "builds"}`;
}

function emptyStateHtml(model: SavedBuildsModalViewModel): string {
  if (!model.totalCount) {
    return `
      <div class="saved-builds-empty">
        <strong>No saved builds yet</strong>
        <span>Create or save a build to add it here.</span>
      </div>
    `;
  }
  const filterLabel = savedBuildFilterLabel(model.filter).toLowerCase();
  const searchLabel = model.query ? ` matching "${model.query}"` : "";
  return `
    <div class="saved-builds-empty">
      <strong>No ${escapeHtml(filterLabel)} builds found</strong>
      <span>Try a different search or filter${escapeHtml(searchLabel)}.</span>
    </div>
  `;
}

export function renderSavedBuildsListHtml(
  model: SavedBuildsModalViewModel,
): string {
  if (!model.items.length) return emptyStateHtml(model);
  return model.items
    .map(
      (item) => `
        <article class="saved-build-row ${item.isActive ? "active" : ""}" data-saved-build-row="${escapeHtml(item.id)}">
          <button type="button" class="saved-build-main" data-saved-build-open="${escapeHtml(item.id)}">
            <span class="saved-build-name">${escapeHtml(item.name)}</span>
            <span class="saved-build-meta">
              <strong>${escapeHtml(item.heroName)}</strong>
              <span>${escapeHtml(item.tagSummary)}</span>
            </span>
            <span class="saved-build-meta">
              <span>Updated ${escapeHtml(item.updatedLabel)}</span>
              <span class="saved-build-status ${item.hasLocalChanges ? "local" : item.isPublished ? "published" : "private"}">${escapeHtml(item.statusLabel)}</span>
              ${item.isActive ? `<span class="saved-build-status active">Active</span>` : ""}
            </span>
          </button>
          <div class="saved-build-row-actions">
            <button type="button" class="clear-button" data-saved-build-open="${escapeHtml(item.id)}">Open</button>
            <button type="button" class="clear-button" data-saved-build-duplicate="${escapeHtml(item.id)}">Duplicate</button>
            <button type="button" class="danger-button" data-saved-build-delete="${escapeHtml(item.id)}">Delete</button>
          </div>
        </article>
      `,
    )
    .join("");
}

export function savedBuildsSummaryText(
  model: SavedBuildsModalViewModel,
): string {
  if (!model.totalCount) return "No saved builds";
  if (model.items.length === model.totalCount) {
    return `Showing ${buildCountLabel(model.totalCount)}`;
  }
  return `Showing ${buildCountLabel(model.items.length)} of ${buildCountLabel(model.totalCount)}`;
}
