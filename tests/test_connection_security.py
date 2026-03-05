import pytest
import httpx
import uuid
import os

class TestConnectionSecurity:
    def test_connection_with_valid_token(self, admin_client: httpx.Client):
        r_create = admin_client.post("/api/admin/keys", json={
            "label": f"connection-key-{uuid.uuid4().hex[:6]}",
            "scopes": ["api"],
        })
        assert r_create.status_code == 200
        token = r_create.json()["token"]
        key_id = r_create.json()["id"]

        base_url = os.environ.get("OPENROUTER_BASE_URL", "http://localhost:6565")
        with httpx.Client(base_url=base_url, headers={"Authorization": f"Bearer {token}"}) as api_client:
            res = api_client.get("/api/v1/models")
            assert res.status_code == 200
            
        # cleanup
        admin_client.delete(f"/api/admin/keys/{key_id}")

    def test_connection_with_expired_token(self, admin_client: httpx.Client):
        r_create = admin_client.post("/api/admin/keys", json={
            "label": f"connection-expired-key-{uuid.uuid4().hex[:6]}",
            "scopes": ["api"],
        })
        assert r_create.status_code == 200
        token = r_create.json()["token"]
        key_id = r_create.json()["id"]

        # delete it immediately
        admin_client.delete(f"/api/admin/keys/{key_id}")

        base_url = os.environ.get("OPENROUTER_BASE_URL", "http://localhost:6565")
        with httpx.Client(base_url=base_url, headers={"Authorization": f"Bearer {token}"}) as api_client:
            res = api_client.get("/api/v1/models")
            assert res.status_code == 401
            
    def test_cors_rejects_unknown_origin(self):
        base_url = os.environ.get("OPENROUTER_BASE_URL", "http://localhost:6565")
        with httpx.Client(base_url=base_url) as client:
            res = client.options(
                "/api/v1/models",
                headers={
                    "Origin": "http://malicious.com",
                    "Access-Control-Request-Method": "GET"
                }
            )
            # CORS middleware responds 400 when origin is explicitly denied, or ignores it
            # The exact behavior depends on fastAPI cors configuration,
            # but Malicious.com MUST NOT be in allowed origins.
            assert "access-control-allow-origin" not in res.headers or res.headers["access-control-allow-origin"] != "http://malicious.com"
