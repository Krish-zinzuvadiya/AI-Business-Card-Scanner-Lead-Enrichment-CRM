import { useMemo, useState } from "react";
import { Building2, Download, Edit3, ExternalLink, Loader2, Mail, Phone, Plus, RefreshCw, Search, Trash2, Wand2 } from "lucide-react";
import api, { API_BASE } from "../api";
import LeadModal from "./LeadModal";

const statuses = ["All", "New", "Contacted", "Qualified", "Follow-up", "Won", "Lost"];

export default function LeadTable({
  event,
  leads,
  loading,
  search,
  status,
  onSearch,
  onStatus,
  onRefresh,
  onLeadChanged
}) {
  const [editingLead, setEditingLead] = useState(null);
  const [creating, setCreating] = useState(false);
  const [busyLeadId, setBusyLeadId] = useState("");
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    return leads.reduce(
      (acc, lead) => {
        acc.total += 1;
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      },
      { total: 0 }
    );
  }, [leads]);

  const companyGroups = useMemo(() => buildCompanyGroups(leads), [leads]);

  async function saveLead(payload) {
    setError("");
    if (payload._id) {
      const response = await api.put(`/leads/${payload._id}`, payload);
      onLeadChanged(response.data.lead);
      return;
    }
    const response = await api.post(`/events/${event._id}/leads`, payload);
    onLeadChanged(response.data.lead);
  }

  async function deleteLead(lead) {
    if (!window.confirm(`Delete ${lead.personName || lead.company || "this lead"}?`)) return;
    setBusyLeadId(lead._id);
    setError("");
    try {
      await api.delete(`/leads/${lead._id}`);
      onRefresh();
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusyLeadId("");
    }
  }

  async function enrichLead(lead) {
    setBusyLeadId(lead._id);
    setError("");
    try {
      const response = await api.post(`/leads/${lead._id}/enrich`);
      onLeadChanged(response.data.lead);
    } catch (enrichError) {
      setError(enrichError.message);
    } finally {
      setBusyLeadId("");
    }
  }

  function downloadExcel() {
    window.location.href = `${API_BASE}/events/${event._id}/leads/export`;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 p-4 dark:border-slate-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{event.name}</p>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Leads dashboard</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={downloadExcel}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" />
              Download Excel
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(eventChange) => onSearch(eventChange.target.value)}
              placeholder="Search names, companies, emails, phones"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <select
            value={status}
            onChange={(eventChange) => onStatus(eventChange.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            {statuses.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Metric label="Total" value={counts.total} />
          <Metric label="New" value={counts.New || 0} />
          <Metric label="Qualified" value={counts.Qualified || 0} />
          <Metric label="Follow-up" value={counts["Follow-up"] || 0} />
        </div>

        {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200">{error}</p> : null}
      </div>

      {companyGroups.length ? (
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Company pages</p>
              <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Expo company-wise leads</h3>
            </div>
            <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
              {companyGroups.length} companies
            </span>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {companyGroups.map((group, index) => (
              <CompanyPage key={group.name} group={group} index={index} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto scrollbar-thin">
        <table className="min-w-[1220px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <Th>Person Name</Th>
              <Th>Company</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Website</Th>
              <Th>Designation</Th>
              <Th>Notes</Th>
              <Th>Status</Th>
              <Th>Score</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan="10" className="px-4 py-10 text-center text-slate-500">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </td>
              </tr>
            ) : leads.length ? (
              leads.map((lead) => (
                <tr key={lead._id} className="align-top hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <Td>
                    <div className="font-semibold text-slate-900 dark:text-white">{lead.personName || "Unknown"}</div>
                    {lead.duplicateOf ? <div className="mt-1 text-xs text-amber-600">Possible duplicate</div> : null}
                  </Td>
                  <Td>{lead.company || "-"}</Td>
                  <Td>
                    <EmailLinks lead={lead} />
                  </Td>
                  <Td>
                    <PhoneList lead={lead} />
                  </Td>
                  <Td>
                    <WebsiteLinks lead={lead} />
                  </Td>
                  <Td>{lead.designation || "-"}</Td>
                  <Td className="max-w-[220px] truncate">{lead.notes || "-"}</Td>
                  <Td>
                    <span className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                      {lead.status}
                    </span>
                  </Td>
                  <Td>{lead.score || 0}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <IconButton label="Enrich lead" onClick={() => enrichLead(lead)} busy={busyLeadId === lead._id}>
                        <Wand2 className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Edit lead" onClick={() => setEditingLead(lead)}>
                        <Edit3 className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Delete lead" onClick={() => deleteLead(lead)} busy={busyLeadId === lead._id}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </Td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                  No leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingLead ? (
        <LeadModal
          title="Edit lead"
          lead={editingLead}
          onClose={() => setEditingLead(null)}
          onSave={saveLead}
        />
      ) : null}

      {creating ? (
        <LeadModal
          title="Add lead"
          lead={{}}
          onClose={() => setCreating(false)}
          onSave={saveLead}
        />
      ) : null}
    </section>
  );
}

function CompanyPage({ group, index }) {
  const primaryWebsite = group.websites[0] || "";

  return (
    <article className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-200">
            {index + 1}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
              <h4 className="truncate text-base font-semibold text-slate-950 dark:text-white">{group.name}</h4>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {group.leads.length} card{group.leads.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        {primaryWebsite ? (
          <a
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-semibold text-brand-600 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            href={primaryWebsite}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Website
          </a>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <ContactBlock
          icon={Mail}
          label="Emails"
          values={group.emails}
          render={(value) => (
            <a className="text-brand-600 hover:underline" href={`mailto:${value}`}>
              {value}
            </a>
          )}
        />
        <ContactBlock
          icon={Phone}
          label="Phones"
          values={group.phones}
          render={(value) => (
            <a className="text-slate-700 hover:text-brand-600 dark:text-slate-200" href={`tel:${value}`}>
              {value}
            </a>
          )}
        />
        <ContactBlock
          icon={Building2}
          label="People"
          values={group.leads.map((lead) => compactPerson(lead)).filter(Boolean)}
        />
      </div>
    </article>
  );
}

function ContactBlock({ icon: Icon, label, values, render }) {
  const visible = values.slice(0, 4);

  return (
    <div className="min-w-0 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      {visible.length ? (
        <div className="space-y-1">
          {visible.map((value) => (
            <div key={value} className="truncate text-sm text-slate-700 dark:text-slate-200">
              {render ? render(value) : value}
            </div>
          ))}
          {values.length > visible.length ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">+{values.length - visible.length} more</div>
          ) : null}
        </div>
      ) : (
        <div className="text-sm text-slate-400">-</div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function Th({ children }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 text-slate-700 dark:text-slate-200 ${className}`}>{children}</td>;
}

function IconButton({ children, label, onClick, busy }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      aria-label={label}
      title={label}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

function EmailLinks({ lead }) {
  const emails = contactValues(lead, "emails", "email");
  if (!emails.length) return "-";

  return (
    <div className="space-y-1">
      {emails.slice(0, 3).map((email) => (
        <a key={email} className="block max-w-[260px] truncate text-brand-600 hover:underline" href={`mailto:${email}`}>
          {email}
        </a>
      ))}
      {emails.length > 3 ? <div className="text-xs text-slate-500">+{emails.length - 3} more</div> : null}
    </div>
  );
}

function PhoneList({ lead }) {
  const phones = contactValues(lead, "phones", "phone");
  if (!phones.length) return "-";

  return (
    <div className="space-y-1">
      {phones.slice(0, 4).map((phone) => (
        <a key={phone} className="block text-slate-700 hover:text-brand-600 dark:text-slate-200" href={`tel:${phone}`}>
          {phone}
        </a>
      ))}
      {phones.length > 4 ? <div className="text-xs text-slate-500">+{phones.length - 4} more</div> : null}
    </div>
  );
}

function WebsiteLinks({ lead }) {
  const websites = contactValues(lead, "websites", "website");
  if (!websites.length) return "-";

  return (
    <div className="space-y-1">
      {websites.slice(0, 2).map((website) => (
        <a key={website} className="block max-w-[220px] truncate text-brand-600 hover:underline" href={website} target="_blank" rel="noreferrer">
          {safeHost(website)}
        </a>
      ))}
      {websites.length > 2 ? <div className="text-xs text-slate-500">+{websites.length - 2} more</div> : null}
    </div>
  );
}

function contactValues(lead, pluralKey, singularKey) {
  const values = [];
  if (lead?.[singularKey]) values.push(lead[singularKey]);
  if (Array.isArray(lead?.[pluralKey])) values.push(...lead[pluralKey]);
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()))];
}

function buildCompanyGroups(leads) {
  const groups = new Map();

  for (const lead of leads) {
    const name = String(lead.company || "Unknown Company").trim() || "Unknown Company";
    if (!groups.has(name)) {
      groups.set(name, {
        name,
        leads: [],
        emails: [],
        phones: [],
        websites: []
      });
    }
    const group = groups.get(name);
    group.leads.push(lead);
    group.emails.push(...contactValues(lead, "emails", "email"));
    group.phones.push(...contactValues(lead, "phones", "phone"));
    group.websites.push(...contactValues(lead, "websites", "website"));
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      emails: [...new Set(group.emails)],
      phones: [...new Set(group.phones)],
      websites: [...new Set(group.websites)]
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function compactPerson(lead) {
  return [lead.personName, lead.designation].filter(Boolean).join(" - ");
}

function safeHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_error) {
    return url;
  }
}
