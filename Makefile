.PHONY: dev build up down logs migrate migrate-create test lint format help

# Development (hot-reload)
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.floci.yml up

prod:
	docker compose -f docker-compose.yml -f docker-compose.floci.yml up -d

# Production build
build:
	docker compose build

# Start production
up:
	docker compose up -d

# Stop all
down:
	docker compose down

# Tail logs
logs:
	docker compose logs -f

# Run DB migrations (inside running backend container)
migrate:
	docker compose exec backend alembic upgrade head

# Create a new migration: make migrate-create msg="add_api_keys_table"
migrate-create:
	docker compose exec backend alembic revision --autogenerate -m "$(msg)"

# Run backend tests
test:
	docker compose exec backend pytest tests/ -v

# Run backend tests (standalone, no docker)
test-local:
	cd backend && python -m pytest tests/ -v

# Lint backend
lint-backend:
	cd backend && ruff check app/ && mypy app/

# Format backend
format-backend:
	cd backend && ruff format app/

# Lint frontend
lint-frontend:
	cd frontend && npm run lint

# Type-check frontend
typecheck:
	cd frontend && npm run type-check

# Full lint
lint: lint-backend lint-frontend

# Start with bundled Floci demo instance
dev-with-floci:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.floci.yml up

# Generate a JWT_SECRET
gen-jwt-secret:
	python3 -c "import secrets; print(secrets.token_hex(32))"

# Generate an ENCRYPTION_KEY
gen-encryption-key:
	python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

help:
	@echo "Usage:"
	@echo "  make dev              - Start development environment with hot-reload"
	@echo "  make up               - Start production environment"
	@echo "  make down             - Stop all containers"
	@echo "  make migrate          - Run database migrations"
	@echo "  make migrate-create   - Create new migration (msg=<description>)"
	@echo "  make test             - Run backend tests"
	@echo "  make lint             - Lint backend + frontend"
	@echo "  make dev-with-floci   - Start dev + bundled Floci demo"
	@echo "  make gen-jwt-secret   - Generate a JWT_SECRET value"
	@echo "  make gen-encryption-key - Generate an ENCRYPTION_KEY value"
