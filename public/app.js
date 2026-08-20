// Client-side behaviour for the report board.
//
// Two jobs, both about not losing the user:
//
//   1. Keyboard focus and announcements around htmx swaps. A swap can destroy
//      the element the user is standing on, and a failed swap changes nothing
//      at all — either way a screen reader says nothing unless we say it.
//   2. Live updates over Server-Sent Events, offered rather than applied, so
//      the list is never rewritten under someone mid-read.
//
// Note on event choice for (1): htmx:afterSwap and htmx:afterSettle are
// dispatched on the element that was swapped. When that element is *removed*
// (an outerHTML swap against an empty response, which is what a delete is)
// they fire on a detached node and never reach document.body. htmx:beforeSwap
// still fires while the card is attached, and htmx re-fires htmx:afterRequest
// on the nearest surviving ancestor when the original element is gone, so
// those two are the pair that always run.

const byId = (id) => document.getElementById(id);

/* ---------- announcements ---------------------------------------------- */

function announce(message) {
  const region = byId("delete-status");

  if (!region) return;

  // Cleared first so the live region re-announces even when the new message is
  // identical to the previous one (two blocked deletes in a row, say).
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = message;
  }, 50);
}

/* ---------- focus management across htmx swaps -------------------------- */

let pending = null;

// Suppresses the live-update banner for changes this tab just made: the
// server broadcasts to every listener including the one that caused it.
let ignoreEventsUntil = 0;

function deleteIntent(card) {
  const cards = [...document.querySelectorAll("article[data-report-unit]")];
  const index = cards.indexOf(card);
  const neighbour = cards[index + 1] || cards[index - 1];

  return {
    // Prefer the next report's Delete button so repeated deletions stay usable
    // from the keyboard; fall back to the list heading once the list empties.
    focus: () =>
      neighbour?.querySelector("[hx-delete]") || byId("reports-heading"),
    message: `Report for unit ${card.dataset.reportUnit} deleted.`
  };
}

function statusIntent(card) {
  const id = card.id;
  const unit = card.dataset.reportUnit;

  return {
    // Resolved after the swap: the card with this id is a different element by
    // then, so the button has to be looked up again rather than held onto.
    focus: () => byId(id)?.querySelector("select"),
    messageAfter: () =>
      `Unit ${unit} marked ${byId(id)?.dataset.reportStatus ?? "updated"}.`
  };
}

document.body.addEventListener("htmx:beforeSwap", (event) => {
  const card = event.detail.target;

  if (!card?.matches?.("article[data-report-unit]")) return;

  pending =
    event.detail.requestConfig?.verb === "delete"
      ? deleteIntent(card)
      : statusIntent(card);
});

document.body.addEventListener("htmx:afterRequest", (event) => {
  const status = event.detail.xhr?.status;
  const intent = pending;

  pending = null;
  ignoreEventsUntil = Date.now() + 1500;

  if (event.detail.successful) {
    if (!intent) return;

    intent.focus()?.focus();
    announce(intent.messageAfter ? intent.messageAfter() : intent.message);

    return;
  }

  // htmx only swaps on 2xx, so on a 403 from the service-layer ownership check
  // nothing moves and focus is still sitting on the button that was pressed.
  // Without an announcement the click is completely silent.
  const messages = {
    401: "You must be logged in to do that.",
    403: "You can only change your own reports.",
    404: "That report no longer exists.",
    429: "Too many requests. Please wait a moment and try again."
  };

  announce(messages[status] || "That change could not be saved.");
});

/* ---------- live updates over Server-Sent Events ------------------------ */

// Refetches the current URL — filters and all — and swaps in just the list, so
// a live refresh respects whatever the reader is currently filtered to.
async function refreshList() {
  const response = await fetch(window.location.href, {
    headers: { Accept: "text/html" }
  });

  if (!response.ok) return false;

  const parsed = new DOMParser().parseFromString(
    await response.text(),
    "text/html"
  );

  const incoming = parsed.getElementById("report-list");
  const current = byId("report-list");

  if (!incoming || !current) return false;

  current.replaceWith(incoming);

  // htmx binds its attributes when it sees an element; markup inserted by
  // something other than htmx has to be handed to it explicitly.
  window.htmx?.process(incoming);

  return true;
}

function startLiveUpdates() {
  const banner = byId("live-updates");
  const text = byId("live-updates-text");
  const refresh = byId("live-updates-refresh");

  if (!banner || !text || !refresh || !("EventSource" in window)) return;

  let queued = 0;

  const show = () => {
    text.textContent =
      queued === 1
        ? "1 report was changed by someone else."
        : `${queued} reports were changed by someone else.`;

    banner.hidden = false;
  };

  const source = new EventSource("/events");

  source.addEventListener("report", () => {
    if (Date.now() < ignoreEventsUntil) return;

    queued += 1;
    show();
  });

  // EventSource reconnects on its own; the handler exists so a dropped stream
  // does not leave the banner claiming a count it will never update again.
  source.addEventListener("error", () => {
    queued = 0;
    banner.hidden = true;
  });

  refresh.addEventListener("click", async () => {
    const count = queued;

    queued = 0;
    banner.hidden = true;

    if (await refreshList()) {
      // Focus moves to the heading above the list rather than staying on a
      // button that no longer exists.
      byId("reports-heading")?.focus();
      announce(`Report list updated with ${count} change${count === 1 ? "" : "s"}.`);
    } else {
      announce("Could not load the latest reports.");
    }
  });
}

startLiveUpdates();
