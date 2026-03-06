# College Automatic Timetable Scheduler - Progress Report

## Completed Features
- **Master Data Management**: CRUD operations for Departments, Classrooms, Subjects, Faculty, Sections, and Time Slots.
- **Excel Import (Enhanced)**: Bulk import with robust duplicate detection and broad field mapping.
    - **Faculty Fix**: Resolved issue where Faculty/Subjects imports were failing due to missing database columns (`code` in faculty, `faculty_id` in subjects) and strict column name requirements.
    - **Duplicate Detection**: Skips existing records based on unique identifiers (e.g., Code, Email, Room Number) with case-insensitive matching.
    - **Validation**: Broad column mapping (e.g., "Staff Name", "Subject", "Hours") and automatic department assignment.
    - **UI Feedback**: Integrated loading states and summary toasts for all entities.
- **Timetable Generation**: Hybrid engine with greedy algorithm and FastAPI microservice integration.
- **Visualization**: Grid-based timetable view with multi-dimensional filtering.

## Fixed Issues
- **Database Schema Sync**: Manually added `code` to `faculty` and `faculty_id` to `subjects` tables to match the schema definitions after detection of missing columns in production environment.
- **Import Mapping**: Expanded column header variations to support more diverse Excel files (e.g., "Full Name", "Professor", "Mail").

## Pending Environment Setup
- **Python**: Requires Python 3 and `uvicorn` in PATH. Currently `dev:python` script is updated but might need manual installation of dependencies if not present.

## Usage
1. Ensure at least one Department is created.
2. Use "Import Excel" on Faculty or Subjects page.
3. If "Department" is missing in Excel, the first available department will be assigned as fallback.
