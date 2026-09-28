"""Role-based access rules + the domain exceptions shared by every service.

Domain exceptions live here (rather than a new errors.py) so the frozen folder
structure is untouched. main.py maps them to HTTP responses.
"""
from app.models.user import Role, User


class DomainError(Exception):
    status_code = 400
    code = "domain_error"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class NotFound(DomainError):
    status_code, code = 404, "not_found"


class Forbidden(DomainError):
    status_code, code = 403, "forbidden"


class Conflict(DomainError):
    status_code, code = 409, "conflict"


class Invalid(DomainError):
    status_code, code = 422, "invalid"


class IntegrityViolation(DomainError):
    status_code, code = 500, "integrity_violation"


# Capabilities per role (file-level access is decided in services/permissions.py)
_CAPS: dict[Role, set[str]] = {
    Role.employee: {"file.create"},
    Role.manager: {"file.create", "approval.review", "user.list", "dashboard.global"},
    Role.auditor: {"file.read_all_metadata", "user.list", "dashboard.global"},
    Role.admin: {
        "file.create",
        "approval.review",
        "user.list",
        "dashboard.global",
        "file.read_all_metadata",
        "file.manage_any",
        "protection.loosen",
    },
}


def has_capability(user: User, capability: str) -> bool:
    return capability in _CAPS.get(user.role, set())


def require_capability(user: User, capability: str) -> None:
    if not has_capability(user, capability):
        raise Forbidden(f"Role '{user.role.value}' is not allowed to do this ({capability}).")
