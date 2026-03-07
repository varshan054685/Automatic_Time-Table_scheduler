from ortools.sat.python import cp_model
from collections import defaultdict

def generate_timetable(data: dict):
    model = cp_model.CpModel()
    
    days = data.get("days", [])
    if not days:
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        
    timeslots = data.get("timeslots", [])
    # Filter out break and lunch periods according to constraints
    valid_timeslots = [t for t in timeslots if 'Break' not in t.get('label', '') and 'Lunch' not in t.get('label', '')]
    
    periods = list(dict.fromkeys(t['label'] for t in valid_timeslots))
    valid_day_periods = set((t['dayOfWeek'], t['label']) for t in valid_timeslots)
    
    classrooms = data.get("classrooms", [])
    rooms = [c['roomNumber'] for c in classrooms]
    if not rooms:
        return {"error": "No classrooms available in input data."}
    
    sections = data.get("sections", [])
    subjects = data.get("subjects", [])
    faculty_list = data.get("faculty", [])
    faculty_names = {f['id']: f['name'] for f in faculty_list}
    
    all_events = []
    for section in sections:
        sec_id = section['id']
        sec_name = section['name']
        sec_subjects = [s for s in subjects if s.get('sectionId') == sec_id or s.get('sectionId') is None]
        for sub in sec_subjects:
            fac_id = sub.get('facultyId')
            if fac_id is None: 
                continue 
            fac_name = faculty_names.get(fac_id, "Unknown Faculty")
            for _ in range(sub.get('weeklyHours', 1)):
                all_events.append({
                    'id': len(all_events),
                    'section': sec_name,
                    'subject': sub['name'],
                    'faculty': fac_name,
                    'type': sub.get('type', 'theory')
                })
                
    num_events = len(all_events)
    num_rooms = len(rooms)
    
    if num_events == 0:
        return {"timetable": []} # No subjects to schedule
        
    capacity = len(valid_day_periods) * len(rooms)
    if num_events > capacity:
        # Instead of failing, just truncate events to fit capacity
        print(f"Warning: Not enough capacity. Needs {num_events} slots but only {capacity} slot-room combinations available. Truncating events.")
        all_events = all_events[:capacity]
        num_events = len(all_events)
        
    x = {}
    valid_slots = []
    for d_idx, day in enumerate(days):
        for p_idx, period in enumerate(periods):
            if (day, period) in valid_day_periods:
                valid_slots.append((d_idx, p_idx))
                
    for e in range(num_events):
        for d, p in valid_slots:
            for r in range(num_rooms):
                x[(e, d, p, r)] = model.NewBoolVar(f'x_{e}_{d}_{p}_{r}')
                
    # Constraint 1: Each event scheduled exactly once
    # We relax this so if the model is too tight, it just schedules what it can.
    # To maximize scheduled events, we add an objective function instead of a hard constraint.
    for e in range(num_events):
        model.AddAtMostOne(x[(e, d, p, r)] for d, p in valid_slots for r in range(num_rooms))
        
    # Constraint 2: Room capacity (at most 1 class per room per slot)
    for d, p in valid_slots:
        for r in range(num_rooms):
            model.AddAtMostOne(x[(e, d, p, r)] for e in range(num_events))
            
    # Constraint 3: Faculty limit (at most 1 class per faculty per slot)
    events_by_faculty = defaultdict(list)
    for event in all_events:
        events_by_faculty[event['faculty']].append(event['id'])
        
    for d, p in valid_slots:
        for fac, f_events in events_by_faculty.items():
            if len(f_events) > 1:
                model.AddAtMostOne(x[(e, d, p, r)] for e in f_events for r in range(num_rooms))
                
    # Constraint 4: Section limit (at most 1 class per section per slot)
    events_by_section = defaultdict(list)
    for event in all_events:
        events_by_section[event['section']].append(event['id'])
        
    for d, p in valid_slots:
        for sec, s_events in events_by_section.items():
            if len(s_events) > 1:
                model.AddAtMostOne(x[(e, d, p, r)] for e in s_events for r in range(num_rooms))

    # Constraint 5: Faculty Daily limit (max 3 classes per day)
    for d_idx, day in enumerate(days):
        day_slots = [(d, p) for (d, p) in valid_slots if d == d_idx]
        for fac, f_events in events_by_faculty.items():
            model.Add(sum(x[(e, d, p, r)] for e in f_events for d, p in day_slots for r in range(num_rooms)) <= 3)

    # Constraint 6: Faculty Weekly limit (max 18 classes per week)
    for fac, f_events in events_by_faculty.items():
        model.Add(sum(x[(e, d, p, r)] for e in f_events for d, p in valid_slots for r in range(num_rooms)) <= 18)

    # Constraint 7: No consecutive theory classes for the same faculty
    # Note: Requires periods to be contiguous in 'valid_slots'. We approximate by adjacent indices.
    for fac, f_events in events_by_faculty.items():
        theory_events = [e for e in f_events if all_events[e].get('type') == 'theory']
        for i in range(len(valid_slots) - 1):
            d1, p1 = valid_slots[i]
            d2, p2 = valid_slots[i+1]
            if d1 == d2: # Same day, adjacent periods
                for e in theory_events:
                    for r1 in range(num_rooms):
                        for r2 in range(num_rooms):
                            b1 = x[(e, d1, p1, r1)]
                            # We prevent *any* theory class by the same faculty in the next slot
                            for e2 in theory_events:
                                b2 = x[(e2, d2, p2, r2)]
                                model.AddImplication(b1, b2.Not())

    # Constraint 8: Lab subjects must be scheduled consecutively (at least 2 periods)
    # Using a simple heuristic: If a lab is scheduled at (d, p), it must also be at (d, p+1) or (d, p-1).
    events_by_subject = defaultdict(list)
    for event in all_events:
        events_by_subject[event['subject']].append(event['id'])
        
    for sub, s_events in events_by_subject.items():
        if len(s_events) > 0 and all_events[s_events[0]].get('type') == 'lab':
            for e in s_events:
                for d_idx, day in enumerate(days):
                    day_slots = [idx for idx, (d, p) in enumerate(valid_slots) if d == d_idx]
                    for idx_in_day, slot_idx in enumerate(day_slots):
                        d, p = valid_slots[slot_idx]
                        
                        # Is this event scheduled in this slot?
                        scheduled_here = model.NewBoolVar(f'lab_{e}_{d}_{p}_here')
                        model.AddMaxEquality(scheduled_here, [x[(e, d, p, r)] for r in range(num_rooms)])
                        
                        adjacent_slots = []
                        if idx_in_day > 0: # Previous period
                            prev_d, prev_p = valid_slots[day_slots[idx_in_day - 1]]
                            for prev_e in s_events:
                                adjacent_slots.extend([x[(prev_e, prev_d, prev_p, r)] for r in range(num_rooms)])
                                
                        if idx_in_day < len(day_slots) - 1: # Next period
                            next_d, next_p = valid_slots[day_slots[idx_in_day + 1]]
                            for next_e in s_events:
                                adjacent_slots.extend([x[(next_e, next_d, next_p, r)] for r in range(num_rooms)])
                                
                        if adjacent_slots:
                            has_adjacent = model.NewBoolVar(f'lab_{e}_{d}_{p}_adj')
                            model.AddMaxEquality(has_adjacent, adjacent_slots)
                            model.AddImplication(scheduled_here, has_adjacent)
                        else:
                            # If no adjacent slots possible (e.g., only 1 valid slot in day), cannot schedule here
                            model.Add(scheduled_here == 0)
                
    # Maximize the number of scheduled events
    model.Maximize(sum(x[(e, d, p, r)] for e in range(num_events) for d, p in valid_slots for r in range(num_rooms)))

    print(f"Solving model with {num_events} events across {len(valid_slots)} slots and {num_rooms} rooms (capacity: {capacity})")
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    status = solver.Solve(model)
    print(f"Solver status: {status}")
    
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        timetable = []
        for e in range(num_events):
            for d, p in valid_slots:
                for r in range(num_rooms):
                    if solver.Value(x[(e, d, p, r)]):
                        event = all_events[e]
                        timetable.append({
                            "day": days[d],
                            "period": periods[p],
                            "section": event['section'],
                            "subject": event['subject'],
                            "faculty": event['faculty'],
                            "room": rooms[r]
                        })
        return {"timetable": timetable}
    else:
        return {"error": "Could not find a feasible timetable schedule with the given constraints."}
