from fastapi import FastAPI
from scheduler import generate_timetable

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Timetable AI service running"}

@app.post("/generate")
def generate(data: dict):

    timetable = generate_timetable(data)

    return {"timetable": timetable}