# VPS Deployment Instructions

## ✅ CORS Issues Fixed + Environment Management!

### Changes Made:

1. **Backend CORS Configuration** (backend/app/main.py):
   - Added VPS IP to allowed origins: `http://89.104.66.243:3000`
   - Added comprehensive CORS headers
   - Enabled all necessary HTTP methods

2. **Nginx Reverse Proxy** (infra/nginx.conf):
   - Added nginx service on port 80
   - Configured proxy for frontend and API
   - Added CORS headers in nginx
   - Handles preflight OPTIONS requests

3. **Environment Configuration**:
   - Updated `NEXT_PUBLIC_API_BASE=http://89.104.66.243`
   - Frontend will now connect to VPS IP instead of localhost

### Environment Management:

Created separate environment files:
- **`.env.local`** - Local development (NEXT_PUBLIC_API_BASE=http://localhost:8000)
- **`.env.vps`** - VPS production (NEXT_PUBLIC_API_BASE=http://89.104.66.243)
- **`.env`** - Currently set to local config

### Deployment on VPS:

1. **Copy files to VPS:**
   ```bash
   scp -r . root@89.104.66.243:/root/curestry/
   ```

2. **On VPS, switch to VPS config and run:**
   ```bash
   cd /root/curestry/infra
   cp .env.vps .env
   docker compose up -d --build
   ```

3. **For local development:**
   ```bash
   cd infra
   cp .env.local .env
   docker compose up -d --build
   ```

3. **Services will be available at:**
   - **Frontend**: http://89.104.66.243 (port 80)
   - **API Direct**: http://89.104.66.243:8000
   - **API via Nginx**: http://89.104.66.243/healthz, /analyze, /prompt-base

### Architecture:
```
Internet → Nginx (port 80) → {
  / → Frontend (Next.js on port 3000)
  /healthz, /analyze, /prompt-base → API (FastAPI on port 8000)
}
```

### CORS Headers Now Include:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With`

### Local Development:
- Still works on localhost with all the same features
- Nginx proxy available on http://localhost

## 🚀 Ready for production deployment!
