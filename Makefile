.PHONY: install run test migrate openapi
install:
	cd backend && pip install -r requirements-dev.txt
run:
	cd backend && uvicorn app.main:app --reload --port 8000
test:
	cd backend && python -m pytest
migrate:
	cd backend && alembic upgrade head
# Dump the live schema so specs/openapi.yaml can be diffed/updated (needs: pip install pyyaml)
openapi:
	cd backend && python -c "import json,yaml; from app.main import app; print(yaml.safe_dump(app.openapi(), sort_keys=False))" > ../specs/openapi.generated.yaml
