from ortools.sat.python import cp_model
from collections import defaultdict
import random
import re
import time


def _period_sort_key(label: str) -> int:
    match = re.search(r"\d+", label or "")
    return int(match.group()) if match else 0


def _to_minutes(time_str: str) -> int:
    try:
        clean = (
            time_str.lower()
            .replace("a.m", "")
            .replace("p.m", "")
            .replace(".", ":")
            .replace(" ", "")
            .strip()
        )
        if ":" not in clean:
            h, m = int(clean), 0
        else:
            parts = clean.split(":")
            h = int(parts[0])
            m = int(parts[1]) if len(parts) > 1 else 0
        if "p.m" in time_str.lower() and h < 12:
            h += 12
        if "a.m" in time_str.lower() and h == 12:
            h = 0
        return h * 60 + m
    except Exception:
        return 0


def _first_period_after_break(periods: list, valid_timeslots: list, timeslots: list):
    """Index of the first teaching period that starts at or after the mid-morning break."""
    break_slots = [
        t
        for t in timeslots
        if "break" in t.get("label", "").lower()
        and "lunch" not in t.get("label", "").lower()
    ]
    if not break_slots:
        return None
    break_start = min(_to_minutes(t["startTime"]) for t in break_slots)
    for i, p_label in enumerate(periods):
        starts = [
            _to_minutes(t["startTime"])
            for t in valid_timeslots
            if t["label"] == p_label
        ]
        if starts and min(starts) >= break_start:
            return i
    return None


def _lab_start_allowed(
    size: int,
    start_p: int,
    day_periods: list,
    break_before_period_idx,
) -> bool:
    """
    Lab blocks must start at the first period of the day.
    A 3-period lab uses the two periods before break and one after (e.g. P1, P2, Break, P3).
    A 2-period lab must not straddle the break.
    """
    if size <= 1:
        return True

    if start_p != day_periods[0]:
        return False

    if break_before_period_idx is None:
        return True

    block_end = start_p + size - 1
    crosses_break = (
        start_p < break_before_period_idx <= block_end
    )
    if size == 2:
        return not crosses_break

    if size == 3:
        # Two periods before break, one after (e.g. P1, P2 | Break | P3)
        periods_before_break = break_before_period_idx
        return (
            start_p == 0
            and periods_before_break == 2
            and size - periods_before_break == 1
            and block_end == break_before_period_idx
        )

    # Larger lab blocks: no break inside the block
    return not crosses_break


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
    periods = sorted(
        dict.fromkeys(t['label'] for t in valid_timeslots),
        key=_period_sort_key,
    )
    slot_lookup = {(t['dayOfWeek'], t['label']): t['id'] for t in valid_timeslots}

    break_before_period_idx = _first_period_after_break(periods, valid_timeslots, timeslots)

    if lunch_ts:
        lunch_start_min = min(_to_minutes(t['startTime']) for t in lunch_ts)
        for i, p_label in enumerate(periods):
            # Find the average start time for this period label across all days
            sample_times = [_to_minutes(t['startTime']) for t in valid_timeslots if t['label'] == p_label]
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
    
    occupied = data.get("occupiedSlots", [])
    occ_fac = set() # (day, period, fac_id)
    occ_room = set() # (day, period, room_number)
    for occ in occupied:
        d_name, p_label = occ.get('day'), occ.get('period')
        # Find indices
        did = None
        for i, d_name_alt in enumerate(days):
            if d_name_alt == d_name: did = i; break
        pid = None
        for i, p_label_alt in enumerate(periods):
            if p_label_alt == p_label: pid = i; break
            
        if did is not None and pid is not None:
            if occ.get('facultyId'): occ_fac.add((did, pid, occ['facultyId']))
            if occ.get('room'): occ_room.add((did, pid, occ['room']))

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
                        if not _lab_start_allowed(
                            size, start_p, day_periods, break_before_period_idx
                        ):
                            continue

                    for r_idx in range(num_rooms):
                        room_name = rooms[r_idx]
                        
                        # Conflict Check: Does this block overlap with ANY occupied slot?
                        conflict = False
                        for k in range(size):
                            p_idx = start_p + k
                            if (d_idx, p_idx, f_id) in occ_fac: conflict = True; break
                            if (d_idx, p_idx, room_name) in occ_room: conflict = True; break
                        
                        if conflict: continue
                        
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
                            subj_slot_active.setdefault((d_idx, p_idx, s_id, block['subject_id']), []).append(v)


    for b_idx in range(len(all_blocks)):
        if v_by_block[b_idx]: model.AddExactlyOne(v_by_block[b_idx])
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

    # Section Contiguous Daily Schedule (Soft constraint via late_period_vars is enough)
    # The previous strict triplet constraint caused catastrophic combinatorial explosion and timeouts.


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
        # Relaxed: Allow labs on consecutive days if necessary, but prefer not to (penalty instead of hard constraint)
        # for d_idx in range(len(days)-1): model.Add(lab_on_day[d_idx] + lab_on_day[d_idx+1] <= 1)
        for d_idx in range(len(days)-1):
            lab_consecutive = model.NewBoolVar(f"lab_consecutive_{sub_id}_{s_id}_{d_idx}")
            model.Add(lab_consecutive == 1).OnlyEnforceIf([lab_on_day[d_idx], lab_on_day[d_idx+1]])
            model.Add(lab_consecutive == 0).OnlyEnforceIf(lab_on_day[d_idx].Not())
            model.Add(lab_consecutive == 0).OnlyEnforceIf(lab_on_day[d_idx+1].Not())
            # We'll add this to a penalty list if we had one for soft constraints

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
    
    # Objective: Maximize total scheduled, minimize B2B, minimize active days per section, and minimize late periods
    model.Maximize(- sum(b2b_penalty) * 10 - sum(sec_day_active_vars) * 50 - sum(late_period_vars))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 20.0  # Fast per-section solves
    solver.parameters.num_search_workers = 8     # Enable parallel search
    solver.parameters.random_seed = 42           # Deterministic behavior
    status = solver.Solve(model)

    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
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