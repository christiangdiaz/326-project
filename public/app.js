// Keyboard focus management for the HTMX delete interaction.
//
// The Delete button lives *inside* the <article> that hx-swap="outerHTML"
// removes, so without this the focused element is destroyed mid-interaction:
// focus silently falls back to <body>, a keyboard user is thrown to the top of
// the document, and a screen reader announces nothing at all. Unit 16's
// keyboard walkthrough is exactly what catches this.
//
// Note on event choice: htmx:afterSwap and htmx:afterSettle are dispatched on
// the element that was swapped. When that element is *removed* (an outerHTML
// swap against an empty response, which is what a delete is) the event fires on
// a detached node and never bubbles up to document.body, so a listener here
// never runs. htmx:beforeSwap still fires while the article is attached, and
// htmx:afterRequest fires once the swap is finished and does reach the body.
// Those are the two we hang off.

const statusRegion = () => document.getElementById("delete-status");

let pendingFocus = null;
let pendingMessage = "";

function announce(message) {
  const region = statusRegion();

  if (!region) return;

  // Clear first so the live region re-announces even when the new message is
  // identical to the previous one (two blocked deletes in a row, say).
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = message;
  }, 50);
}

function clearPending() {
  pendingFocus = null;
  pendingMessage = "";
}

// Runs while the article is still in the document, so we can still look at its
// neighbours and work out where focus should land once it is gone.
document.body.addEventListener("htmx:beforeSwap", (event) => {
  const article = event.detail.target;

  if (!article?.matches?.("article[data-report-unit]")) return;

  const articles = [
    ...document.querySelectorAll("article[data-report-unit]")
  ];

  const index = articles.indexOf(article);
  const neighbour = articles[index + 1] || articles[index - 1];

  // Prefer the next report's Delete button so repeated deletions stay usable
  // from the keyboard; fall back to the list heading once the list empties.
  pendingFocus =
    neighbour?.querySelector("button") ||
    document.getElementById("reports-heading");

  pendingMessage = `Report for unit ${article.dataset.reportUnit} deleted.`;
});

document.body.addEventListener("htmx:afterRequest", (event) => {
  const status = event.detail.xhr?.status;

  if (event.detail.successful) {
    if (!pendingFocus) return;

    pendingFocus.focus();
    announce(pendingMessage);
    clearPending();

    return;
  }

  // HTMX only swaps on 2xx, so on a 403 from the service-layer ownership check
  // nothing moves and focus is still sitting on the Delete button. Without an
  // announcement the click is completely silent and the user is left guessing.
  const messages = {
    401: "You must be logged in to delete a report.",
    403: "You can only delete your own reports.",
    404: "That report no longer exists."
  };

  clearPending();
  announce(messages[status] || "That report could not be deleted.");
});
