import json
import sys


DAY_ORDER = {
    "Monday": 1,
    "Tuesday": 2,
    "Wednesday": 3,
    "Thursday": 4,
    "Friday": 5,
    "Saturday": 6,
    "Sunday": 7,
}


def sorted_slots(time_slots):
    return sorted(
        time_slots,
        key=lambda slot: (
            DAY_ORDER.get(slot.get("dayOfWeek", ""), 99),
            slot.get("startTime", ""),
            slot.get("endTime", ""),
            slot.get("id", 0),
        ),
    )


def section_subjects(all_subjects, section_id):
    specific = [s for s in all_subjects if s.get("sectionId") == section_id]
    common = [s for s in all_subjects if s.get("sectionId") is None]
    seen = set()
    merged = []

    for subject in specific + common:
        subject_id = subject.get("id")
        if subject_id in seen:
            continue
        seen.add(subject_id)
        merged.append(subject)

    return merged


def generate(data):
    sections = data.get("sections", [])
    subjects = data.get("subjects", [])
    classrooms = data.get("classrooms", [])
    slots = sorted_slots(data.get("timeSlots", []))

    room_ids = [room.get("id") for room in classrooms if room.get("id") is not None]
    if not room_ids or not slots:
        return {"entries": [], "unassigned": []}

    section_busy = set()
    faculty_busy = set()
    room_busy = set()
    subject_day_busy = set()
    entries = []
    unassigned = []

    for section in sections:
        section_id = section.get("id")
        if section_id is None:
            continue

        for subject in section_subjects(subjects, section_id):
            subject_id = subject.get("id")
            faculty_id = subject.get("facultyId")
            weekly_hours = int(subject.get("weeklyHours") or 0)

            if subject_id is None or faculty_id is None or weekly_hours <= 0:
                continue

            assigned = 0
            offset = ((section_id * 31) + (subject_id * 17)) % len(slots)
            candidate_slots = slots[offset:] + slots[:offset]

            for slot in candidate_slots:
                if assigned >= weekly_hours:
                    break

                slot_id = slot.get("id")
                day = slot.get("dayOfWeek")
                if slot_id is None:
                    continue

                if (section_id, slot_id) in section_busy:
                    continue
                if (faculty_id, slot_id) in faculty_busy:
                    continue
                if (section_id, subject_id, day) in subject_day_busy:
                    continue

                selected_room_id = None
                for room_id in room_ids:
                    if (room_id, slot_id) not in room_busy:
                        selected_room_id = room_id
                        break

                if selected_room_id is None:
                    continue

                entries.append(
                    {
                        "sectionId": section_id,
                        "subjectId": subject_id,
                        "facultyId": faculty_id,
                        "classroomId": selected_room_id,
                        "timeSlotId": slot_id,
                    }
                )

                section_busy.add((section_id, slot_id))
                faculty_busy.add((faculty_id, slot_id))
                room_busy.add((selected_room_id, slot_id))
                subject_day_busy.add((section_id, subject_id, day))
                assigned += 1

            if assigned < weekly_hours:
                unassigned.append(
                    {
                        "sectionId": section_id,
                        "subjectId": subject_id,
                        "remainingHours": weekly_hours - assigned,
                    }
                )

    return {"entries": entries, "unassigned": unassigned}


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        result = generate(payload)
        print(json.dumps(result))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
