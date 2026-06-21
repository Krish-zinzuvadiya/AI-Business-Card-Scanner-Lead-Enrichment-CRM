const XLSX = require("xlsx");

function contactValues(lead, pluralKey, singularKey) {
  const values = [];
  if (lead[singularKey]) values.push(lead[singularKey]);
  if (Array.isArray(lead[pluralKey])) values.push(...lead[pluralKey]);
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()))];
}

function companyName(lead) {
  return String(lead.company || "Unknown Company").trim() || "Unknown Company";
}

function leadRows(leads, companyPage = "") {
  return leads.map((lead) => {
    const emails = contactValues(lead, "emails", "email");
    const phones = contactValues(lead, "phones", "phone");
    const websites = contactValues(lead, "websites", "website");

    return {
      "Company Page": companyPage || companyName(lead),
      "Person Name": lead.personName,
      Company: lead.company,
      Designation: lead.designation,
      "Primary Email": lead.email || emails[0] || "",
      "All Emails": emails.join("\n"),
      "Primary Phone": lead.phone || phones[0] || "",
      "All Phones": phones.join("\n"),
      "Primary Website": lead.website || websites[0] || "",
      "All Websites": websites.join("\n"),
      Address: lead.address,
      LinkedIn: lead.linkedIn,
      Status: lead.status,
      Tags: (lead.tags || []).join(", "),
      Notes: lead.notes,
      Score: lead.score,
      "Enrichment Status": lead.enrichment?.status || "",
      Sources: (lead.enrichment?.sources || []).join("\n"),
      "Created At": lead.createdAt?.toISOString?.() || ""
    };
  });
}

function companyGroups(leads) {
  const groups = new Map();

  for (const lead of leads) {
    const name = companyName(lead);
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

function companySummaryRows(groups) {
  return groups.map((group, index) => ({
    "Company Page": `Company ${index + 1}`,
    Company: group.name,
    "Cards/People": group.leads.length,
    People: group.leads.map((lead) => lead.personName).filter(Boolean).join("\n"),
    Emails: group.emails.join("\n"),
    Phones: group.phones.join("\n"),
    Websites: group.websites.join("\n")
  }));
}

function safeSheetName(value, usedNames) {
  const base =
    String(value || "Sheet")
      .replace(/[:\\/?*[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 28) || "Sheet";

  let name = base;
  let counter = 2;
  while (usedNames.has(name.toLowerCase())) {
    const suffix = ` ${counter}`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    counter += 1;
  }
  usedNames.add(name.toLowerCase());
  return name;
}

function appendSheet(workbook, rows, name, usedNames) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 18 },
    { wch: 26 },
    { wch: 28 },
    { wch: 24 },
    { wch: 32 },
    { wch: 36 },
    { wch: 20 },
    { wch: 30 },
    { wch: 34 },
    { wch: 38 },
    { wch: 42 },
    { wch: 34 },
    { wch: 14 },
    { wch: 24 },
    { wch: 40 },
    { wch: 10 },
    { wch: 18 },
    { wch: 50 },
    { wch: 24 }
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(name, usedNames));
}

function createLeadsWorkbook(leads, eventName) {
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set();
  const groups = companyGroups(leads);

  appendSheet(workbook, companySummaryRows(groups), "Companies", usedNames);
  appendSheet(workbook, leadRows(leads), "All Leads", usedNames);

  groups.forEach((group, index) => {
    appendSheet(workbook, leadRows(group.leads, `Company ${index + 1}`), `Company ${index + 1} ${group.name}`, usedNames);
  });

  workbook.Props = {
    Title: `${eventName} Leads`,
    Subject: "Business card lead export",
    CreatedDate: new Date()
  };

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

module.exports = {
  createLeadsWorkbook
};
