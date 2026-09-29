from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    auth_mode: Literal["dev", "wallet"] = "dev"
    chain_mode: Literal["fake", "testnet", "real"] = "fake"
    database_url: str = (
        "postgresql+psycopg://overvault:overvault@localhost:5432/overvault"
    )
    jwt_secret: str = "change-me"
    jwt_expires_minutes: int = 60
    storage_endpoint: str = "http://localhost:9000"
    storage_bucket: str = "overvault-private"
    file_encryption_key: str = "change-me"
    mst_rpc_url: str = ""
    mst_chain_id: str = ""

    # ── Real EVM chain settings (used by RealChainService) ─────────────────
    evm_rpc_url: str | None = None
    evm_private_key: str | None = None
    contract_address_audit: str | None = None
    contract_address_integrity: str | None = None
    contract_address_ownership: str | None = None
    contract_address_permission: str | None = None


settings = Settings()
