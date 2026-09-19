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

export function buildActivityFeed(historyJobs, timetableCount) {
  const items = [];
  const list = Array.isArray(historyJobs) ? historyJobs : [];

  list
    .slice()
    .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
    .slice(0, 8)
    .forEach((item) => {
      if (!item) return;
      if (item.status) {
        // Scheduler generation job
        let action = "Timetable Generation";
        if (item.status === "completed") action = "Timetable generation completed";
        else if (item.status === "failed") action = "Timetable generation failed";
        else if (item.status === "running") action = "Timetable generation in progress";
        else if (item.status === "queued") action = "Timetable generation queued";

        items.push({
          id: `job-${item.id}`,
          action,
          detail: `Generation Job #${item.id} (${item.status})`,
          actor: "Scheduler",
          date: item.createdAt || new Date().toISOString(),
          status: item.status,
        });
      } else {
        const data = item.data || {};
        items.push({
          id: `act-${item.id || Math.random()}`,
          action: item.action || "Activity",
          detail: `${data.table || "Record"}${data.id ? ` #${data.id}` : ""}`,
          actor: item.actor || "User",
          date: item.createdAt || new Date().toISOString(),
          status: item.status || "info",
        });
      }
    });

  if (timetableCount > 0 && items.length < 8) {
    items.unshift({
      id: "timetable-gen",
      action: "Timetable Active",
      detail: `${timetableCount} scheduled slot${timetableCount === 1 ? "" : "s"} in institution`,
      actor: "System",
      date: new Date().toISOString(),
      status: "info",
    });
  }

  return items.slice(0, 8);
}
