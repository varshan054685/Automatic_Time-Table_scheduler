import json, sys
sys.path.append("/home/pc/Desktop/Automatic_Time-Table_scheduler/python-service")
from scheduler import generate_timetable

with open("/tmp/payload.json", "r") as f:
    data = json.load(f)

res = generate_timetable(data)
print(json.dumps(res, indent=2) if 'timetable' in res else res)
