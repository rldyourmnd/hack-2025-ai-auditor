from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ...config import Settings
from ...services.auth_service import AuthService
from ...schemas.auth import (
    LoginRequest,
    SignupRequest,
    RefreshRequest,
    TokenPairResponse,
    MeResponse,
    ProviderListResponse,
)


router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_service() -> AuthService:
    return AuthService(Settings())


@router.post("/login", response_model=TokenPairResponse)
async def login(payload: LoginRequest, svc: AuthService = Depends(get_auth_service)) -> TokenPairResponse:
    user = await svc.authenticate_user(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error_code": "invalid_credentials", "message": "Invalid email or password"})
    access, refresh, expires_in = await svc.issue_tokens(user)
    return TokenPairResponse(access_token=access, refresh_token=refresh, expires_in=expires_in)


@router.post("/signup", response_model=TokenPairResponse)
async def signup(payload: SignupRequest, svc: AuthService = Depends(get_auth_service)) -> TokenPairResponse:
    user = await svc.signup_user(payload.email, payload.password, payload.display_name)
    access, refresh, expires_in = await svc.issue_tokens(user)
    return TokenPairResponse(access_token=access, refresh_token=refresh, expires_in=expires_in)


@router.post("/token/refresh", response_model=TokenPairResponse)
async def refresh_token(payload: RefreshRequest, svc: AuthService = Depends(get_auth_service)) -> TokenPairResponse:
    res = await svc.refresh_tokens(payload.refresh_token)
    if not res:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error_code": "invalid_refresh", "message": "Refresh token is invalid or expired"})
    access, refresh, expires_in = res
    return TokenPairResponse(access_token=access, refresh_token=refresh, expires_in=expires_in)


@router.post("/logout")
async def logout() -> dict:
    # For MVP: rely on refresh rotation; access tokens naturally expire
    return {"status": "ok"}


@router.get("/me", response_model=MeResponse)
async def me() -> MeResponse:
    # MVP stub: returns anonymous for now; will read from auth middleware later
    return MeResponse(id="anonymous", email="anonymous@example.com", display_name="Anonymous", orgs=[], projects=[])


@router.get("/check")
async def check() -> dict:
    return {"ok": True}


@router.get("/jwks.json")
async def jwks() -> dict:
    # MVP: symmetric secret; JWKS would require RSA keys — to be added later
    return {"keys": []}


@router.get("/providers", response_model=ProviderListResponse)
async def providers() -> ProviderListResponse:
    return ProviderListResponse(providers=["google", "github"])


@router.get("/oauth/{provider}/start")
async def oauth_start(provider: str) -> dict:
    # MVP placeholder — real redirect URL will be produced by Authlib integration
    return {"provider": provider, "status": "not_implemented"}


@router.get("/oauth/{provider}/callback")
async def oauth_callback(provider: str) -> dict:
    # MVP placeholder — would exchange code for tokens and issue JWT/refresh
    return {"provider": provider, "status": "not_implemented"}


