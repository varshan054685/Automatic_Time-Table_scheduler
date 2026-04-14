from ortools.sat.python import cp_model
from collections import defaultdict
import random
import time

def generate_timetable(data: dict):

    model = cp_model.CpModel()

    days = data.get("days", []) or ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    timeslots = data.get("timeslots", [])
    valid_timeslots = [t for t in timeslots if 'Break' not in t.get('label', '') and 'Lunch' not in t.get('label', '')]

    # Identify morning and afternoon sessions based on 'Lunch'
    morning_p_indices = []
    afternoon_p_indices = []
    lunch_ts = [t for t in timeslots if 'lunch' in t.get('label', '').lower()]
    
    # Sort periods by startTime to ensure indices match
    valid_timeslots.sort(key=lambda t: t['startTime'])
    periods = list(dict.fromkeys(t['label'] for t in valid_timeslots))
    slot_lookup = {(t['dayOfWeek'], t['label']): t['id'] for t in valid_timeslots}

    if lunch_ts:
        def to_min(t_str):
            try:
                clean = t_str.lower().replace('a.m', '').replace('p.m', '').replace('.', ':').replace(' ', '').strip()
                if ':' not in clean: # Handle "9" or "09"
                    h, m = int(clean), 0
                else:
                    parts = clean.split(':')
                    h = int(parts[0])
                    m = int(parts[1]) if len(parts) > 1 else 0
                if 'p.m' in t_str.lower() and h < 12: h += 12
                # Special case: 12 PM is 12, 12 AM is 0
                if 'a.m' in t_str.lower() and h == 12: h = 0
                return h * 60 + m
            except: return 0

        lunch_start_min = min(to_min(t['startTime']) for t in lunch_ts)
        for i, p_label in enumerate(periods):
            # Find the average start time for this period label across all days
            sample_times = [to_min(t['startTime']) for t in valid_timeslots if t['label'] == p_label]
            if sample_times:
                avg_start = sum(sample_times) / len(sample_times)
                if avg_start < lunch_start_min:
                    morning_p_indices.append(i)
                else:
                    afternoon_p_indices.append(i)
    
    if not morning_p_indices or not afternoon_p_indices:
        mid = len(periods) // 2
        morning_p_indices = list(range(mid))
        afternoon_p_indices = list(range(mid, len(periods)))

    morning_p_indices_set = set(morning_p_indices)
    afternoon_p_indices_set = set(afternoon_p_indices)


    classrooms = data.get("classrooms", [])
    rooms = [c['roomNumber'] for c in classrooms]
    if not rooms: return {"error": "No classrooms available."}

    sections  = data.get("sections", [])
    subjects  = data.get("subjects", [])
    
    all_blocks = []
    total_requested_hours = defaultdict(int)
    for section in sections:
        sec_id = section['id']
        sec_subjects = [s for s in subjects if s.get('sectionId') == sec_id or s.get('sectionId') is None]
        for sub in sec_subjects:
            fac_id = sub.get('facultyId')
            if fac_id is None: continue
            hours = sub.get('weeklyHours', 1)
            total_requested_hours[sec_id] += hours
            sub_type = str(sub.get('type') or 'lecture').lower().strip()
            if sub_type == 'lab':
                remaining = hours
                while remaining > 0:
                    size = 3 if remaining >= 3 else (2 if remaining >= 2 else 1)
                    all_blocks.append({'section_id': sec_id, 'subject_id': sub.get('id'), 'subject_name': sub['name'], 'faculty_id': fac_id, 'type': 'lab', 'size': size})
                    remaining -= size
            else:
                for _ in range(hours):
                    all_blocks.append({'section_id': sec_id, 'subject_id': sub.get('id'), 'subject_name': sub['name'], 'faculty_id': fac_id, 'type': 'lecture', 'size': 1})

    if not all_blocks: return {"error": "No subjects assigned."}
    random.shuffle(all_blocks)

    day_period_indices = defaultdict(list)
    for d_idx, day in enumerate(days):
        for p_idx, period in enumerate(periods):
            if (day, period) in slot_lookup: day_period_indices[d_idx].append(p_idx)
    for d_idx in day_period_indices: day_period_indices[d_idx].sort()

    
    num_rooms = len(rooms)
    
    x = {} # (b, d, p, r) -> v
    v_by_slot_room = defaultdict(list)
    v_by_slot_fac = defaultdict(list)
    v_by_slot_sec = defaultdict(list)
    v_by_block = defaultdict(list)
    v_by_block_day = defaultdict(list)
    subj_slot_active = {}

    for b_idx, block in enumerate(all_blocks):
        size, f_id, s_id = block['size'], block['faculty_id'], block['section_id']
        block_type = block['type']
        for d_idx, day_periods in day_period_indices.items():
            for i in range(len(day_periods) - size + 1):
                start_p = day_periods[i]
                # Check if periods are contiguous
                if [day_periods[i+k] for k in range(size)] == list(range(start_p, start_p + size)):
                    # Lab Condition: Must be entirely in Morning or entirely in Afternoon
                    if block_type == 'lab':
                        block_indices = set(range(start_p, start_p + size))
                        if not block_indices.issubset(morning_p_indices_set) and not block_indices.issubset(afternoon_p_indices_set):
                            continue # Skip this start_p for lab

                    for r_idx in range(num_rooms):
                        v = model.NewBoolVar(f'b{b_idx}_d{d_idx}_p{start_p}_r{r_idx}')
                        x[(b_idx, d_idx, start_p, r_idx)] = v
                        v_by_block[b_idx].append(v)
                        v_by_block_day[(b_idx, d_idx)].append(v)
                        for k in range(size):
                            p_idx = start_p + k
                            v_by_slot_room[(d_idx, p_idx, r_idx)].append(v)
                            v_by_slot_fac[(d_idx, p_idx, f_id)].append(v)
                            v_by_slot_sec[(d_idx, p_idx, s_id)].append(v)
                            # Pre-cache for B2B penalty calculation
                            subj_slot_active.setdefault((d_idx, p_idx, s_id, sub.get('id')), []).append(v)


    for b_idx in range(len(all_blocks)):
        if v_by_block[b_idx]: model.AddAtMostOne(v_by_block[b_idx])
    for cov in v_by_slot_room.values(): model.AddAtMostOne(cov)
    for cov in v_by_slot_fac.values(): model.AddAtMostOne(cov)
    for cov in v_by_slot_sec.values(): model.AddAtMostOne(cov)

    fac_slot_active_cache = {} # (d, p, f) -> BoolVar or None
    sub_slot_active_cache = {} # (d, p, s, sub) -> BoolVar or None

    def get_entity_active(key, cache, var_map, prefix):
        if key not in cache:
            vs = var_map.get(key, [])
            if vs:
                active = model.NewBoolVar(f'{prefix}_{"_".join(map(str, key))}')
                model.AddMaxEquality(active, vs)
                cache[key] = active
            else: cache[key] = None
        return cache[key]

    # Section Contiguous Daily Schedule: Prevent holes/gaps in a student's day
    # If a section has classes at period i and period k (i < k), it MUST have classes at all periods j (i < j < k)
    for s_id in set(b['section_id'] for b in all_blocks):
        for d_idx, p_indices in day_period_indices.items():
            # Get variables for each period on this day
            day_sec_vars = []
            for p_idx in p_indices:
                a = get_entity_active((d_idx, p_idx, s_id), sub_slot_active_cache, v_by_slot_sec, 'sec_act_gap')
                day_sec_vars.append(a if a is not None else 0)
            
            # Enforce triplet implication
            n_p = len(day_sec_vars)
            for i in range(n_p):
                for k in range(i + 2, n_p):
                    for j in range(i + 1, k):
                        v_i = day_sec_vars[i]
                        v_j = day_sec_vars[j]
                        v_k = day_sec_vars[k]
                        if isinstance(v_i, int) and isinstance(v_k, int):
                            if v_i == 1 and v_k == 1 and isinstance(v_j, int) and v_j == 0:
                                model.AddBoolOr([]) # Infeasible
                            elif v_i == 1 and v_k == 1 and not isinstance(v_j, int):
                                model.Add(v_j == 1)
                        elif isinstance(v_i, int) and v_i == 1 and not isinstance(v_k, int):
                            if isinstance(v_j, int):
                                if v_j == 0: model.Add(v_k == 0)
                            else:
                                model.Add(v_j >= v_k)
                        elif isinstance(v_k, int) and v_k == 1 and not isinstance(v_i, int):
                            if isinstance(v_j, int):
                                if v_j == 0: model.Add(v_i == 0)
                            else:
                                model.Add(v_j >= v_i)
                        elif not isinstance(v_i, int) and not isinstance(v_k, int):
                            if isinstance(v_j, int):
                                if v_j == 0:
                                    model.Add(v_i + v_k <= 1)
                            else:
                                model.Add(v_j >= v_i + v_k - 1)


    for f_id in set(b['faculty_id'] for b in all_blocks):
        for d_idx in day_period_indices:
            fac_day = [v * block['size'] for b_idx, block in enumerate(all_blocks) if block['faculty_id'] == f_id for v in v_by_block_day[(b_idx, d_idx)]]
            if fac_day: model.Add(sum(fac_day) <= 7)

    subj_sec_lab = defaultdict(list)
    for b_idx, b in enumerate(all_blocks):
        if b['type'] == 'lab' and b['size'] > 1:
            subj_sec_lab[(b['subject_id'], b['section_id'])].append(b_idx)
            
    for (sub_id, s_id), lab_bs in subj_sec_lab.items():
        lab_on_day = []
        for d_idx in range(len(days)):
            d_var = model.NewBoolVar(f'sub{sub_id}_s{s_id}_l_d{d_idx}')
            lab_on_day.append(d_var)
            day_vs = [v for b in lab_bs for v in v_by_block_day[(b, d_idx)]]
            if day_vs: model.AddMaxEquality(d_var, day_vs)
            else: model.Add(d_var == 0)
        for d_idx in range(len(days)-1): model.Add(lab_on_day[d_idx] + lab_on_day[d_idx+1] <= 1)

    # Labs-either-morning-or-afternoon constraint (Strict per Section/Day)
    for s_id in set(b['section_id'] for b in all_blocks):
        for d_idx in day_period_indices:
            lab_in_morning = model.NewBoolVar(f'sec{s_id}_d{d_idx}_lab_morn')
            lab_in_afternoon = model.NewBoolVar(f'sec{s_id}_d{d_idx}_lab_aft')
            
            morn_vars = []
            aft_vars = []
            for (b_idx, dd_idx, start_p, r_idx), v in x.items():
                if dd_idx == d_idx and all_blocks[b_idx]['section_id'] == s_id and all_blocks[b_idx]['type'] == 'lab':
                    block_indices = set(range(start_p, start_p + all_blocks[b_idx]['size']))
                    if block_indices.issubset(morning_p_indices_set):
                        morn_vars.append(v)
                    elif block_indices.issubset(afternoon_p_indices_set):
                        aft_vars.append(v)
            
            if morn_vars: model.AddMaxEquality(lab_in_morning, morn_vars)
            else: model.Add(lab_in_morning == 0)
            
            if aft_vars: model.AddMaxEquality(lab_in_afternoon, aft_vars)
            else: model.Add(lab_in_afternoon == 0)
            
            model.Add(lab_in_morning + lab_in_afternoon <= 1)

    # Optimized B2B Penalty: Target same SUBJECT in same SECTION
    b2b_penalty = []

    for d_idx, p_indices in day_period_indices.items():
        for i in range(len(p_indices)-1):
            p1, p2 = p_indices[i], p_indices[i+1]
            if p2 != p1 + 1: continue
            
            # Faculty B2B
            for f_id in set(b['faculty_id'] for b in all_blocks):
                a1 = get_entity_active((d_idx, p1, f_id), fac_slot_active_cache, v_by_slot_fac, 'f_act')
                a2 = get_entity_active((d_idx, p2, f_id), fac_slot_active_cache, v_by_slot_fac, 'f_act')
                if a1 is not None and a2 is not None:
                    b = model.NewBoolVar('')
                    model.Add(b >= a1 + a2 - 1)
                    b2b_penalty.append(b)

            # Subject B2B
            for sub_id in set(b['subject_id'] for b in all_blocks):
                for s_id in set(b['section_id'] for b in all_blocks):
                    a1 = get_entity_active((d_idx, p1, s_id, sub_id), sub_slot_active_cache, subj_slot_active, 'sub_act')
                    a2 = get_entity_active((d_idx, p2, s_id, sub_id), sub_slot_active_cache, subj_slot_active, 'sub_act')
                    if a1 is not None and a2 is not None:
                        b = model.NewBoolVar('')
                        model.Add(b >= a1 + a2 - 1)
                        b2b_penalty.append(b)

    # Section Active Days: Minimize to pack classes into fewer days
    sec_day_active_vars = []
    for s_id in set(b['section_id'] for b in all_blocks):
        for d_idx in day_period_indices:
            sda = model.NewBoolVar(f'sda_{s_id}_{d_idx}')
            d_vars = []
            for (b_idx, dd_idx), vs in v_by_block_day.items():
                if dd_idx == d_idx and all_blocks[b_idx]['section_id'] == s_id:
                    d_vars.extend(vs)
            if d_vars:
                model.AddMaxEquality(sda, d_vars)
                sec_day_active_vars.append(sda)
            else:
                model.Add(sda == 0)

    # Late Period Penalty: Push free periods to the end of the day
    late_period_vars = []
    for (b_idx, d_idx, p_start, r_idx), v in x.items():
        # Penalize scheduling later in the day to prevent gaps
        late_period_vars.append(v * p_start)

    total_sch = sum(v * all_blocks[k[0]]['size'] for k, v in x.items())
    
    # Strong penalty for NOT scheduling a block to eliminate "Free" periods
    scheduling_penalty = sum((1 - sum(v_by_block[b_idx])) * 10000 for b_idx in range(len(all_blocks)) if v_by_block[b_idx])

    # Objective: Maximize total scheduled, minimize B2B, minimize active days per section, and minimize late periods
    model.Maximize(total_sch * 10000 - scheduling_penalty - sum(b2b_penalty) * 10 - sum(sec_day_active_vars) * 50 - sum(late_period_vars))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 180.0 # Increase to 3 mins for hard packing
    status = solver.Solve(model)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        timetable = []
        scheduled_hours = defaultdict(int)
        for (b, d, p_s, r), var in x.items():
            if solver.Value(var):
                blk = all_blocks[b]
                scheduled_hours[blk['section_id']] += blk['size']
                for o in range(blk['size']):
                    timetable.append({"day": days[d], "period": periods[p_s+o], "sectionId": blk['section_id'], "subjectId": blk['subject_id'], "facultyId": blk['faculty_id'], "room": rooms[r]})
        

            
        return {"timetable": timetable}
    else: return {"error": "Constraints might be too strict."}
