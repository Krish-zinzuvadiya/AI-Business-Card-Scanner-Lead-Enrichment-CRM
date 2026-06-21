import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, Download, Menu, X } from "lucide-react";
import api, { API_BASE } from "./api";
import LeadTable from "./components/LeadTable";
import Scanner from "./components/Scanner";
import Sidebar from "./components/Sidebar";

function App() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [activeView, setActiveView] = useState("dashboard");
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventName, setEventName] = useState("");
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const [error, setError] = useState("");

  const selectedEvent = useMemo(
    () => events.find((event) => event._id === selectedEventId) || events[0] || null,
    [events, selectedEventId]
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent?._id) {
      setSelectedEventId(selectedEvent._id);
      loadLeads(selectedEvent._id);
    } else {
      setLeads([]);
    }
  }, [selectedEvent?._id, search, status]);

  async function loadEvents() {
    setLoadingEvents(true);
    setError("");
    try {
      const response = await api.get("/events");
      setEvents(response.data);
      if (!selectedEventId && response.data[0]?._id) {
        setSelectedEventId(response.data[0]._id);
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoadingEvents(false);
    }
  }

  async function loadLeads(eventId = selectedEvent?._id) {
    if (!eventId) return;
    setLoadingLeads(true);
    setError("");
    try {
      const response = await api.get(`/events/${eventId}/leads`, {
        params: { search, status }
      });
      setLeads(response.data);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoadingLeads(false);
    }
  }

  async function createEvent(event) {
    event.preventDefault();
    const name = eventName.trim();
    if (!name) return;
    setError("");
    try {
      const response = await api.post("/events", { name });
      setEvents((current) => [response.data, ...current]);
      setSelectedEventId(response.data._id);
      setEventName("");
      setEventModalOpen(false);
      setActiveView("scan");
    } catch (createError) {
      setError(createError.message);
    }
  }

  async function deleteEvent(event) {
    if (!window.confirm(`Delete ${event.name} and all leads inside it?`)) return;
    setError("");
    try {
      await api.delete(`/events/${event._id}`);
      setEvents((current) => current.filter((item) => item._id !== event._id));
      if (selectedEventId === event._id) {
        setSelectedEventId("");
      }
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  function downloadExcel() {
    if (!selectedEvent?._id) return;
    window.location.href = `${API_BASE}/events/${selectedEvent._id}/leads/export`;
  }

  const handleLeadCreated = useCallback(
    (lead) => {
      setLeads((current) => [lead, ...current.filter((item) => item._id !== lead._id)]);
      setEvents((current) =>
        current.map((event) =>
          event._id === lead.event ? { ...event, leadCount: Number(event.leadCount || 0) + 1 } : event
        )
      );
      setActiveView("dashboard");
    },
    [setLeads, setEvents]
  );

  function handleLeadChanged(lead) {
    setLeads((current) => {
      const exists = current.some((item) => item._id === lead._id);
      if (!exists) return [lead, ...current];
      return current.map((item) => (item._id === lead._id ? lead : item));
    });
    loadEvents();
  }

  const sidebar = (
    <Sidebar
      events={events}
      selectedEventId={selectedEvent?._id}
      activeView={activeView}
      darkMode={darkMode}
      onSelectEvent={(eventId) => {
        setSelectedEventId(eventId);
        setMobileSidebar(false);
      }}
      onCreateEvent={() => {
        setEventModalOpen(true);
        setMobileSidebar(false);
      }}
      onDeleteEvent={deleteEvent}
      onView={(view) => {
        setActiveView(view);
        setMobileSidebar(false);
      }}
      onToggleTheme={() => setDarkMode((value) => !value)}
    />
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="fixed inset-y-0 left-0 hidden w-72 lg:block">{sidebar}</div>

      {mobileSidebar ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileSidebar(false)} />
          <div className="relative h-full w-80 max-w-[85vw]">{sidebar}</div>
        </div>
      ) : null}

      <main className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMobileSidebar(true)}
              className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                {selectedEvent ? selectedEvent.name : loadingEvents ? "Loading events" : "No event selected"}
              </p>
              <h2 className="truncate text-lg font-semibold text-slate-950 dark:text-white">
                {activeView === "scan" ? "Scan and enrich leads" : "Manage event leads"}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {selectedEvent ? (
                <button
                  type="button"
                  onClick={downloadExcel}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <Download className="h-4 w-4" />
                  Download Excel
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setEventModalOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
              >
                <CalendarPlus className="h-4 w-4" />
                Event
              </button>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-6">
          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          ) : null}

          {!selectedEvent && !loadingEvents ? (
            <EmptyState onCreate={() => setEventModalOpen(true)} />
          ) : activeView === "scan" ? (
            selectedEvent ? <Scanner event={selectedEvent} onLeadCreated={handleLeadCreated} /> : null
          ) : selectedEvent ? (
            <LeadTable
              event={selectedEvent}
              leads={leads}
              loading={loadingLeads}
              search={search}
              status={status}
              onSearch={setSearch}
              onStatus={setStatus}
              onRefresh={() => {
                loadLeads();
                loadEvents();
              }}
              onLeadChanged={handleLeadChanged}
            />
          ) : null}
        </div>
      </main>

      {eventModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 px-4 backdrop-blur-sm">
          <form onSubmit={createEvent} className="w-full max-w-md rounded-lg bg-white p-4 shadow-soft dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Create event</h2>
              <button
                type="button"
                onClick={() => setEventModalOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-200"
                aria-label="Close event form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Event Name
              <input
                autoFocus
                value={eventName}
                onChange={(event) => setEventName(event.target.value)}
                placeholder="Test Expo 2026"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <button
              type="submit"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <CalendarPlus className="h-4 w-4" />
              Create
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <section className="grid min-h-[65vh] place-items-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
      <div className="max-w-md">
        <CalendarPlus className="mx-auto h-10 w-10 text-brand-600" />
        <h2 className="mt-4 text-2xl font-semibold text-slate-950 dark:text-white">Create an expo or event</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Each event stores its own scanned cards, enriched contacts, notes, tags, and Excel exports.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <CalendarPlus className="h-4 w-4" />
          Create Event
        </button>
      </div>
    </section>
  );
}

export default App;
