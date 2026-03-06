from ortools.sat.python import cp_model

def generate_timetable(data):

    subjects = data["subjects"]
    faculty = data["faculty"]
    rooms = data["rooms"]
    days = data["days"]
    periods = data["periods"]

    model = cp_model.CpModel()

    timetable = {}

    for d in days:
        for p in periods:
            timetable[(d,p)] = model.NewIntVar(0, len(subjects)-1, f"{d}_{p}")

    solver = cp_model.CpSolver()
    solver.Solve(model)

    result = []

    for d in days:
        for p in periods:
            subject_index = solver.Value(timetable[(d,p)])

            result.append({
                "day": d,
                "period": p,
                "subject": subjects[subject_index],
                "faculty": faculty[subject_index % len(faculty)],
                "room": rooms[subject_index % len(rooms)]
            })

    return result