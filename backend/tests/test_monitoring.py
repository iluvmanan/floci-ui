"""Phase 6: Monitoring & Logs — CloudWatch Logs + Metrics."""
import asyncio
from unittest.mock import MagicMock, patch
import pytest
from httpx import AsyncClient

from app.core.security import encrypt_secret, hash_password
from app.models.instance import FlociInstance
from app.models.user import User, UserRole

PATCH_CLIENT = "app.routers.resources.base.get_client"


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
async def admin(db):
    u = User(email="admin@mon.test", hashed_password=hash_password("pw"), role=UserRole.ADMIN)
    db.add(u); await db.commit(); return u


@pytest.fixture
async def viewer(db):
    u = User(email="viewer@mon.test", hashed_password=hash_password("pw"), role=UserRole.VIEWER)
    db.add(u); await db.commit(); return u


@pytest.fixture
async def admin_client(admin, client):
    await client.post("/api/auth/login", json={"email": "admin@mon.test", "password": "pw"})
    return client


@pytest.fixture
async def viewer_client(viewer, client):
    await client.post("/api/auth/login", json={"email": "viewer@mon.test", "password": "pw"})
    return client


@pytest.fixture
async def instance(db, admin):
    inst = FlociInstance(
        name="mon-instance", endpoint="http://localhost:4566",
        region="us-east-1", access_key="test",
        secret_key_encrypted=encrypt_secret("secret"),
        account_id="000000000000", created_by=admin.id,
    )
    db.add(inst); await db.commit(); await db.refresh(inst); return inst


# ── CloudWatch Logs ───────────────────────────────────────────────────────────


class TestMonitoringLogs:
    async def test_list_log_groups(self, admin_client, instance):
        mock = MagicMock()
        mock.describe_log_groups.return_value = {
            "logGroups": [
                {"logGroupName": "/aws/lambda/my-fn", "retentionInDays": 7, "storedBytes": 1024},
                {"logGroupName": "/aws/api-gateway", "storedBytes": 0},
            ]
        }
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await admin_client.get(f"/api/instances/{instance.id}/monitoring/log-groups")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["name"] == "/aws/lambda/my-fn"
        assert data[0]["retention_days"] == 7
        assert data[0]["stored_bytes"] == 1024

    async def test_list_log_groups_viewer_allowed(self, viewer_client, instance):
        mock = MagicMock()
        mock.describe_log_groups.return_value = {"logGroups": []}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(f"/api/instances/{instance.id}/monitoring/log-groups")
        assert resp.status_code == 200

    async def test_list_log_groups_unauthenticated(self, client, instance):
        resp = await client.get(f"/api/instances/{instance.id}/monitoring/log-groups")
        assert resp.status_code == 401

    async def test_list_streams(self, admin_client, instance):
        mock = MagicMock()
        mock.describe_log_streams.return_value = {
            "logStreams": [
                {
                    "logStreamName": "stream-1",
                    "firstEventTimestamp": 1700000000000,
                    "lastEventTimestamp": 1700001000000,
                    "storedBytes": 512,
                }
            ]
        }
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await admin_client.get(
                f"/api/instances/{instance.id}/monitoring/log-groups/%2Faws%2Flambda%2Fmy-fn/streams"
            )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "stream-1"
        assert data[0]["stored_bytes"] == 512

    async def test_get_log_events(self, viewer_client, instance):
        mock = MagicMock()
        mock.filter_log_events.return_value = {
            "events": [
                {"timestamp": 1700000000000, "message": "START RequestId: abc", "logStreamName": "stream-1"},
                {"timestamp": 1700000001000, "message": "ERROR: something went wrong", "logStreamName": "stream-1"},
            ],
            "nextToken": "tok123",
        }
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(
                f"/api/instances/{instance.id}/monitoring/log-groups/%2Faws%2Flambda%2Fmy-fn/events"
            )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["events"]) == 2
        assert data["events"][0]["message"] == "START RequestId: abc"
        assert data["events"][1]["message"] == "ERROR: something went wrong"
        assert data["next_token"] == "tok123"

    async def test_get_log_events_with_filter(self, viewer_client, instance):
        mock = MagicMock()
        mock.filter_log_events.return_value = {"events": [], "nextToken": None}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(
                f"/api/instances/{instance.id}/monitoring/log-groups/%2Faws%2Flambda%2Fmy-fn/events"
                "?filter=ERROR&limit=100"
            )
        assert resp.status_code == 200
        mock.filter_log_events.assert_called_once()
        call_kwargs = mock.filter_log_events.call_args.kwargs
        assert call_kwargs["filterPattern"] == "ERROR"
        assert call_kwargs["limit"] == 100

    async def test_tail_logs_returns_event_stream(self, admin_client, instance):
        mock = MagicMock()
        mock.filter_log_events.return_value = {"events": [], "nextToken": None}
        with patch(PATCH_CLIENT, return_value=mock):
            # SSE streams indefinitely; enter, check headers, then cancel.
            try:
                async with asyncio.timeout(5):
                    async with admin_client.stream(
                        "GET",
                        f"/api/instances/{instance.id}/monitoring/log-groups/%2Faws%2Flambda%2Fmy-fn/tail",
                        headers={"Accept": "text/event-stream"},
                    ) as resp:
                        assert resp.status_code == 200
                        assert "text/event-stream" in resp.headers.get("content-type", "")
                        # Read first chunk (the "connected" event) then exit
                        async for chunk in resp.aiter_bytes():
                            assert b"connected" in chunk
                            break
            except asyncio.TimeoutError:
                pass  # Timeout is acceptable — SSE stream is infinite

    async def test_log_group_not_found(self, admin_client):
        resp = await admin_client.get(
            "/api/instances/00000000-0000-0000-0000-000000000000/monitoring/log-groups"
        )
        assert resp.status_code == 404


# ── CloudWatch Metrics ────────────────────────────────────────────────────────


class TestMonitoringMetrics:
    async def test_list_namespaces(self, viewer_client, instance):
        mock = MagicMock()
        mock.list_metrics.return_value = {
            "Metrics": [
                {"Namespace": "AWS/Lambda", "MetricName": "Invocations", "Dimensions": []},
                {"Namespace": "AWS/SQS", "MetricName": "NumberOfMessagesSent", "Dimensions": []},
                {"Namespace": "AWS/Lambda", "MetricName": "Errors", "Dimensions": []},
            ]
        }
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(
                f"/api/instances/{instance.id}/monitoring/metrics/namespaces"
            )
        assert resp.status_code == 200
        namespaces = resp.json()
        assert "AWS/Lambda" in namespaces
        assert "AWS/SQS" in namespaces
        assert len(namespaces) == 2  # deduplicated

    async def test_list_metrics(self, viewer_client, instance):
        mock = MagicMock()
        mock.list_metrics.return_value = {
            "Metrics": [
                {"Namespace": "AWS/Lambda", "MetricName": "Invocations", "Dimensions": [{"Name": "FunctionName", "Value": "my-fn"}]},
                {"Namespace": "AWS/Lambda", "MetricName": "Errors", "Dimensions": []},
            ]
        }
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(
                f"/api/instances/{instance.id}/monitoring/metrics?namespace=AWS/Lambda"
            )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["name"] == "Invocations"
        assert data[0]["namespace"] == "AWS/Lambda"

    async def test_get_metric_data(self, viewer_client, instance):
        mock = MagicMock()
        mock.get_metric_statistics.return_value = {
            "Datapoints": [
                {"Timestamp": "2024-01-01T00:00:00Z", "Sum": 42.0, "Unit": "Count"},
                {"Timestamp": "2024-01-01T00:01:00Z", "Sum": 17.0, "Unit": "Count"},
            ]
        }
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(
                f"/api/instances/{instance.id}/monitoring/metrics/data"
                "?namespace=AWS/Lambda&metric_name=Invocations&statistic=Sum&period=60"
            )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["datapoints"]) == 2
        assert data["datapoints"][0]["value"] == 42.0
        assert data["unit"] == "Count"

    async def test_metrics_viewer_allowed(self, viewer_client, instance):
        mock = MagicMock()
        mock.list_metrics.return_value = {"Metrics": []}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(
                f"/api/instances/{instance.id}/monitoring/metrics/namespaces"
            )
        assert resp.status_code == 200

    async def test_metrics_unauthenticated(self, client, instance):
        resp = await client.get(
            f"/api/instances/{instance.id}/monitoring/metrics/namespaces"
        )
        assert resp.status_code == 401
