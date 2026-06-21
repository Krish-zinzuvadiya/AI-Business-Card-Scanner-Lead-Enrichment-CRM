import { useEffect, useState } from "react";
import { Save, X } from "lucide-react";

const statuses = ["New", "Contacted", "Qualified", "Follow-up", "Won", "Lost"];

const emptyLead = {
  personName: "",
  company: "",
  designation: "",
  emails: "",
  phones: "",
  websites: "",
  address: "",
  linkedIn: "",
  notes: "",
  status: "New",
  tags: []
};

export default function LeadModal({ lead, title, onClose, onSave }) {
  const [form, setForm] = useState(emptyLead);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({
      ...emptyLead,
      ...lead,
      emails: contactInput(lead, "emails", "email"),
      phones: contactInput(lead, "phones", "phone"),
      websites: contactInput(lead, "websites", "website"),
      tags: Array.isArray(lead?.tags) ? lead.tags.join(", ") : lead?.tags || ""
    });
  }, [lead]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const emails = splitContactInput(form.emails);
      const phones = splitContactInput(form.phones);
      const websites = splitContactInput(form.websites);
      await onSave({
        ...form,
        email: emails[0] || "",
        phone: phones[0] || "",
        website: websites[0] || "",
        emails,
        phones,
        websites,
        tags: String(form.tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      });
      onClose();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
      <form onSubmit={submit} className="max-h-full w-full max-w-3xl overflow-auto rounded-lg bg-white p-4 shadow-soft dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-200"
            aria-label="Close lead editor"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Person Name" value={form.personName} onChange={(value) => update("personName", value)} />
          <Field label="Company" value={form.company} onChange={(value) => update("company", value)} />
          <Field label="Designation" value={form.designation} onChange={(value) => update("designation", value)} />
          <Field label="Emails" value={form.emails} onChange={(value) => update("emails", value)} />
          <Field label="Phones" value={form.phones} onChange={(value) => update("phones", value)} />
          <Field label="Websites" value={form.websites} onChange={(value) => update("websites", value)} />
          <Field label="LinkedIn" value={form.linkedIn} onChange={(value) => update("linkedIn", value)} />
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Status
            <select
              value={form.status}
              onChange={(event) => update("status", event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <Field label="Tags" value={form.tags} onChange={(value) => update("tags", value)} placeholder="hot, expo, priority" />
          <Field label="Address" value={form.address} onChange={(value) => update("address", value)} />
        </div>

        <label className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Notes
          <textarea
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </label>

        {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function contactInput(lead, pluralKey, singularKey) {
  const values = [];
  if (lead?.[singularKey]) values.push(lead[singularKey]);
  if (Array.isArray(lead?.[pluralKey])) values.push(...lead[pluralKey]);
  return [...new Set(values.filter(Boolean))].join(", ");
}

function splitContactInput(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor={id}>
      {label}
      <input
        id={id}
        type={type}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
    </label>
  );
}
