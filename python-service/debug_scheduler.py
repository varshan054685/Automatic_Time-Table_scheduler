from scheduler import generate_timetable

data = {
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    "timeslots": [
        {"id": 1, "dayOfWeek": "Monday", "label": "P1", "startTime": "09:00"},
        {"id": 2, "dayOfWeek": "Monday", "label": "P2", "startTime": "10:00"},
        {"id": 3, "dayOfWeek": "Monday", "label": "P3", "startTime": "11:00"},
        {"id": 4, "dayOfWeek": "Monday", "label": "P4", "startTime": "12:00"},
    ],
    "classrooms": [{"roomNumber": "A"}],
    "sections": [{"id": 1, "name": "Sec1", "departmentId": 1}],
    "subjects": [
        {"id": 1, "name": "Sub1", "facultyId": 1, "sectionId": 1, "weeklyHours": 2, "type": "lecture"},
    ],
}

res = generate_timetable(data)
if 'timetable' in res:
    for t in res['timetable']:
        print(t)
else:
    print(res)
