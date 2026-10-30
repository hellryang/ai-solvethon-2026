from fastapi import APIRouter

from .savings_routes import router as savings_router
from .talent_pr_routes import router as talent_pr_router

# Add team endpoints to this router, e.g. @router.get('/...').
router = APIRouter(prefix="/api/team", tags=["team"])

# Net-savings flow (남는 돈 비교): /api/team/savings/...
router.include_router(savings_router)
# Self-PR profiles that companies browse (인재 PR): /api/team/pr/...
router.include_router(talent_pr_router)
