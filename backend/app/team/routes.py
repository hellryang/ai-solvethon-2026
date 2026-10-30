from fastapi import APIRouter

from .savings_routes import router as savings_router

# Add team endpoints to this router, e.g. @router.get('/...').
router = APIRouter(prefix="/api/team", tags=["team"])

# Net-savings flow (남는 돈 비교): /api/team/savings/...
router.include_router(savings_router)
