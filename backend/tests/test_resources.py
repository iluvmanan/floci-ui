"""Phase 5: Resource Browser — S3, DynamoDB, Lambda, SQS, SNS, Kinesis, EventBridge, Cognito."""
from unittest.mock import MagicMock, patch
import pytest
from httpx import AsyncClient
from botocore.exceptions import ClientError

from app.core.security import encrypt_secret, hash_password
from app.models.instance import FlociInstance
from app.models.user import User, UserRole

PATCH_CLIENT = "app.routers.resources.base.get_client"


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
async def admin(db):
    u = User(email="admin@res.test", hashed_password=hash_password("admin-pw"), role=UserRole.ADMIN)
    db.add(u); await db.commit(); return u


@pytest.fixture
async def operator(db):
    u = User(email="operator@res.test", hashed_password=hash_password("op-pw"), role=UserRole.OPERATOR)
    db.add(u); await db.commit(); return u


@pytest.fixture
async def viewer(db):
    u = User(email="viewer@res.test", hashed_password=hash_password("viewer-pw"), role=UserRole.VIEWER)
    db.add(u); await db.commit(); return u


@pytest.fixture
async def admin_client(admin, client):
    await client.post("/api/auth/login", json={"email": "admin@res.test", "password": "admin-pw"})
    return client


@pytest.fixture
async def operator_client(operator, client):
    await client.post("/api/auth/login", json={"email": "operator@res.test", "password": "op-pw"})
    return client


@pytest.fixture
async def viewer_client(viewer, client):
    await client.post("/api/auth/login", json={"email": "viewer@res.test", "password": "viewer-pw"})
    return client


@pytest.fixture
async def instance(db, admin):
    inst = FlociInstance(
        name="res-instance", endpoint="http://localhost:4566",
        region="us-east-1", access_key="test",
        secret_key_encrypted=encrypt_secret("secret"),
        account_id="000000000000", created_by=admin.id,
    )
    db.add(inst); await db.commit(); await db.refresh(inst); return inst


def _client_error(code: str, message: str = "error") -> ClientError:
    return ClientError({"Error": {"Code": code, "Message": message}}, "operation")


# ── S3 ────────────────────────────────────────────────────────────────────────


class TestS3:
    async def test_list_buckets(self, admin_client, instance):
        mock = MagicMock()
        mock.list_buckets.return_value = {
            "Buckets": [{"Name": "my-bucket", "CreationDate": "2024-01-01T00:00:00Z"}]
        }
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await admin_client.get(f"/api/instances/{instance.id}/resources/s3/buckets")
        assert resp.status_code == 200
        assert resp.json()[0]["name"] == "my-bucket"

    async def test_list_buckets_viewer_allowed(self, viewer_client, instance):
        mock = MagicMock()
        mock.list_buckets.return_value = {"Buckets": []}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(f"/api/instances/{instance.id}/resources/s3/buckets")
        assert resp.status_code == 200

    async def test_list_buckets_unauthenticated(self, client, instance):
        resp = await client.get(f"/api/instances/{instance.id}/resources/s3/buckets")
        assert resp.status_code == 401

    async def test_create_bucket(self, operator_client, instance):
        mock = MagicMock()
        mock.create_bucket.return_value = {}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.post(
                f"/api/instances/{instance.id}/resources/s3/buckets",
                json={"bucket_name": "new-bucket"},
            )
        assert resp.status_code == 201
        assert resp.json()["name"] == "new-bucket"

    async def test_create_bucket_viewer_forbidden(self, viewer_client, instance):
        resp = await viewer_client.post(
            f"/api/instances/{instance.id}/resources/s3/buckets",
            json={"bucket_name": "x"},
        )
        assert resp.status_code == 403

    async def test_delete_bucket(self, operator_client, instance):
        mock = MagicMock()
        mock.delete_bucket.return_value = {}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.delete(
                f"/api/instances/{instance.id}/resources/s3/buckets/my-bucket"
            )
        assert resp.status_code == 204

    async def test_list_objects(self, viewer_client, instance):
        mock = MagicMock()
        mock.list_objects_v2.return_value = {
            "Contents": [{"Key": "file.txt", "Size": 100, "LastModified": "2024-01-01T00:00:00Z"}],
            "NextContinuationToken": None,
            "IsTruncated": False,
        }
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(
                f"/api/instances/{instance.id}/resources/s3/buckets/my-bucket/objects"
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["objects"][0]["key"] == "file.txt"

    async def test_delete_object(self, operator_client, instance):
        mock = MagicMock()
        mock.delete_object.return_value = {}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.delete(
                f"/api/instances/{instance.id}/resources/s3/buckets/my-bucket/objects/file.txt"
            )
        assert resp.status_code == 204

    async def test_instance_not_found(self, admin_client):
        resp = await admin_client.get("/api/instances/00000000-0000-0000-0000-000000000000/resources/s3/buckets")
        assert resp.status_code == 404


# ── DynamoDB ──────────────────────────────────────────────────────────────────


class TestDynamoDB:
    async def test_list_tables(self, viewer_client, instance):
        mock = MagicMock()
        mock.list_tables.return_value = {"TableNames": ["users", "orders"]}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(f"/api/instances/{instance.id}/resources/dynamodb/tables")
        assert resp.status_code == 200
        assert resp.json()["tables"] == ["users", "orders"]

    async def test_create_table(self, operator_client, instance):
        mock = MagicMock()
        mock.create_table.return_value = {"TableDescription": {"TableName": "new-table", "TableStatus": "CREATING"}}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.post(
                f"/api/instances/{instance.id}/resources/dynamodb/tables",
                json={"table_name": "new-table", "hash_key": "id", "hash_type": "S", "billing_mode": "PAY_PER_REQUEST"},
            )
        assert resp.status_code == 201
        assert resp.json()["table_name"] == "new-table"

    async def test_create_table_viewer_forbidden(self, viewer_client, instance):
        resp = await viewer_client.post(
            f"/api/instances/{instance.id}/resources/dynamodb/tables",
            json={"table_name": "x", "hash_key": "id", "hash_type": "S", "billing_mode": "PAY_PER_REQUEST"},
        )
        assert resp.status_code == 403

    async def test_delete_table(self, operator_client, instance):
        mock = MagicMock()
        mock.delete_table.return_value = {}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.delete(
                f"/api/instances/{instance.id}/resources/dynamodb/tables/users"
            )
        assert resp.status_code == 204

    async def test_scan_table(self, viewer_client, instance):
        mock = MagicMock()
        mock.scan.return_value = {"Items": [{"id": {"S": "1"}}], "Count": 1, "LastEvaluatedKey": None}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.post(
                f"/api/instances/{instance.id}/resources/dynamodb/tables/users/scan",
                json={},
            )
        assert resp.status_code == 200
        assert resp.json()["count"] == 1

    async def test_put_item(self, operator_client, instance):
        mock = MagicMock()
        mock.put_item.return_value = {}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.put(
                f"/api/instances/{instance.id}/resources/dynamodb/tables/users/items",
                json={"item": {"id": {"S": "1"}, "name": {"S": "Alice"}}},
            )
        assert resp.status_code == 200

    async def test_delete_item(self, operator_client, instance):
        mock = MagicMock()
        mock.delete_item.return_value = {}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.request(
                "DELETE",
                f"/api/instances/{instance.id}/resources/dynamodb/tables/users/items",
                json={"key": {"id": {"S": "1"}}},
            )
        assert resp.status_code == 204


# ── Lambda ────────────────────────────────────────────────────────────────────


class TestLambda:
    async def test_list_functions(self, viewer_client, instance):
        mock = MagicMock()
        mock.list_functions.return_value = {
            "Functions": [{"FunctionName": "my-fn", "Runtime": "python3.12", "MemorySize": 128, "Timeout": 3}]
        }
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(f"/api/instances/{instance.id}/resources/lambda/functions")
        assert resp.status_code == 200
        assert resp.json()[0]["name"] == "my-fn"

    async def test_delete_function(self, operator_client, instance):
        mock = MagicMock()
        mock.delete_function.return_value = {}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.delete(
                f"/api/instances/{instance.id}/resources/lambda/functions/my-fn"
            )
        assert resp.status_code == 204

    async def test_invoke_function(self, operator_client, instance):
        import json as _json
        mock = MagicMock()
        mock.invoke.return_value = {
            "StatusCode": 200,
            "Payload": MagicMock(read=lambda: _json.dumps({"result": "ok"}).encode()),
            "LogResult": "",
        }
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.post(
                f"/api/instances/{instance.id}/resources/lambda/functions/my-fn/invoke",
                json={"payload": {"key": "value"}},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status_code"] == 200

    async def test_invoke_viewer_forbidden(self, viewer_client, instance):
        resp = await viewer_client.post(
            f"/api/instances/{instance.id}/resources/lambda/functions/my-fn/invoke",
            json={"payload": {}},
        )
        assert resp.status_code == 403


# ── SQS ──────────────────────────────────────────────────────────────────────


class TestSQS:
    async def test_list_queues(self, viewer_client, instance):
        mock = MagicMock()
        mock.list_queues.return_value = {"QueueUrls": ["http://localhost:4566/000/my-queue"]}
        mock.get_queue_attributes.return_value = {
            "Attributes": {"ApproximateNumberOfMessages": "5", "QueueArn": "arn:aws:sqs:us-east-1:000:my-queue"}
        }
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(f"/api/instances/{instance.id}/resources/sqs/queues")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    async def test_create_queue(self, operator_client, instance):
        mock = MagicMock()
        mock.create_queue.return_value = {"QueueUrl": "http://localhost:4566/000/new-queue"}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.post(
                f"/api/instances/{instance.id}/resources/sqs/queues",
                json={"queue_name": "new-queue"},
            )
        assert resp.status_code == 201

    async def test_send_message(self, operator_client, instance):
        mock = MagicMock()
        mock.get_queue_url.return_value = {"QueueUrl": "http://localhost:4566/000/my-queue"}
        mock.send_message.return_value = {"MessageId": "msg-123"}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.post(
                f"/api/instances/{instance.id}/resources/sqs/queues/my-queue/send",
                json={"message_body": "hello"},
            )
        assert resp.status_code == 200
        assert resp.json()["message_id"] == "msg-123"

    async def test_send_message_viewer_forbidden(self, viewer_client, instance):
        resp = await viewer_client.post(
            f"/api/instances/{instance.id}/resources/sqs/queues/my-queue/send",
            json={"message_body": "hello"},
        )
        assert resp.status_code == 403

    async def test_purge_queue(self, operator_client, instance):
        mock = MagicMock()
        mock.get_queue_url.return_value = {"QueueUrl": "http://localhost:4566/000/my-queue"}
        mock.purge_queue.return_value = {}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.delete(
                f"/api/instances/{instance.id}/resources/sqs/queues/my-queue/purge"
            )
        assert resp.status_code == 204

    async def test_receive_messages(self, viewer_client, instance):
        mock = MagicMock()
        mock.get_queue_url.return_value = {"QueueUrl": "http://localhost:4566/000/my-queue"}
        mock.receive_message.return_value = {
            "Messages": [{"MessageId": "m1", "Body": "hello", "ReceiptHandle": "rh1"}]
        }
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(
                f"/api/instances/{instance.id}/resources/sqs/queues/my-queue/receive"
            )
        assert resp.status_code == 200
        assert len(resp.json()) == 1


# ── SNS ──────────────────────────────────────────────────────────────────────


class TestSNS:
    async def test_list_topics(self, viewer_client, instance):
        mock = MagicMock()
        mock.list_topics.return_value = {"Topics": [{"TopicArn": "arn:aws:sns:us-east-1:000:my-topic"}]}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(f"/api/instances/{instance.id}/resources/sns/topics")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    async def test_create_topic(self, operator_client, instance):
        mock = MagicMock()
        mock.create_topic.return_value = {"TopicArn": "arn:aws:sns:us-east-1:000:new-topic"}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.post(
                f"/api/instances/{instance.id}/resources/sns/topics",
                json={"topic_name": "new-topic"},
            )
        assert resp.status_code == 201

    async def test_publish(self, operator_client, instance):
        mock = MagicMock()
        mock.publish.return_value = {"MessageId": "pub-123"}
        arn = "arn:aws:sns:us-east-1:000:my-topic"
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.post(
                f"/api/instances/{instance.id}/resources/sns/topics/{arn}/publish",
                json={"message": "hello world"},
            )
        assert resp.status_code == 200
        assert resp.json()["message_id"] == "pub-123"

    async def test_publish_viewer_forbidden(self, viewer_client, instance):
        resp = await viewer_client.post(
            f"/api/instances/{instance.id}/resources/sns/topics/arn:aws:sns:us-east-1:000:t/publish",
            json={"message": "x"},
        )
        assert resp.status_code == 403


# ── Kinesis ───────────────────────────────────────────────────────────────────


class TestKinesis:
    async def test_list_streams(self, viewer_client, instance):
        mock = MagicMock()
        mock.list_streams.return_value = {"StreamNames": ["my-stream"]}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(f"/api/instances/{instance.id}/resources/kinesis/streams")
        assert resp.status_code == 200
        assert resp.json() == ["my-stream"]

    async def test_create_stream(self, operator_client, instance):
        mock = MagicMock()
        mock.create_stream.return_value = {}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.post(
                f"/api/instances/{instance.id}/resources/kinesis/streams",
                json={"stream_name": "new-stream", "shard_count": 1},
            )
        assert resp.status_code == 201

    async def test_delete_stream(self, operator_client, instance):
        mock = MagicMock()
        mock.delete_stream.return_value = {}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.delete(
                f"/api/instances/{instance.id}/resources/kinesis/streams/my-stream"
            )
        assert resp.status_code == 204

    async def test_put_record(self, operator_client, instance):
        mock = MagicMock()
        mock.put_record.return_value = {"ShardId": "shardId-000", "SequenceNumber": "1"}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.post(
                f"/api/instances/{instance.id}/resources/kinesis/streams/my-stream/records",
                json={"data_b64": "aGVsbG8=", "partition_key": "pk1"},
            )
        assert resp.status_code == 200


# ── EventBridge ───────────────────────────────────────────────────────────────


class TestEventBridge:
    async def test_list_buses(self, viewer_client, instance):
        mock = MagicMock()
        mock.list_event_buses.return_value = {
            "EventBuses": [{"Name": "default", "Arn": "arn:aws:events:us-east-1:000:event-bus/default"}]
        }
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(f"/api/instances/{instance.id}/resources/eventbridge/buses")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    async def test_create_bus(self, operator_client, instance):
        mock = MagicMock()
        mock.create_event_bus.return_value = {"EventBusArn": "arn:aws:events:us-east-1:000:event-bus/custom"}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.post(
                f"/api/instances/{instance.id}/resources/eventbridge/buses",
                json={"bus_name": "custom"},
            )
        assert resp.status_code == 201

    async def test_put_events(self, operator_client, instance):
        mock = MagicMock()
        mock.put_events.return_value = {"FailedEntryCount": 0, "Entries": [{"EventId": "e1"}]}
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.post(
                f"/api/instances/{instance.id}/resources/eventbridge/buses/default/events",
                json={"source": "my.app", "detail_type": "UserSignup", "detail": {"user": "alice"}},
            )
        assert resp.status_code == 200

    async def test_put_events_viewer_forbidden(self, viewer_client, instance):
        resp = await viewer_client.post(
            f"/api/instances/{instance.id}/resources/eventbridge/buses/default/events",
            json={"source": "x", "detail_type": "y", "detail": {}},
        )
        assert resp.status_code == 403


# ── Cognito ───────────────────────────────────────────────────────────────────


class TestCognito:
    async def test_list_user_pools(self, viewer_client, instance):
        mock = MagicMock()
        mock.list_user_pools.return_value = {
            "UserPools": [{"Id": "us-east-1_abc123", "Name": "my-pool"}]
        }
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(f"/api/instances/{instance.id}/resources/cognito/user-pools")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    async def test_list_users(self, viewer_client, instance):
        mock = MagicMock()
        mock.list_users.return_value = {
            "Users": [{"Username": "alice", "UserStatus": "CONFIRMED", "Attributes": []}],
            "PaginationToken": None,
        }
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await viewer_client.get(
                f"/api/instances/{instance.id}/resources/cognito/user-pools/us-east-1_abc123/users"
            )
        assert resp.status_code == 200
        assert resp.json()[0]["username"] == "alice"

    async def test_create_user(self, operator_client, instance):
        mock = MagicMock()
        mock.admin_create_user.return_value = {
            "User": {"Username": "bob", "UserStatus": "FORCE_CHANGE_PASSWORD", "Attributes": []}
        }
        with patch(PATCH_CLIENT, return_value=mock):
            resp = await operator_client.post(
                f"/api/instances/{instance.id}/resources/cognito/user-pools/us-east-1_abc123/users",
                json={"username": "bob", "email": "bob@test.com", "temp_password": "Temp@123"},
            )
        assert resp.status_code == 201

    async def test_create_user_viewer_forbidden(self, viewer_client, instance):
        resp = await viewer_client.post(
            f"/api/instances/{instance.id}/resources/cognito/user-pools/pool123/users",
            json={"username": "bob", "email": "bob@test.com", "temp_password": "Temp@123"},
        )
        assert resp.status_code == 403
