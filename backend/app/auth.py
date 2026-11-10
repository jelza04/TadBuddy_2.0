"""Authentication.

AUTH_MODE=dev       trust an X-User-Id header (UUID). Local development only.
AUTH_MODE=supabase  verify the Supabase Auth access token sent by the frontend
                    (Authorization: Bearer <token>).
                    - Asymmetric signing keys (current Supabase default): verified
                      against the project's public JWKS — no secret needed.
                    - Legacy HS256 projects: set SUPABASE_JWT_SECRET instead.
"""

from functools import lru_cache

import jwt
from fastapi import Header, HTTPException

from .config import settings


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    if not settings.supabase_url:
        raise RuntimeError("SUPABASE_URL is required for AUTH_MODE=supabase")
    return jwt.PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json", cache_keys=True)


def _verify_supabase(token: str) -> str:
    try:
        alg = jwt.get_unverified_header(token).get("alg")
        if alg == "HS256":
            if not settings.jwt_secret:
                raise HTTPException(401, "HS256 token but SUPABASE_JWT_SECRET is not set")
            claims = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"], audience="authenticated")
        else:
            key = _jwks_client().get_signing_key_from_jwt(token).key
            claims = jwt.decode(token, key, algorithms=["ES256", "RS256"], audience="authenticated")
    except jwt.PyJWTError as exc:
        raise HTTPException(401, "invalid or expired token") from exc
    return claims["sub"]


async def user_id_from_request(
    authorization: str | None = Header(None),
    x_user_id: str | None = Header(None),
) -> str:
    if settings.auth_mode == "dev":
        if not x_user_id:
            raise HTTPException(401, "X-User-Id header required in dev mode")
        return x_user_id
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing bearer token")
    return _verify_supabase(authorization[7:])
