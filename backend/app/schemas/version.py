from datetime import datetime

from pydantic import BaseModel, ConfigDict


class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    file_id: str
    version_number: int
    sha256: str
    size_bytes: int
    author_id: str
    comment: str
    rolled_back_from: int | None = None
    created_at: datetime


class RollbackRequest(BaseModel):
    comment: str = ""
