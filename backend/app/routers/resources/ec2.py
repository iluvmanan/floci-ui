import base64
from typing import Optional, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/ec2", tags=["ec2"])


# ─── Request Models ───────────────────────────────────────────────────────────

class LaunchInstanceRequest(BaseModel):
    image_id: str
    instance_type: str
    key_name: Optional[str] = None
    security_group_ids: Optional[List[str]] = None
    subnet_id: Optional[str] = None
    min_count: int = 1
    max_count: int = 1
    user_data: Optional[str] = None
    iam_instance_profile_arn: Optional[str] = None
    tags: Optional[List[dict]] = None
    volume_size: Optional[int] = None


class CreateKeyPairRequest(BaseModel):
    name: str


class ImportKeyPairRequest(BaseModel):
    name: str
    public_key: str


class CreateSecurityGroupRequest(BaseModel):
    name: str
    description: str
    vpc_id: Optional[str] = None


class SecurityGroupRuleRequest(BaseModel):
    protocol: str
    from_port: int
    to_port: int
    cidr: str


class CreateVolumeRequest(BaseModel):
    size: int
    availability_zone: str
    volume_type: str
    snapshot_id: Optional[str] = None


class AttachVolumeRequest(BaseModel):
    instance_id: str
    device: str


class AssociateElasticIPRequest(BaseModel):
    instance_id: str


# ─── Instances ────────────────────────────────────────────────────────────────

@router.get("/instances", dependencies=[RequireViewer])
async def list_ec2_instances(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    resp = client.describe_instances(MaxResults=100)
    instances = []
    for reservation in resp.get("Reservations", []):
        for i in reservation.get("Instances", []):
            name = next(
                (t["Value"] for t in i.get("Tags", []) if t["Key"] == "Name"), ""
            )
            instances.append({
                "instance_id": i["InstanceId"],
                "name": name,
                "state": i["State"]["Name"],
                "instance_type": i.get("InstanceType", ""),
                "public_ip": i.get("PublicIpAddress", ""),
                "private_ip": i.get("PrivateIpAddress", ""),
                "key_name": i.get("KeyName", ""),
                "availability_zone": i.get("Placement", {}).get("AvailabilityZone", ""),
                "launch_time": str(i.get("LaunchTime", "")),
                "vpc_id": i.get("VpcId", ""),
                "subnet_id": i.get("SubnetId", ""),
                "security_groups": [
                    {"group_id": sg["GroupId"], "group_name": sg["GroupName"]}
                    for sg in i.get("SecurityGroups", [])
                ],
                "image_id": i.get("ImageId", ""),
                "iam_instance_profile": i.get("IamInstanceProfile", {}).get("Arn", "") if i.get("IamInstanceProfile") else "",
            })
    return instances


@router.post("/instances", status_code=201, dependencies=[RequireOperator])
async def launch_ec2_instance(
    instance_id, body: LaunchInstanceRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    kwargs: dict = {
        "ImageId": body.image_id,
        "InstanceType": body.instance_type,
        "MinCount": body.min_count,
        "MaxCount": body.max_count,
    }
    if body.key_name:
        kwargs["KeyName"] = body.key_name
    if body.security_group_ids:
        kwargs["SecurityGroupIds"] = body.security_group_ids
    if body.subnet_id:
        kwargs["SubnetId"] = body.subnet_id
    if body.user_data:
        kwargs["UserData"] = base64.b64encode(body.user_data.encode()).decode()
    if body.iam_instance_profile_arn:
        kwargs["IamInstanceProfile"] = {"Arn": body.iam_instance_profile_arn}
    if body.tags:
        kwargs["TagSpecifications"] = [{"ResourceType": "instance", "Tags": body.tags}]
    if body.volume_size:
        kwargs["BlockDeviceMappings"] = [
            {
                "DeviceName": "/dev/xvda",
                "Ebs": {"VolumeSize": body.volume_size, "DeleteOnTermination": True},
            }
        ]
    resp = client.run_instances(**kwargs)
    instances = resp.get("Instances", [])
    return {
        "instance_id": instances[0]["InstanceId"],
        "state": instances[0]["State"]["Name"],
    }


@router.post("/instances/{instance_id_param}/start", dependencies=[RequireOperator])
async def start_instance(
    instance_id, instance_id_param: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    client.start_instances(InstanceIds=[instance_id_param])
    return {"success": True}


@router.post("/instances/{instance_id_param}/stop", dependencies=[RequireOperator])
async def stop_instance(
    instance_id, instance_id_param: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    client.stop_instances(InstanceIds=[instance_id_param])
    return {"success": True}


@router.post("/instances/{instance_id_param}/reboot", dependencies=[RequireOperator])
async def reboot_instance(
    instance_id, instance_id_param: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    client.reboot_instances(InstanceIds=[instance_id_param])
    return {"success": True}


@router.post("/instances/{instance_id_param}/terminate", dependencies=[RequireOperator])
async def terminate_instance(
    instance_id, instance_id_param: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    client.terminate_instances(InstanceIds=[instance_id_param])
    return {"success": True}


@router.get("/instances/{instance_id_param}/console", dependencies=[RequireViewer])
async def get_console_output(
    instance_id, instance_id_param: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    resp = client.get_console_output(InstanceId=instance_id_param, Latest=True)
    output = resp.get("Output", "")
    if output:
        output = base64.b64decode(output).decode("utf-8", errors="replace")
    return {"output": output}


@router.get("/instances/{instance_id_param}/connect", dependencies=[RequireViewer])
async def get_connect_info(
    instance_id, instance_id_param: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    resp = client.describe_instances(InstanceIds=[instance_id_param])
    inst_data = resp["Reservations"][0]["Instances"][0]
    public_ip = inst_data.get("PublicIpAddress", "")
    key_name = inst_data.get("KeyName", "")
    ssh_command = (
        f"ssh -i {key_name}.pem ec2-user@{public_ip}"
        if public_ip and key_name
        else ""
    )
    return {"public_ip": public_ip, "key_name": key_name, "ssh_command": ssh_command}


# ─── Key Pairs ────────────────────────────────────────────────────────────────

@router.get("/key-pairs", dependencies=[RequireViewer])
async def list_key_pairs(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    resp = client.describe_key_pairs()
    return [
        {
            "key_pair_id": kp["KeyPairId"],
            "name": kp["KeyName"],
            "fingerprint": kp.get("KeyFingerprint", ""),
            "created_at": str(kp.get("CreateTime", "")),
        }
        for kp in resp["KeyPairs"]
    ]


@router.post("/key-pairs", status_code=201, dependencies=[RequireOperator])
async def create_key_pair(
    instance_id, body: CreateKeyPairRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    resp = client.create_key_pair(KeyName=body.name)
    return {"name": resp["KeyName"], "key_material": resp["KeyMaterial"]}


@router.delete("/key-pairs/{name}", status_code=204, dependencies=[RequireOperator])
async def delete_key_pair(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    client.delete_key_pair(KeyName=name)


@router.post("/key-pairs/import", status_code=201, dependencies=[RequireOperator])
async def import_key_pair(
    instance_id, body: ImportKeyPairRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    resp = client.import_key_pair(
        KeyName=body.name, PublicKeyMaterial=body.public_key.encode()
    )
    return {"name": resp["KeyName"], "key_pair_id": resp["KeyPairId"]}


# ─── Security Groups ──────────────────────────────────────────────────────────

@router.get("/security-groups", dependencies=[RequireViewer])
async def list_security_groups(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    resp = client.describe_security_groups(MaxResults=100)
    return [
        {
            "group_id": sg["GroupId"],
            "name": sg["GroupName"],
            "description": sg.get("Description", ""),
            "vpc_id": sg.get("VpcId", ""),
            "inbound_rules_count": len(sg.get("IpPermissions", [])),
            "outbound_rules_count": len(sg.get("IpPermissionsEgress", [])),
        }
        for sg in resp["SecurityGroups"]
    ]


@router.post("/security-groups", status_code=201, dependencies=[RequireOperator])
async def create_security_group(
    instance_id, body: CreateSecurityGroupRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    kwargs: dict = {"GroupName": body.name, "Description": body.description}
    if body.vpc_id:
        kwargs["VpcId"] = body.vpc_id
    resp = client.create_security_group(**kwargs)
    return {"group_id": resp["GroupId"]}


@router.delete("/security-groups/{group_id}", status_code=204, dependencies=[RequireOperator])
async def delete_security_group(
    instance_id, group_id: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    client.delete_security_group(GroupId=group_id)


@router.get("/security-groups/{group_id}/rules", dependencies=[RequireViewer])
async def get_security_group_rules(
    instance_id, group_id: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    resp = client.describe_security_groups(GroupIds=[group_id])
    sg = resp["SecurityGroups"][0]

    def format_rules(perms):
        rules = []
        for p in perms:
            for r in p.get("IpRanges", []):
                rules.append({
                    "protocol": p.get("IpProtocol", "-1"),
                    "from_port": p.get("FromPort", 0),
                    "to_port": p.get("ToPort", 65535),
                    "cidr": r["CidrIp"],
                    "description": r.get("Description", ""),
                })
            for r in p.get("UserIdGroupPairs", []):
                rules.append({
                    "protocol": p.get("IpProtocol", "-1"),
                    "from_port": p.get("FromPort", 0),
                    "to_port": p.get("ToPort", 65535),
                    "source_group": r["GroupId"],
                    "description": r.get("Description", ""),
                })
        return rules

    return {
        "inbound": format_rules(sg.get("IpPermissions", [])),
        "outbound": format_rules(sg.get("IpPermissionsEgress", [])),
    }


@router.post("/security-groups/{group_id}/ingress", dependencies=[RequireOperator])
async def add_ingress_rule(
    instance_id,
    group_id: str,
    body: SecurityGroupRuleRequest,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    client.authorize_security_group_ingress(
        GroupId=group_id,
        IpPermissions=[
            {
                "IpProtocol": body.protocol,
                "FromPort": body.from_port,
                "ToPort": body.to_port,
                "IpRanges": [{"CidrIp": body.cidr}],
            }
        ],
    )
    return {"success": True}


@router.delete("/security-groups/{group_id}/ingress", dependencies=[RequireOperator])
async def revoke_ingress_rule(
    instance_id,
    group_id: str,
    body: SecurityGroupRuleRequest,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    client.revoke_security_group_ingress(
        GroupId=group_id,
        IpPermissions=[
            {
                "IpProtocol": body.protocol,
                "FromPort": body.from_port,
                "ToPort": body.to_port,
                "IpRanges": [{"CidrIp": body.cidr}],
            }
        ],
    )
    return {"success": True}


# ─── AMIs ─────────────────────────────────────────────────────────────────────

@router.get("/amis", dependencies=[RequireViewer])
async def list_amis(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    resp = client.describe_images(
        Owners=["self", "amazon"],
        Filters=[{"Name": "state", "Values": ["available"]}],
        MaxResults=50,
    )
    return [
        {
            "image_id": img["ImageId"],
            "name": img.get("Name", ""),
            "description": img.get("Description", ""),
            "architecture": img.get("Architecture", ""),
            "owner": img.get("OwnerId", ""),
            "creation_date": img.get("CreationDate", ""),
        }
        for img in resp["Images"]
    ]


# ─── Volumes ──────────────────────────────────────────────────────────────────

@router.get("/volumes", dependencies=[RequireViewer])
async def list_volumes(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    resp = client.describe_volumes(MaxResults=100)
    return [
        {
            "volume_id": v["VolumeId"],
            "size": v["Size"],
            "state": v["State"],
            "volume_type": v["VolumeType"],
            "availability_zone": v["AvailabilityZone"],
            "encrypted": v["Encrypted"],
            "attached_to": v["Attachments"][0]["InstanceId"] if v.get("Attachments") else None,
            "device": v["Attachments"][0]["Device"] if v.get("Attachments") else None,
            "create_time": str(v["CreateTime"]),
        }
        for v in resp["Volumes"]
    ]


@router.post("/volumes", status_code=201, dependencies=[RequireOperator])
async def create_volume(
    instance_id, body: CreateVolumeRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    kwargs: dict = {
        "Size": body.size,
        "AvailabilityZone": body.availability_zone,
        "VolumeType": body.volume_type,
    }
    if body.snapshot_id:
        kwargs["SnapshotId"] = body.snapshot_id
    resp = client.create_volume(**kwargs)
    return {"volume_id": resp["VolumeId"], "state": resp["State"]}


@router.post("/volumes/{volume_id}/attach", dependencies=[RequireOperator])
async def attach_volume(
    instance_id, volume_id: str, body: AttachVolumeRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    client.attach_volume(
        VolumeId=volume_id, InstanceId=body.instance_id, Device=body.device
    )
    return {"success": True}


@router.post("/volumes/{volume_id}/detach", dependencies=[RequireOperator])
async def detach_volume(instance_id, volume_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    client.detach_volume(VolumeId=volume_id)
    return {"success": True}


@router.delete("/volumes/{volume_id}", status_code=204, dependencies=[RequireOperator])
async def delete_volume(instance_id, volume_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    client.delete_volume(VolumeId=volume_id)


# ─── Elastic IPs ──────────────────────────────────────────────────────────────

@router.get("/elastic-ips", dependencies=[RequireViewer])
async def list_elastic_ips(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    resp = client.describe_addresses()
    return [
        {
            "allocation_id": a.get("AllocationId", ""),
            "public_ip": a.get("PublicIp", ""),
            "association_id": a.get("AssociationId"),
            "instance_id": a.get("InstanceId"),
            "domain": a.get("Domain", "vpc"),
        }
        for a in resp["Addresses"]
    ]


@router.post("/elastic-ips", status_code=201, dependencies=[RequireOperator])
async def allocate_elastic_ip(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    resp = client.allocate_address(Domain="vpc")
    return {"allocation_id": resp["AllocationId"], "public_ip": resp["PublicIp"]}


@router.post("/elastic-ips/{allocation_id}/associate", dependencies=[RequireOperator])
async def associate_elastic_ip(
    instance_id,
    allocation_id: str,
    body: AssociateElasticIPRequest,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    client.associate_address(AllocationId=allocation_id, InstanceId=body.instance_id)
    return {"success": True}


@router.post("/elastic-ips/{allocation_id}/disassociate", dependencies=[RequireOperator])
async def disassociate_elastic_ip(
    instance_id, allocation_id: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    resp = client.describe_addresses(AllocationIds=[allocation_id])
    assoc_id = resp["Addresses"][0].get("AssociationId")
    if assoc_id:
        client.disassociate_address(AssociationId=assoc_id)
    return {"success": True}


@router.delete("/elastic-ips/{allocation_id}", status_code=204, dependencies=[RequireOperator])
async def release_elastic_ip(
    instance_id, allocation_id: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    client.release_address(AllocationId=allocation_id)


# ─── VPCs & Subnets ───────────────────────────────────────────────────────────

@router.get("/vpcs", dependencies=[RequireViewer])
async def list_vpcs(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    resp = client.describe_vpcs()
    return [
        {
            "vpc_id": v["VpcId"],
            "cidr": v["CidrBlock"],
            "is_default": v["IsDefault"],
            "state": v["State"],
            "name": next(
                (t["Value"] for t in v.get("Tags", []) if t["Key"] == "Name"), ""
            ),
        }
        for v in resp["Vpcs"]
    ]


@router.get("/subnets", dependencies=[RequireViewer])
async def list_subnets(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ec2")
    resp = client.describe_subnets()
    return [
        {
            "subnet_id": s["SubnetId"],
            "vpc_id": s["VpcId"],
            "cidr": s["CidrBlock"],
            "availability_zone": s["AvailabilityZone"],
            "available_ips": s["AvailableIpAddressCount"],
            "name": next(
                (t["Value"] for t in s.get("Tags", []) if t["Key"] == "Name"), ""
            ),
        }
        for s in resp["Subnets"]
    ]
