.PHONY: install run test migrate openapi frontend docker up down

# Backend
install:
	cd backend && pip install -r requirements-dev.txt
run:
	cd backend && uvicorn app.main:app --reload --port 8000
test:
	cd backend && python -m pytest
migrate:
	cd backend && alembic upgrade head

# Frontend
frontend:
	cd frontend && npm run dev

# Docker
up:
	docker compose up --build -d
down:
	docker compose down

# OpenAPI spec
openapi:
	cd backend && python -c "import json,yaml; from app.main import app; print(yaml.safe_dump(app.openapi(), sort_keys=False))" > ../specs/openapi.generated.yaml

# Full stack (dev)
dev:
	@echo "Start backend:  make run"
	@echo "Start frontend: make frontend"
	@echo "Or use Docker:  make up"
