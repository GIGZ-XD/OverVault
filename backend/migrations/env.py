<<<<<<< HEAD
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine

from app.config import get_settings
from app.models import Base  # imports every model

# Sriganesh's audit_outbox model: import it here once it exists so it is migrated too.
try:
    import app.models.audit_outbox  # noqa: F401
except ImportError:
    pass

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)
target_metadata = Base.metadata
url = get_settings().database_url


def run_migrations_offline():
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, render_as_batch=True)
=======
import os
import sys

from alembic import context
from sqlalchemy import engine_from_config, pool

# Add backend root to Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.audit_outbox import Base

# Alembic Config object
config = context.config

# Disable this because alembic.ini has no logging sections
# fileConfig(config.config_file_name)


# Metadata for autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in offline mode."""

    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

>>>>>>> origin/develop
    with context.begin_transaction():
        context.run_migrations()


<<<<<<< HEAD
def run_migrations_online():
    engine = create_engine(url)
    with engine.connect() as conn:
        context.configure(connection=conn, target_metadata=target_metadata, render_as_batch=True)
=======
def run_migrations_online() -> None:
    """Run migrations in online mode."""

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

>>>>>>> origin/develop
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
