# Backend Implementation

## FastAPI Architecture

The backend is built with FastAPI and organized in the `backend/` directory with a modular structure:

### Application Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI application entry point
│   ├── api/routers/         # API route definitions
│   │   ├── analysis.py      # Prompt analysis endpoints
│   │   └── prompt_base.py   # Prompt-base management
│   ├── core/
│   │   ├── config.py        # Pydantic Settings configuration
│   │   └── database.py      # Database connection management
│   ├── models/              # SQLAlchemy/SQLModel database models
│   │   └── prompts.py       # Prompt and relation models
│   ├── schemas/             # Pydantic request/response schemas
│   │   ├── pipeline.py      # Analysis pipeline schemas
│   │   └── prompts.py       # Prompt-related schemas
│   ├── services/            # Business logic modules
│   │   ├── llm.py          # LLM provider adapters (OpenAI/Anthropic)
│   │   ├── embeddings.py   # Embedding services
│   │   └── prompt_base.py  # Prompt-base operations
│   └── pipeline/            # LangGraph analysis pipeline
│       ├── graph.py         # Main pipeline orchestration
│       ├── language_nodes.py    # Language detection & translation
│       ├── format_nodes.py      # Markup validation & fixes
│       ├── vocab_nodes.py       # Vocabulary analysis
│       ├── contradiction_nodes.py # Contradiction detection
│       ├── entropy_nodes.py     # Semantic entropy analysis
│       ├── judge_nodes.py       # LLM-as-judge scoring
│       ├── patch_nodes.py       # Patch generation
│       └── question_nodes.py    # Clarification questions
├── alembic/                 # Database migrations
├── requirements.txt         # Python dependencies
└── pyproject.toml          # Project configuration & tools
```

### Core Technologies

- **FastAPI** - Modern async web framework
- **Pydantic v2** - Data validation and settings management
- **SQLAlchemy/SQLModel** - Database ORM with type safety
- **Alembic** - Database migration management
- **LangGraph** - Pipeline orchestration for analysis workflow
- **OpenAI/Anthropic** - Multi-provider LLM integration
- **Redis** - Caching and session storage
- **PostgreSQL** - Primary database

### API Endpoints

**Analysis Endpoints**
- `POST /analyze` - Comprehensive prompt analysis returning `{report, patches, questions}`
- `POST /apply` - Apply safe/risky patches by ID
- `POST /clarify` - Process clarification answers and update analysis
- `GET /export/{id}.{format}` - Export processed prompts (md/xml)
- `GET /report/{id}.json` - Download detailed analysis reports

**Prompt-base Management**
- `POST /prompt-base/add` - Add prompt to knowledge base
- `POST /prompt-base/check` - Check for conflicts with existing prompts
- `GET /prompt-base/search` - Search prompts by criteria
- `GET /prompt-base/{id}` - Retrieve specific prompt

**System Endpoints**
- `GET /healthz` - Health check with component status
- `GET /` - API information and documentation links

### Analysis Pipeline

**LangGraph Implementation** (`pipeline/graph.py`):

1. **Language Processing**
   - `detect_lang` → `maybe_translate_to_en`
   - Automatic language detection and optional translation

2. **Format Validation**
   - `ensure_format` → `lint_markup`
   - XML/Markdown validation with safe automated fixes

3. **Vocabulary Analysis**
   - `vocab_unify` - Lexical consistency checks and safe replacements

4. **Contradiction Detection**
   - `find_contradictions` - Intra and inter-prompt conflict analysis

5. **Semantic Analysis**
   - `semantic_entropy` - N-sample generation → embeddings → clustering analysis

6. **Quality Scoring**
   - `judge_score` - Rubric-based LLM evaluation across multiple dimensions

7. **Improvement Generation**
   - `propose_patches` - Safe/risky categorized improvement suggestions
   - `build_questions` - Interactive clarification questions

### Configuration Management

**Environment Variables** (Pydantic Settings):
- Database: `DATABASE_URL`, `POSTGRES_*`
- LLM Providers: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- Models: `OPENAI_MODEL_CHEAP/STANDARD/PREMIUM`
- Analysis: `ENTROPY_N` (semantic entropy samples)
- Application: `ENV`, `LOG_LEVEL`

### Database Models

**Core Entities**:
- `Prompt` - Stored prompts with metadata and analysis history
- `PromptRelation` - Inter-prompt relationships (depends_on, overrides, conflicts_with)
- `AnalysisReport` - Cached analysis results and metrics
- `Patch` - Improvement suggestions with safety categorization

### Development Features

**Code Quality Tools**:
- **Ruff** - Fast Python linter and formatter
- **MyPy** - Type checking
- **Pytest** - Testing framework with fixtures for LLM mocking
- **Pre-commit hooks** - Automated code quality checks

**Logging & Monitoring**:
- Structured JSON logging with request tracing
- Health checks for all dependencies (DB, Redis, OpenAI)
- Error handling with detailed exception reporting

**Development Workflow**:
- Hot reload with volume mounting
- Mock LLM services for testing
- Database migrations with Alembic
- Environment-based configuration (dev/prod)
