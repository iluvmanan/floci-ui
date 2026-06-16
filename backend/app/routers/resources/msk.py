from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/msk", tags=["msk"])


# ─── Request Models ───────────────────────────────────────────────────────────

class StorageInfoRequest(BaseModel):
    volume_size_gb: Optional[int] = 100


class BrokerNodeGroupInfoRequest(BaseModel):
    instance_type: str
    client_subnets: List[str]
    storage_info: Optional[StorageInfoRequest] = None
    security_groups: Optional[List[str]] = None


class ProvisionedConfigRequest(BaseModel):
    broker_node_group_info: BrokerNodeGroupInfoRequest
    kafka_version: str
    number_of_broker_nodes: int


class VpcConfigRequest(BaseModel):
    subnet_ids: List[str]
    security_group_ids: Optional[List[str]] = None


class ServerlessConfigRequest(BaseModel):
    vpc_configs: List[VpcConfigRequest]


class CreateClusterRequest(BaseModel):
    cluster_name: str
    cluster_type: Optional[str] = "PROVISIONED"
    provisioned: Optional[ProvisionedConfigRequest] = None
    serverless: Optional[ServerlessConfigRequest] = None


def _serialize_cluster(c: dict) -> dict:
    return {
        "cluster_arn": c.get("ClusterArn", ""),
        "cluster_name": c.get("ClusterName", ""),
        "cluster_type": c.get("ClusterType", ""),
        "state": c.get("State", ""),
        "current_version": c.get("CurrentVersion", ""),
        "created_at": str(c.get("CreationTime", "")),
        "cluster_info": c,
    }


# ─── Clusters ─────────────────────────────────────────────────────────────────

@router.get("/clusters", dependencies=[RequireViewer])
async def list_clusters(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "kafka")
    resp = client.list_clusters_v2(MaxResults=100)
    clusters = []
    for c in resp.get("ClusterInfoList", []):
        arn = c.get("ClusterArn")
        detail = client.describe_cluster_v2(ClusterArn=arn)
        clusters.append(_serialize_cluster(detail.get("ClusterInfo", c)))
    return clusters


@router.post("/clusters", status_code=201, dependencies=[RequireOperator])
async def create_cluster(
    instance_id, body: CreateClusterRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "kafka")
    kwargs: dict = {
        "ClusterName": body.cluster_name,
    }
    if body.cluster_type == "SERVERLESS" and body.serverless:
        kwargs["Serverless"] = {
            "VpcConfigs": [
                {
                    "SubnetIds": vc.subnet_ids,
                    **({"SecurityGroupIds": vc.security_group_ids} if vc.security_group_ids else {}),
                }
                for vc in body.serverless.vpc_configs
            ]
        }
        resp = client.create_cluster_v2(**kwargs)
    else:
        p = body.provisioned
        broker_info: dict = {
            "InstanceType": p.broker_node_group_info.instance_type,
            "ClientSubnets": p.broker_node_group_info.client_subnets,
        }
        if p.broker_node_group_info.security_groups:
            broker_info["SecurityGroups"] = p.broker_node_group_info.security_groups
        storage = p.broker_node_group_info.storage_info
        broker_info["StorageInfo"] = {
            "EbsStorageInfo": {"VolumeSize": storage.volume_size_gb if storage else 100}
        }
        kwargs["Provisioned"] = {
            "BrokerNodeGroupInfo": broker_info,
            "KafkaVersion": p.kafka_version,
            "NumberOfBrokerNodes": p.number_of_broker_nodes,
        }
        resp = client.create_cluster_v2(**kwargs)
    return {"cluster_arn": resp["ClusterArn"], "state": resp.get("ClusterState", "")}


@router.delete("/clusters/{arn:path}", dependencies=[RequireOperator])
async def delete_cluster(instance_id, arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "kafka")
    client.delete_cluster(ClusterArn=arn)
    return {"success": True}


@router.get("/clusters/{arn:path}", dependencies=[RequireViewer])
async def get_cluster(instance_id, arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "kafka")
    resp = client.describe_cluster_v2(ClusterArn=arn)
    return _serialize_cluster(resp.get("ClusterInfo", {}))


@router.get("/clusters/{arn:path}/bootstrap-brokers", dependencies=[RequireViewer])
async def get_bootstrap_brokers(instance_id, arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "kafka")
    resp = client.get_bootstrap_brokers(ClusterArn=arn)
    return {
        "bootstrap_broker_string": resp.get("BootstrapBrokerString", ""),
        "bootstrap_broker_string_tls": resp.get("BootstrapBrokerStringTls"),
        "bootstrap_broker_string_sasl_iam": resp.get("BootstrapBrokerStringSaslIam"),
    }
