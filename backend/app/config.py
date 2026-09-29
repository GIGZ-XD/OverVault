"""Application settings (dev / test / testnet are all driven by env vars)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

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

    # Workers
    run_expiry_job: bool = True
    expiry_job_interval_seconds: int = 60

    # Chain selection
    chain_mode: str = "fake"  # fake | demo | real | testnet

    # MST Blockchain settings (read from .env)
    mst_rpc_url: str = "https://testnetrpc.mstblockchain.com"
    mst_chain_id: int = 91562037
    mst_private_key: str = ""
    mst_backend_signer_key: str = ""
    mstscan_base_url: str = "https://mstscan.io"

    # Contract addresses on MST Testnet
    contract_address_audit: str = ""
    contract_address_integrity: str = ""
    contract_address_ownership: str = ""
    contract_address_permission: str = ""

    # EVM aliases
    evm_rpc_url: str = ""
    evm_private_key: str = ""

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

    def get_effective_private_key(self) -> str:
        return (
            self.mst_backend_signer_key.strip()
            or self.mst_private_key.strip()
            or self.evm_private_key.strip()
        )

    def get_effective_rpc_url(self) -> str:
        return (
            self.mst_rpc_url.strip()
            or self.evm_rpc_url.strip()
            or "https://testnetrpc.mstblockchain.com"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
