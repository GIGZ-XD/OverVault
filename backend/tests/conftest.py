import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import dev_auth
from app.auth.jwt import create_access_token
from app.config import get_settings
from app.db import get_db
from app.main import create_app
from app.models import Base, User
from app.services import audit


@pytest.fixture()
def db(tmp_path, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "storage_dir", str(tmp_path / "storage"))
    monkeypatch.setattr(settings, "auth_mode", "dev")
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    dev_auth.seed_dev_users(session)
    yield session
    session.close()


@pytest.fixture()
def audit_calls(monkeypatch):
    """Spy on audit.record so tests don't depend on Sriganesh's real implementation."""
    calls = []
    monkeypatch.setattr(audit, "record", lambda db, **kw: calls.append(kw))
    return calls


@pytest.fixture()
def client(db, audit_calls):
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


@pytest.fixture()
def users(db):
    """Aliases the shared fixture ids (u1-u4, see dev_auth.py) plus Vineeth's
    u5 back to the role names the rest of the test suite already uses."""
    rows = {u.id: u for u in db.scalars(select(User))}
    return {
        "employee": rows["u1"],
        "manager": rows["u2"],
        "admin": rows["u3"],
        "auditor": rows["u4"],
        "employee2": rows["u5"],
    }


@pytest.fixture()
def auth(users):
    def _headers(name: str) -> dict:
        return {"Authorization": f"Bearer {create_access_token(users[name])}"}

    return _headers


@pytest.fixture()
def uploaded(client, auth):
    """An employee's uploaded file (v1)."""
    r = client.post(
        "/api/files",
        headers=auth("employee"),
        files={"upload": ("report.txt", b"hello v1", "text/plain")},
        data={"comment": "first"},
    )
    assert r.status_code == 201, r.text
    return r.json()
