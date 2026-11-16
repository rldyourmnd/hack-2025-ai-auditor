set shell := ["bash", "-euo", "pipefail", "-c"]

export NEXT_TELEMETRY_DISABLED := "1"
export PYTHONDONTWRITEBYTECODE := "1"

# Lists the project commands.
default:
    @just --list

# Prepares dependencies with the selected Python and Node SDKs, without a source build.
setup:
    uv venv --allow-existing --python "$(command -v python3)" backend/.venv
    uv pip install --python backend/.venv/bin/python --only-binary :all: -r backend/requirements.txt -r .ci/requirements-checks.txt
    npm --prefix frontend ci --ignore-scripts --no-audit --no-fund

# Checks sources, workflows and history without building or calling a provider.
check:
    just --fmt --check
    just check-backend
    npm --prefix frontend run lint -- --no-cache
    frontend/node_modules/.bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
    actionlint
    zizmor --offline --no-progress .github
    gitleaks git --no-banner --redact .

# Applies the existing backend and frontend automatic lint fixes.
fix:
    backend/.venv/bin/ruff check --fix backend
    npm --prefix frontend run lint:fix
    just --fmt

# Runs the existing backend publication smoke cases.
[working-directory("backend")]
test:
    .venv/bin/python -m pytest -q -p no:cacheprovider

# Builds the frontend's standalone output.
build:
    npm --prefix frontend run build

# Runs every component check, test and build.
verify: check test build

[private]
[working-directory("backend")]
check-backend:
    .venv/bin/ruff check .
