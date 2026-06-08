import os
import uuid
import asyncio
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

from aws_scanner import get_regions, scan_resources
from ai_analyzer import analyze_costs
from db import init_db, save_analysis, get_history, get_analysis_by_id
from auth import signup_user, login_user, get_current_user

app = FastAPI(title="AI Cloud Cost Detective (AWS)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active WebSocket connections by analysis_id
progress_connections: dict[str, WebSocket] = {}


@app.on_event("startup")
def startup():
    """Initialize database tables on startup."""
    try:
        init_db()
        print("Database initialized successfully.")
    except Exception as e:
        print(f"Database initialization failed: {e}")


class AnalyzeRequest(BaseModel):
    region: str
    analysis_id: str | None = None


class AuthRequest(BaseModel):
    email: str
    password: str


# --- Auth endpoints (public) ---

@app.post("/api/auth/signup")
def signup(request: AuthRequest):
    """Create a new user account."""
    return signup_user(request.email, request.password)


@app.post("/api/auth/login")
def login(request: AuthRequest):
    """Login and get JWT token."""
    return login_user(request.email, request.password)


# --- Protected endpoints ---

@app.get("/api/regions")
def list_regions(user: dict = Depends(get_current_user)):
    """Return all available AWS regions."""
    try:
        regions = get_regions()
        return {"regions": regions}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyze")
async def analyze(request: AnalyzeRequest, user: dict = Depends(get_current_user)):
    """Scan resources in the specified AWS region (or 'all' for all regions)."""
    region = request.region.strip().lower()
    analysis_id = request.analysis_id or str(uuid.uuid4())
    user_id = user["user_id"]

    if region != "all":
        try:
            valid_regions = get_regions()
        except RuntimeError as e:
            raise HTTPException(status_code=500, detail=str(e))
        if region not in valid_regions:
            raise HTTPException(status_code=400, detail=f"Invalid region: {region}")

    # Send progress updates
    await _send_progress(analysis_id, "Connecting to AWS...", 10)

    try:
        await _send_progress(analysis_id, f"Scanning EC2 instances in {region}...", 20)
        await _send_progress(analysis_id, "Scanning EBS volumes...", 30)
        await _send_progress(analysis_id, "Scanning RDS databases...", 40)
        await _send_progress(analysis_id, "Scanning S3 buckets...", 50)
        await _send_progress(analysis_id, "Scanning Lambda functions...", 60)
        resources = scan_resources(region)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    await _send_progress(analysis_id, "Analyzing costs with AI...", 75)
    analysis = analyze_costs(resources)

    await _send_progress(analysis_id, "Storing results...", 90)
    # Save to database
    try:
        db_analysis_id = save_analysis(
            user_id=user_id,
            region=region,
            resources_scanned=len(resources),
            issues_found=len(analysis.get("issues", [])),
            estimated_savings=analysis.get("total_estimated_savings", "Unknown"),
            analysis_result=analysis,
        )
    except Exception as e:
        print(f"Failed to save analysis: {e}")
        db_analysis_id = None

    # Send complete signal via WebSocket
    ws = progress_connections.get(analysis_id)
    if ws:
        try:
            await ws.send_json({"type": "complete", "message": "Analysis complete", "percent": 100})
        except Exception:
            pass
        progress_connections.pop(analysis_id, None)

    return {
        "analysis_id": analysis_id,
        "db_id": db_analysis_id,
        "region": region,
        "resources_scanned": len(resources),
        "resources": resources,
        "analysis": analysis,
    }


@app.get("/api/history")
def history(user: dict = Depends(get_current_user)):
    """Get past analyses for the authenticated user."""
    try:
        analyses = get_history(user["user_id"])
        return {"analyses": analyses}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/history/{analysis_id}")
def history_detail(analysis_id: str, user: dict = Depends(get_current_user)):
    """Get a specific analysis by ID."""
    try:
        aid = int(analysis_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Analysis not found")
    result = get_analysis_by_id(aid, user["user_id"])
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return result


@app.websocket("/ws/progress/{analysis_id}")
async def websocket_progress(websocket: WebSocket, analysis_id: str):
    """WebSocket endpoint for live progress updates."""
    await websocket.accept()
    progress_connections[analysis_id] = websocket
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        progress_connections.pop(analysis_id, None)


async def _send_progress(analysis_id: str, message: str, percent: int = 0):
    """Send a progress message to the connected WebSocket client."""
    ws = progress_connections.get(analysis_id)
    if ws:
        try:
            await ws.send_json({"type": "progress", "message": message, "percent": percent})
            await asyncio.sleep(0.3)
        except Exception:
            progress_connections.pop(analysis_id, None)


@app.get("/health")
def health():
    return {"status": "ok"}
