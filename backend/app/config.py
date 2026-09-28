from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    auth_mode: Literal["dev", "wallet"] = "dev"
    chain_mode: Literal["fake", "testnet"] = "fake"
    database_url: str = "postgresql+psycopg://overvault:overvault@localhost:5432/overvault"
    jwt_secret: str = "change-me"
    jwt_expires_minutes: int = 60
    storage_endpoint: str = "http://localhost:9000"
    storage_bucket: str = "overvault-private"
    file_encryption_key: str = "change-me"
    mst_rpc_url: str = ""
    mst_chain_id: str = ""


settings = Settings()
