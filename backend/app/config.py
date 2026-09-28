"""Application settings (dev / test / testnet are all driven by env vars)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "dev"  # dev | test | testnet
    api_prefix: str = "/api"
    database_url: str = "sqlite:///./overvault.db"
    auto_create_tables: bool = True  # dev convenience; Docker/CI use Alembic instead

    # Private storage + encryption at rest
    storage_dir: str = "./storage"
    master_key: str = "dev-master-key-change-me"  # any string; a 32-byte key is derived from it
    max_upload_mb: int = 25

    # Auth
    auth_mode: str = "dev"  # dev | wallet
    jwt_secret: str = "dev-jwt-secret-change-me-please-32b-min"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    # wallet_auto_provision removed - per wallet_auth.md section 9, unregistered
    # wallet addresses must get 403 (address_not_found), never be auto-created.
    # See ADR 0007.

    # Workers
    run_expiry_job: bool = True
    expiry_job_interval_seconds: int = 60

    # Chain selection is read by Sriganesh's layer; the backend core never calls it.
    chain_mode: str = "fake"  # fake | demo | real

    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
