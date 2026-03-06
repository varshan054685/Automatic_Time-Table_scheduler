from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from scheduler import generate_timetable


class GenerateTimetableRequest(BaseModel):
    classrooms: list[dict] = Field(default_factory=list)
    subjects: list[dict] = Field(default_factory=list)
    faculty: list[dict] = Field(default_factory=list)
    sections: list[dict] = Field(default_factory=list)
    timeslots: list[dict] = Field(default_factory=list)
    days: list[str] = Field(default_factory=list)


app = FastAPI(title="Timetable Scheduler Service", version="1.0.0")


@app.get("/")
def root():
    return {"message": "Timetable FastAPI service is running"}


@app.post("/generate-timetable")
def generate_timetable_endpoint(payload: GenerateTimetableRequest):
    try:
        return generate_timetable(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to generate timetable") from exc
