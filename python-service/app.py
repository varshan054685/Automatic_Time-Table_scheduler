from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from scheduler import generate_timetable

app = FastAPI(title="Timetable Scheduler")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ClassroomItem(BaseModel):
    roomNumber: str

class SubjectItem(BaseModel):
    id: int
    name: str
    departmentId: int
    sectionId: Optional[int] = None
    facultyId: Optional[int] = None
    weeklyHours: int
    type: Optional[str] = "lecture"

class FacultyItem(BaseModel):
    id: int
    name: str
    departmentId: int

class SectionItem(BaseModel):
    id: int
    name: str
    departmentId: int

class TimeslotItem(BaseModel):
    id: int
    dayOfWeek: str
    label: str
    startTime: str
    endTime: str

class GenerateRequest(BaseModel):
    classrooms: List[ClassroomItem]
    subjects: List[SubjectItem]
    faculty: List[FacultyItem]
    sections: List[SectionItem]
    timeslots: List[TimeslotItem]
    days: List[str]

@app.post("/generate-timetable")
def generate(payload: GenerateRequest):
    print("Incoming payload:", payload)
    
    data = payload.model_dump() if hasattr(payload, 'model_dump') else payload.dict()
    result = generate_timetable(data)

    print("Generated result:", result)

    if "error" in result:
        print("Scheduler error:", result["error"])
        raise HTTPException(status_code=400, detail=result["error"])

    return result

@app.get("/health")
def health_check():
    return {"status": "healthy"}
