export function calcSetupHealth({ departments, faculty, subjects, sections, classrooms, timeSlots }) {
  const checks = [
    (departments?.length || 0) > 0,
    (faculty?.length || 0) > 0,
    (subjects?.length || 0) > 0,
    (sections?.length || 0) > 0,
    (classrooms?.length || 0) > 0,
    (timeSlots?.length || 0) > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function calcWorkspaceHealth({ faculty, subjects, classrooms, timeSlots }) {
  const checks = [
    { label: "Faculty Configured", ok: (faculty?.length || 0) > 0 },
    { label: "Subjects Assigned", ok: (subjects?.length || 0) > 0 },
    { label: "Classrooms Available", ok: (classrooms?.length || 0) > 0 },
    { label: "Time Slots Configured", ok: (timeSlots?.length || 0) > 0 },
  ];
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  return { score, checks };
}

export function calcTimetableHealth({ faculty, subjects, sections, timeSlots, timetable }) {
  const scheduledSectionIds = new Set((timetable || []).map((e) => e.sectionId));
  const sectionsScheduled = scheduledSectionIds.size;
  const checks = [
    (faculty?.length || 0) > 0,
    (subjects?.length || 0) > 0,
    (sections?.length || 0) > 0,
    (timeSlots?.length || 0) > 0,
    (timetable?.length || 0) > 0,
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  return { score, sectionsScheduled };
}

export function calcProfileCompletion(user) {
  const fields = [user?.name, user?.email, user?.phoneNumber, user?.avatar];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

export function getRoleLabel(isOwner) {
  return isOwner ? "Administrator" : "Collaborator";
}

export function getPermissions(isOwner) {
  if (isOwner) {
    return [
      { label: "Generate Timetables", allowed: true },
      { label: "Manage Faculty", allowed: true },
      { label: "Manage Subjects", allowed: true },
      { label: "Manage Departments", allowed: true },
      { label: "Manage Requests", allowed: true },
    ];
  }
  return [
    { label: "View Timetables", allowed: true },
    { label: "Submit Change Requests", allowed: true },
    { label: "Manage Faculty", allowed: false },
    { label: "Manage Subjects", allowed: false },
    { label: "Manage Departments", allowed: false },
  ];
}

export function buildActivityFeed(requests, timetableCount) {
  const items = [];

  (requests || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
    .forEach((req) => {
      const data = req.data || {};
      let action = "Submitted request";
      if (req.status === "approved") action = req.type === "edit" ? "Approved edit request" : "Approved deletion request";
      else if (req.status === "rejected") action = "Rejected request";
      else action = req.type === "edit" ? "Pending edit request" : "Pending deletion request";

      items.push({
        id: `req-${req.id}`,
        action,
        detail: `${data.table || "Record"}${data.id ? ` #${data.id}` : ""}`,
        actor: req.requesterName || req.requesterEmail?.split("@")[0] || "User",
        date: req.createdAt,
        status: req.status,
      });
    });

  if (timetableCount > 0 && items.length < 8) {
    items.unshift({
      id: "timetable-gen",
      action: "Timetable data available",
      detail: `${timetableCount} scheduled slot${timetableCount === 1 ? "" : "s"} in workspace`,
      actor: "System",
      date: new Date().toISOString(),
      status: "info",
    });
  }

  return items.slice(0, 8);
}
