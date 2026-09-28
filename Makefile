.PHONY: up down backend frontend test-backend test-frontend test-e2e spec-check

up:
	docker compose up -d
down:
	docker compose down
backend:
	cd backend && uvicorn app.main:app --reload --port 8000
frontend:
	cd frontend && npm run dev
test-backend:
	cd backend && pytest -q
test-frontend:
	cd frontend && npm test
test-e2e:
	cd e2e && npx playwright test
spec-check:
	diff specs/chain_service.py backend/app/chain/base.py
