import json
import time
from scheduler import generate_timetable

with open('../payload.json', 'r') as f:
    data = json.load(f)

start = time.time()
print("Starting generation...")
res = generate_timetable(data)
print(f"Finished in {time.time() - start:.2f} seconds.")
if 'error' in res:
    print("ERROR:", res['error'])
else:
    print(f"Generated {len(res['timetable'])} entries.")
