import { CalendarPlus, LayoutDashboard, Moon, ScanLine, Sun, Trash2 } from "lucide-react";

export default function Sidebar({
  events,
  selectedEventId,
  activeView,
  darkMode,
  onSelectEvent,
  onCreateEvent,
  onDeleteEvent,
  onView,
  onToggleTheme
}) {
  return (
    <aside className="flex h-full flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-brand-600">LeadLens</p>
            <h1 className="text-lg font-bold text-slate-950 dark:text-white">Card CRM</h1>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <nav className="grid gap-2 px-3 py-4">
        <NavButton active={activeView === "dashboard"} onClick={() => onView("dashboard")} icon={LayoutDashboard}>
          Dashboard
        </NavButton>
        <NavButton active={activeView === "scan"} onClick={() => onView("scan")} icon={ScanLine}>
          Scanner
        </NavButton>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col border-t border-slate-200 px-3 py-4 dark:border-slate-800">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Events</p>
          <button
            type="button"
            onClick={onCreateEvent}
            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Create event"
          >
            <CalendarPlus className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 space-y-2 overflow-auto pr-1 scrollbar-thin">
          {events.map((event) => (
            <div
              key={event._id}
              className={`group flex items-center gap-2 rounded-lg border px-3 py-2 ${
                event._id === selectedEventId
                  ? "border-brand-200 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/40"
                  : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-900"
              }`}
            >
              <button type="button" onClick={() => onSelectEvent(event._id)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{event.name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{event.leadCount || 0} leads</span>
              </button>
              <button
                type="button"
                onClick={() => onDeleteEvent(event)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 opacity-100 hover:bg-white hover:text-red-600 dark:hover:bg-slate-800 md:opacity-0 md:group-hover:opacity-100"
                aria-label={`Delete ${event.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {!events.length ? <p className="px-2 text-sm text-slate-500 dark:text-slate-400">Create your first event.</p> : null}
        </div>
      </div>
    </aside>
  );
}

function NavButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${
        active
          ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
