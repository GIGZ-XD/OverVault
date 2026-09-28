"""FastAPI dependencies: db session, current user, chain service selection."""
from app.chain.fake import FakeChainService
from app.chain.real import RealChainService
from app.config import settings


def get_chain_service():
    return FakeChainService() if settings.chain_mode == "fake" else RealChainService()
