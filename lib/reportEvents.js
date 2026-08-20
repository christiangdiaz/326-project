import { EventEmitter } from "node:events";

// In-process pub/sub behind the live board.
//
// The service layer announces what changed; routes/events.js turns those
// announcements into a Server-Sent Events stream. Keeping an emitter between
// the two means the service never learns that HTTP exists, and swapping the
// transport later (a Redis fan-out across several instances, say) touches this
// file and the SSE route rather than every write path.

export const REPORT_EVENT = "report:changed";

class ReportEvents extends EventEmitter {
  emitChange(action, report) {
    this.emit(REPORT_EVENT, {
      action,
      // Only the fields the board renders. The emitter feeds an unauthenticated
      // stream, so anything not needed for a card is deliberately left out
      // rather than trusted not to matter.
      report: report && {
        id: String(report._id ?? report.id ?? ""),
        unit: report.unit,
        description: report.description,
        status: report.status
      }
    });
  }
}

export const reportEvents = new ReportEvents();

// Every connected browser adds a listener. Ten viewers is not a leak, and the
// default limit of 10 would print a warning that looks like one.
reportEvents.setMaxListeners(0);
