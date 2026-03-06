from ortools.sat.python import cp_model

ALLOWED_PERIODS = {"period1", "period2", "period3", "period4", "period5", "period6"}


def _normalize_period_label(label):
    return str(label or "").strip().lower().replace(" ", "")


def _slot_order(slot):
    day_rank = {
        "Monday": 1,
        "Tuesday": 2,
        "Wednesday": 3,
        "Thursday": 4,
        "Friday": 5,
        "Saturday": 6,
        "Sunday": 7,
    }
    return (
        day_rank.get(slot.get("day", ""), 99),
        slot.get("start", ""),
        slot.get("period", ""),
    )


def _pick_subject_faculty(subject, faculty, dept_lookup):
    subject_faculty_id = subject.get("facultyId")
    if subject_faculty_id is not None:
        for fac in faculty:
            if fac["id"] == subject_faculty_id:
                return fac

    dept_id = subject.get("departmentId")
    candidate = dept_lookup.get(dept_id, [])
    if candidate:
        return candidate[0]

    return faculty[0] if faculty else None


def generate_timetable(data):
    classrooms = data.get("classrooms", [])
    subjects = data.get("subjects", [])
    faculty = data.get("faculty", [])
    sections = data.get("sections", [])
    timeslots = data.get("timeslots", [])
    days = set(data.get("days", []))

    if not classrooms:
        raise ValueError("No classrooms provided")
    if not subjects:
        raise ValueError("No subjects provided")
    if not sections:
        raise ValueError("No sections provided")
    if not timeslots:
        raise ValueError("No timeslots provided")
    if not faculty:
        raise ValueError("No faculty provided")

    dept_faculty = {}
    for fac in faculty:
        dept_faculty.setdefault(fac.get("departmentId"), []).append(fac)

    valid_slots = []
    for slot in timeslots:
        day = slot.get("dayOfWeek")
        period = slot.get("label")
        if day not in days:
            continue
        if _normalize_period_label(period) not in ALLOWED_PERIODS:
            continue
        valid_slots.append(
            {
                "id": slot.get("id"),
                "day": day,
                "period": period,
                "start": slot.get("startTime"),
            }
        )

    if not valid_slots:
        raise ValueError("No valid teaching slots after removing break/lunch")

    task_defs = []
    for section in sections:
        section_id = section.get("id")
        section_name = section.get("name")
        section_subjects = [
            s
            for s in subjects
            if s.get("sectionId") == section_id
            or (s.get("sectionId") is None and s.get("departmentId") == section.get("departmentId"))
        ]
        seen_subject_keys = set()
        for subject in section_subjects:
            subject_key = subject.get("id")
            if subject_key is None:
                subject_key = f"name::{subject.get('name')}::sec::{section_id}"
            if subject_key in seen_subject_keys:
                continue
            seen_subject_keys.add(subject_key)
            weekly_hours = int(subject.get("weeklyHours") or 0)
            if weekly_hours <= 0:
                continue
            assigned_faculty = _pick_subject_faculty(subject, faculty, dept_faculty)
            if not assigned_faculty:
                continue
            task_defs.append(
                {
                    "sectionName": section_name,
                    "subjectName": subject.get("name"),
                    "facultyName": assigned_faculty.get("name"),
                    "weeklyHours": weekly_hours,
                }
            )

    if not task_defs:
        raise ValueError("No schedulable subject entries found")

    model = cp_model.CpModel()
    room_numbers = [str(room.get("roomNumber")) for room in classrooms]
    decision = {}

    for task_idx, _task in enumerate(task_defs):
        for slot_idx, _slot in enumerate(valid_slots):
            for room_idx, _room in enumerate(room_numbers):
                decision[(task_idx, slot_idx, room_idx)] = model.NewBoolVar(
                    f"x_t{task_idx}_s{slot_idx}_r{room_idx}"
                )

    for task_idx, task in enumerate(task_defs):
        model.Add(
            sum(
                decision[(task_idx, slot_idx, room_idx)]
                for slot_idx in range(len(valid_slots))
                for room_idx in range(len(room_numbers))
            )
            == task["weeklyHours"]
        )

    section_names = sorted({task["sectionName"] for task in task_defs})
    faculty_names = sorted({task["facultyName"] for task in task_defs})

    for section_name in section_names:
        task_ids = [i for i, t in enumerate(task_defs) if t["sectionName"] == section_name]
        for slot_idx in range(len(valid_slots)):
            model.Add(
                sum(
                    decision[(task_idx, slot_idx, room_idx)]
                    for task_idx in task_ids
                    for room_idx in range(len(room_numbers))
                )
                <= 1
            )

    for faculty_name in faculty_names:
        task_ids = [i for i, t in enumerate(task_defs) if t["facultyName"] == faculty_name]
        for slot_idx in range(len(valid_slots)):
            model.Add(
                sum(
                    decision[(task_idx, slot_idx, room_idx)]
                    for task_idx in task_ids
                    for room_idx in range(len(room_numbers))
                )
                <= 1
            )

    for slot_idx in range(len(valid_slots)):
        for room_idx in range(len(room_numbers)):
            model.Add(
                sum(decision[(task_idx, slot_idx, room_idx)] for task_idx in range(len(task_defs))) <= 1
            )

    for section_name in section_names:
        task_ids = [i for i, t in enumerate(task_defs) if t["sectionName"] == section_name]
        subjects_in_section = sorted(
            {task_defs[task_idx]["subjectName"] for task_idx in task_ids}
        )
        day_values = sorted({slot["day"] for slot in valid_slots})
        for subject_name in subjects_in_section:
            target_tasks = [
                tid
                for tid in task_ids
                if task_defs[tid]["subjectName"] == subject_name
            ]
            for day in day_values:
                day_slot_ids = [
                    idx for idx, slot in enumerate(valid_slots) if slot["day"] == day
                ]
                model.Add(
                    sum(
                        decision[(task_idx, slot_idx, room_idx)]
                        for task_idx in target_tasks
                        for slot_idx in day_slot_ids
                        for room_idx in range(len(room_numbers))
                    )
                    <= 1
                )

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 15.0
    solver.parameters.num_search_workers = 8
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise ValueError("No feasible timetable for the given constraints")

    timetable = []
    for task_idx, task in enumerate(task_defs):
        for slot_idx, slot in enumerate(valid_slots):
            for room_idx, room in enumerate(room_numbers):
                if solver.Value(decision[(task_idx, slot_idx, room_idx)]) == 1:
                    timetable.append(
                        {
                            "day": slot["day"],
                            "period": slot["period"],
                            "section": task["sectionName"],
                            "subject": task["subjectName"],
                            "faculty": task["facultyName"],
                            "room": room,
                        }
                    )

    timetable.sort(key=lambda row: _slot_order({"day": row["day"], "start": "", "period": row["period"]}))
    return {"timetable": timetable}
