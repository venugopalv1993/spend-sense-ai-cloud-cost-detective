# CloudPulse AI — Conversational Cloud Cost Optimization Platform

An AI-powered cloud engagement platform that transforms AWS infrastructure metrics into actionable, personalized recommendations through a conversational UI. Instead of raw metrics, CloudPulse AI explains insights in natural language and helps technical and business users make smarter cloud decisions.

![CloudPulse AI](./image.png)


## Key Features

- **AI Chat Assistant** — Ask "Why is my AWS bill high?" and get specific breakdowns
- **Cloud Efficiency Score** — Gamified 0-100 score tracking optimization progress
- **Scale Down/Up Detection** — Identifies over-provisioned and at-risk resources
- **Predictive Analysis** — Forecasts next month's spend and budget overrun risks
- **One-Click Optimization Simulator** — Preview savings before making changes
- **Role-Based Recommendations** — Tailored for DevOps, Finance, and CTO personas
- **Executive Dashboard** — Technical and Business views with toggle

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 (Vite 8 + TypeScript + Tailwind CSS 4) |
| Backend | Python (FastAPI + Uvicorn) |
| Auth | Custom JWT Auth (bcrypt + PyJWT, HS256, 24h expiry) |
| Cloud Scanning | Boto3 (AWS SDK — CloudWatch, Cost Explorer, Budgets, Trusted Advisor) |
| AI Analysis | OpenAI API / Azure OpenAI / Groq (configurable LLM) |
| Database | PostgreSQL (psycopg2) |
| Live Updates | FastAPI WebSocket |

## Architecture

```
                              ┌──────────────┐
                              │     USER     │
                              └──────┬───────┘
                                     │
                                     ▼
                           ┌───────────────────┐
                           │  REACT FRONTEND   │
                           └────────┬──────────┘
                                    :
                                    : Login / Signup
                                    ▼
                           ┌───────────────────┐
                           │  PYTHON BACKEND   │
                           │    (FastAPI)      │
                           │                   │
                           │  · Custom JWT Auth│
                           └───┬───────┬───┬───┘
                               :       :   :
                ┌──────────────┘       :   └──────────────┐
                :                      :                  :
                ▼                      ▼                  ▼
         ┌─────────────┐     ┌──────────────┐    ┌──────────────┐
         │   BOTO3     │     │   FASTAPI    │    │   OPENAI     │
         │  (AWS SDK)  │     │  WEBSOCKET   │    │    API       │
         │             │     │  (Progress)  │    │              │
         │ EC2, RDS,   │     └──────┬───────┘    │ Cost Analysis│
         │ S3, Lambda  │            :            └──────┬───────┘
         └──────┬──────┘            :                   :
                :                   : Live updates      :
                ▼                   ▼                   :
         ┌─────────────┐   ┌───────────────┐            :
         │    AWS      │   │    REACT      │            :
         │  (Account/  │   │  (Progress    │            :
         │   Region)   │   │   Tracker)    │            :
         └─────────────┘   └───────────────┘            :
                                                        ▼
                                                 ┌──────────────┐
                                                 │  POSTGRESQL  │
                                                 │   (Local /   │
                                                 │   Docker)    │
                                                 │              │
                                                 │ · users      │
                                                 │ · analyses   │
                                                 └──────┬───────┘
                                                        :
                                                        : Stored results
                                                        ▼
                                                 ┌───────────────┐
                                                 │    REACT      │
                                                 │ (Final Report │
                                                 │  + Suggestions│
                                                 │  + Fixes)     │
                                                 └───────────────┘
```

## Request Flow

```
①  User ─·─·─► React ─·─·─► FastAPI Auth ─·─·─► JWT (PostgreSQL)

②  User selects AWS Region / Account ─·─·─► Python Backend

③  Python ─·─·─► Boto3 (AWS SDK) ─·─·─► Fetches all resources in account/region

④  Python ─·─·─► FastAPI WebSocket ─·─·─► React (live progress)

⑤  Python ─·─·─► OpenAI API ─·─·─► Cost analysis

⑥  Python ─·─·─► PostgreSQL ─·─·─► Stores analysis history

⑦  React ◄·─·─·─ Final report with suggestions & fixes
```

## AWS Services Scanned

| Service | Data Collected |
|---|---|
| **EC2 Instances** | Instance ID, Name, Type, State, Region, Tags |
| **EBS Volumes** | Volume ID, Name, Size (GB), Type (gp2/gp3/io1…), State, Attachments |
| **Elastic IPs** | Allocation ID, Public IP, Association status |
| **RDS Instances** | DB Identifier, Instance Class, Engine, State, Multi-AZ, Storage |
| **S3 Buckets** | Bucket name, Creation date (global, scanned in us-east-1) |
| **Lambda Functions** | Function name, ARN, Runtime, Memory size, Timeout |
| **Load Balancers** | Name, ARN, Type (ALB/NLB/Classic), State |

Supports scanning a single region or all regions at once. Uses Boto3 paginators for large accounts.

## What It Detects

- **Over-provisioned resources** — EC2 instances, RDS databases, or Lambda functions sized larger than needed
- **Unused resources** — Unattached EBS volumes, unused Elastic IPs, idle load balancers, empty S3 buckets
- **Misconfigurations** — Wrong instance types, missing Savings Plans, no Reserved Instances, GP2 instead of GP3
- **Storage & logging costs** — Excessive CloudWatch log retention, no S3 lifecycle policies, missing Intelligent-Tiering

Each issue includes severity (high/medium/low), estimated monthly savings, and a copyable AWS CLI fix command.

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/signup` | No | Create a new user account |
| `POST` | `/api/auth/login` | No | Authenticate and receive JWT |
| `GET` | `/health` | No | Health check |
| `GET` | `/api/regions` | JWT | List all available AWS regions |
| `POST` | `/api/analyze` | JWT | Trigger resource scan + AI analysis |
| `GET` | `/api/history` | JWT | Get user's past analyses |
| `GET` | `/api/history/{id}` | JWT | Get a single analysis by ID |
| `WS` | `/ws/progress/{id}` | No | Real-time scan progress updates |

## Frontend Pages

| Route | Page | Description |
|---|---|---|
| `/login` | Login | Email/password authentication |
| `/signup` | Signup | Account registration with validation |
| `/` | Dashboard | Region selector, trigger analysis, live progress bar |
| `/report/:id` | Report | Issues list with severity badges, savings, CLI fixes |
| `/history` | History | Past analyses with region, timestamp, savings summary |

## Database Schema

**`users`** — Registered accounts

| Column | Type |
|---|---|
| `id` | SERIAL PRIMARY KEY |
| `email` | VARCHAR(255) UNIQUE NOT NULL |
| `password_hash` | VARCHAR(255) NOT NULL |
| `created_at` | TIMESTAMP DEFAULT NOW() |

**`analyses`** — Stored scan results

| Column | Type |
|---|---|
| `id` | SERIAL PRIMARY KEY |
| `user_id` | INTEGER REFERENCES users(id) |
| `region` | VARCHAR(50) NOT NULL |
| `resources_scanned` | INTEGER DEFAULT 0 |
| `issues_found` | INTEGER DEFAULT 0 |
| `estimated_savings` | VARCHAR(50) |
| `analysis_result` | JSONB |
| `status` | VARCHAR(20) DEFAULT 'pending' |
| `created_at` | TIMESTAMP DEFAULT NOW() |

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL
- AWS CLI configured (`aws configure`) with Access Key ID and Secret Access Key
- AI API key (OpenAI, Azure OpenAI, or Groq)

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/cost_detective
JWT_SECRET=your-secret-key

# AWS credentials (or use AWS CLI profile)
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# AI provider — pick one:

# Option A: OpenAI
OPENAI_API_KEY=sk-...

# Option B: Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_MODEL=gpt-4-turbo
OPENAI_API_VERSION=2024-06-01

# Option C: Groq (or any OpenAI-compatible API)
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=llama-3.3-70b-versatile
OPENAI_API_KEY=your-groq-key
```

### PostgreSQL

Create a database for the app. If using a local PostgreSQL installation:

```bash
createdb costdetective
```

Or with Docker:

```bash
docker run --name pg-cost-detective -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=costdetective -p 5432:5432 -d postgres:15
```

Update `DATABASE_URL` in your `.env` to match your setup.

### Backend

```bash
cd AWS/backend
pip install -r requirements.txt
cp .env.example .env   # fill in your credentials
uvicorn main:app --reload
```

The API starts at `http://localhost:8000`.

### Frontend

```bash
cd AWS/frontend
npm install
npm run dev
```

The app starts at `http://localhost:5173`.

## Project Structure

```
AWS/
├── backend/
│   ├── main.py              # FastAPI app, routes, WebSocket
│   ├── auth.py              # JWT auth (signup, login, token verification)
│   ├── aws_scanner.py       # Boto3 resource scanning across 7 services
│   ├── ai_analyzer.py       # AI cost analysis (OpenAI / Azure / Groq)
│   ├── db.py                # PostgreSQL schema and queries
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Routes and auth state
│   │   ├── main.tsx          # Entry point
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Signup.tsx
│   │   │   ├── Dashboard.tsx # Region select, scan trigger, progress
│   │   │   ├── Report.tsx    # Issues, severity, savings, CLI fixes
│   │   │   └── History.tsx   # Past analyses list
│   │   └── components/
│   │       ├── Navbar.tsx
│   │       └── ProgressTracker.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
└── README.md
```

## How It Works

1. User signs up / logs in via custom JWT auth (credentials stored in PostgreSQL)
2. Selects an AWS region or scans all regions
3. Python backend fetches all resources using Boto3 (AWS SDK)
4. Live progress is streamed to the UI via FastAPI WebSocket
5. Resource data is sent to OpenAI API for cost analysis
6. Analysis results are stored in PostgreSQL
7. Final report with cost breakdown, suggestions, and fix commands (AWS CLI) is displayed

## Demonstration

[![Watch the demo](./image.png)](./demo.mp4)