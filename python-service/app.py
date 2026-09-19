"""Local solver HTTP service.

Runs on 127.0.0.1 only, spawned and supervised by the Electron main process
(see electron/services/scheduler.ts). No internet access is required or used.
"""
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, List, Optional
from scheduler import generate_timetable

app = FastAPI(title="Timetable Scheduler")


class ClassroomItem(BaseModel):
    roomNumber: str
    id: Optional[int] = None
    type: Optional[str] = "lecture"     # lecture | lab | special
    capacity: Optional[int] = 0


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
    maxPeriodsDay: Optional[int] = None
    maxPeriodsWeek: Optional[int] = None


class SectionItem(BaseModel):
    id: int
    name: str
    departmentId: int
    strength: Optional[int] = None
    maxPeriodsDay: Optional[int] = None


class TimeslotItem(BaseModel):
    id: int
    dayOfWeek: str
    label: str
    startTime: str
    endTime: str


class OccupiedSlotItem(BaseModel):
    day: str
    period: str
    facultyId: Optional[int] = None
    room: Optional[str] = None


class GenerateRequest(BaseModel):
    classrooms: List[ClassroomItem]
    subjects: List[SubjectItem]
    faculty: List[FacultyItem]
    sections: List[SectionItem]
    timeslots: List[TimeslotItem]
    days: List[str]
    occupiedSlots: Optional[List[OccupiedSlotItem]] = None
    # {teacherId: [timeSlotId, ...]} — pruned from the model as hard constraints.
    teacherUnavailable: Optional[Dict[int, List[int]]] = None
    enforceRoomTypes: Optional[bool] = False
    enforceCapacity: Optional[bool] = False
    timeLimitSeconds: Optional[float] = None
    maxWorkers: Optional[int] = None


@app.post("/generate-timetable")
def generate(payload: GenerateRequest):
    data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    counts = (
        f"sections={len(data.get('sections', []))} "
        f"subjects={len(data.get('subjects', []))} "
        f"rooms={len(data.get('classrooms', []))} "
        f"slots={len(data.get('timeslots', []))}"
    )
    print(f"[solver] request received ({counts})", flush=True)

    try:
        result = generate_timetable(data)
    except Exception as exc:  # never lose the reason for a failed solve
        print(f"[solver] unhandled error: {exc}", flush=True)
        return {
            "status": "ERROR",
            "timetable": [],
            "error": f"Solver crashed: {exc}",
            "diagnostics": [{
                "code": "SOLVER_ERROR",
                "severity": "error",
                "message": f"The solver failed unexpectedly: {exc}",
            }],
        }

    # Structured result (status + diagnostics) is returned with HTTP 200 so the
    # caller always receives the explainable report, even for failures.
    result.setdefault("status", "ERROR")
    print(
        f"[solver] status={result.get('status')} "
        f"entries={len(result.get('timetable') or [])} "
        f"diagnostics={len(result.get('diagnostics') or [])}",
        flush=True,
    )
    return result


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/version")
def version():
    return {"service": "timetable-solver", "status": "healthy"}


if __name__ == "__main__":
    # Entry point for the PyInstaller-bundled solver binary. The Electron main
    # process spawns this and passes its own loopback host/port.
    import argparse

    import uvicorn

    parser = argparse.ArgumentParser(description="Local timetable solver")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args, _ = parser.parse_known_args()
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
