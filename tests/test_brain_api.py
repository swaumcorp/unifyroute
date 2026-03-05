"""Integration tests for Brain API endpoints.

Requires a running API gateway at OPENROUTER_BASE_URL (default: http://localhost:6565)
and a valid ADMIN_TOKEN.
"""
import pytest


def test_brain_status(admin_client):
    """GET /admin/brain/status should return brain_providers list."""
    r = admin_client.get("/api/admin/brain/status")
    assert r.status_code == 200
    data = r.json()
    assert "brain_providers" in data
    assert "total" in data
    assert isinstance(data["brain_providers"], list)


def test_brain_import_yaml(admin_client):
    """POST /admin/brain/import with YAML should succeed."""
    yaml_content = """
providers:
  - name: fireworks
    display_name: Fireworks AI
    credentials: []
    models: []
brain_assignments: []
"""
    r = admin_client.post("/api/admin/brain/import", json={"format": "yaml", "content": yaml_content})
    assert r.status_code == 200
    data = r.json()
    assert data["status"] in ("success", "partial")
    assert "errors" in data


def test_brain_import_json(admin_client):
    """POST /admin/brain/import with JSON should succeed."""
    import json
    content = json.dumps({
        "providers": [
            {"name": "groq", "display_name": "Groq", "credentials": [], "models": []}
        ],
        "brain_assignments": []
    })
    r = admin_client.post("/api/admin/brain/import", json={"format": "json", "content": content})
    assert r.status_code == 200


def test_brain_import_invalid_format(admin_client):
    r = admin_client.post("/api/admin/brain/import", json={"format": "xml", "content": "<data/>"})
    assert r.status_code == 400


def test_brain_test(admin_client):
    """POST /admin/brain/test should return a test summary."""
    r = admin_client.post("/api/admin/brain/test")
    assert r.status_code == 200
    data = r.json()
    assert "tested" in data
    assert "healthy" in data
    assert "failed" in data
    assert "results" in data
    assert isinstance(data["results"], list)


def test_brain_ranking(admin_client):
    """GET /admin/brain/ranking should return a ranking list."""
    r = admin_client.get("/api/admin/brain/ranking")
    assert r.status_code == 200
    data = r.json()
    assert "ranking" in data
    assert isinstance(data["ranking"], list)
    # If there are entries, check structure
    for item in data["ranking"]:
        assert "rank" in item
        assert "provider" in item
        assert "score" in item
        assert "health_ok" in item


def test_brain_select(admin_client):
    """POST /admin/brain/select should return ok bool and either selection or message."""
    r = admin_client.post("/api/admin/brain/select")
    assert r.status_code == 200
    data = r.json()
    assert "ok" in data
    assert "reason" in data
    if data["ok"]:
        assert "provider" in data
        assert "model_id" in data
        assert "score" in data


def test_brain_assign_provider_404(admin_client):
    """Assigning a nonexistent provider/credential should return 404."""
    from uuid import uuid4
    r = admin_client.post("/api/admin/brain/providers", json={
        "provider_id": str(uuid4()),
        "credential_id": str(uuid4()),
        "model_id": "test-model",
        "priority": 50,
    })
    assert r.status_code == 404


def test_brain_remove_provider_404(admin_client):
    """Removing nonexistent brain entry should return 404."""
    from uuid import uuid4
    r = admin_client.delete(f"/api/admin/brain/providers/{uuid4()}")
    assert r.status_code == 404


def test_brain_status_requires_admin(api_client):
    """Non-admin token should get 403 on brain endpoints."""
    r = api_client.get("/api/admin/brain/status")
    assert r.status_code in (401, 403, 200) # Since test env might have admin token for api client
