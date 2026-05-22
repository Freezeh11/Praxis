from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import levels, laws, score, progress

app = FastAPI(title="Praxis API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(levels.router, prefix="/api")
app.include_router(laws.router, prefix="/api")
app.include_router(score.router, prefix="/api")
app.include_router(progress.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "Praxis API is running", "docs": "/docs"}
