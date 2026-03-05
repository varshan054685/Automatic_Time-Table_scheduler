from fastapi import FastAPI
import random

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Python service running"}

@app.get("/generate")
async def generate():
    # Sample timetable data
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    periods = ["Period 1", "Period 2", "Period 3", "Period 4", "Period 5"]
    
    timetable = []
    for day in days:
        for period in periods:
            timetable.append({
                "day": day,
                "period": period,
                "subject": random.choice(["Mathematics", "Physics", "Computer Science", "Data Structures", "Algorithms"]),
                "faculty": random.choice(["Dr. Smith", "Prof. Johnson", "Dr. Williams", "Ms. Davis"]),
                "room": random.choice(["101", "102", "201", "202"])
            })
            
    return {"timetable": timetable}
