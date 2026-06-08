import boto3
from botocore.exceptions import ClientError, NoCredentialsError, BotoCoreError
from datetime import datetime, timedelta, timezone


def get_regions():
    """Return list of all available AWS regions."""
    try:
        ec2 = boto3.client("ec2")
        response = ec2.describe_regions(AllRegions=False)
        return [r["RegionName"] for r in response["Regions"]]
    except (NoCredentialsError, ClientError) as e:
        raise RuntimeError(f"AWS credentials error: {e}")


def scan_resources(region: str):
    """Scan all resources in the given AWS region. Returns a list of resource dicts."""
    if region == "all":
        regions = get_regions()
    else:
        regions = [region]

    all_resources = []
    for r in regions:
        all_resources.extend(_scan_ec2_instances(r))
        all_resources.extend(_scan_ebs_volumes(r))
        all_resources.extend(_scan_elastic_ips(r))
        all_resources.extend(_scan_rds_instances(r))
        all_resources.extend(_scan_s3_buckets(r))
        all_resources.extend(_scan_lambda_functions(r))
        all_resources.extend(_scan_load_balancers(r))

    return all_resources


def _scan_ec2_instances(region: str):
    resources = []
    try:
        ec2 = boto3.client("ec2", region_name=region)
        cw = boto3.client("cloudwatch", region_name=region)
        paginator = ec2.get_paginator("describe_instances")
        for page in paginator.paginate():
            for reservation in page["Reservations"]:
                for instance in reservation["Instances"]:
                    instance_id = instance["InstanceId"]
                    cpu_avg = _get_cpu_utilization(cw, instance_id)
                    mem_avg = _get_memory_utilization(cw, instance_id)
                    resources.append({
                        "type": "EC2 Instance",
                        "name": _get_name_tag(instance.get("Tags", [])),
                        "id": instance_id,
                        "region": region,
                        "instance_type": instance.get("InstanceType"),
                        "state": instance["State"]["Name"],
                        "cpu_utilization_avg_percent": cpu_avg,
                        "memory_utilization_avg_percent": mem_avg,
                        "tags": instance.get("Tags", []),
                    })
    except ClientError:
        pass
    return resources


def _get_cpu_utilization(cw, instance_id: str) -> float | None:
    """Get average CPU utilization over the last 7 days from CloudWatch."""
    try:
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=7)
        response = cw.get_metric_statistics(
            Namespace="AWS/EC2",
            MetricName="CPUUtilization",
            Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
            StartTime=start,
            EndTime=end,
            Period=86400,  # 1-day intervals
            Statistics=["Average"],
        )
        datapoints = response.get("Datapoints", [])
        if datapoints:
            return round(sum(d["Average"] for d in datapoints) / len(datapoints), 2)
    except ClientError:
        pass
    return None


def _get_memory_utilization(cw, instance_id: str) -> float | None:
    """Get average memory utilization over the last 7 days.
    Requires CloudWatch Agent installed on the instance.
    Returns None if metric is not available."""
    try:
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=7)
        response = cw.get_metric_statistics(
            Namespace="CWAgent",
            MetricName="mem_used_percent",
            Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
            StartTime=start,
            EndTime=end,
            Period=86400,
            Statistics=["Average"],
        )
        datapoints = response.get("Datapoints", [])
        if datapoints:
            return round(sum(d["Average"] for d in datapoints) / len(datapoints), 2)
    except ClientError:
        pass
    return None


def _scan_ebs_volumes(region: str):
    resources = []
    try:
        ec2 = boto3.client("ec2", region_name=region)
        paginator = ec2.get_paginator("describe_volumes")
        for page in paginator.paginate():
            for vol in page["Volumes"]:
                resources.append({
                    "type": "EBS Volume",
                    "name": _get_name_tag(vol.get("Tags", [])),
                    "id": vol["VolumeId"],
                    "region": region,
                    "size_gb": vol["Size"],
                    "volume_type": vol["VolumeType"],
                    "state": vol["State"],
                    "attachments": len(vol.get("Attachments", [])),
                    "tags": vol.get("Tags", []),
                })
    except ClientError:
        pass
    return resources


def _scan_elastic_ips(region: str):
    resources = []
    try:
        ec2 = boto3.client("ec2", region_name=region)
        response = ec2.describe_addresses()
        for eip in response["Addresses"]:
            resources.append({
                "type": "Elastic IP",
                "name": _get_name_tag(eip.get("Tags", [])),
                "id": eip.get("AllocationId", ""),
                "region": region,
                "public_ip": eip.get("PublicIp"),
                "associated": eip.get("AssociationId") is not None,
                "tags": eip.get("Tags", []),
            })
    except ClientError:
        pass
    return resources


def _scan_rds_instances(region: str):
    resources = []
    try:
        rds = boto3.client("rds", region_name=region)
        paginator = rds.get_paginator("describe_db_instances")
        for page in paginator.paginate():
            for db in page["DBInstances"]:
                resources.append({
                    "type": "RDS Instance",
                    "name": db["DBInstanceIdentifier"],
                    "id": db["DBInstanceIdentifier"],
                    "region": region,
                    "instance_type": db["DBInstanceClass"],
                    "engine": db["Engine"],
                    "state": db["DBInstanceStatus"],
                    "multi_az": db.get("MultiAZ", False),
                    "storage_gb": db.get("AllocatedStorage"),
                    "tags": [],
                })
    except ClientError:
        pass
    return resources


def _scan_s3_buckets(region: str):
    """S3 is global — only scan once when region is us-east-1 or 'all'."""
    resources = []
    if region != "us-east-1":
        return resources
    try:
        s3 = boto3.client("s3")
        response = s3.list_buckets()
        for bucket in response.get("Buckets", []):
            resources.append({
                "type": "S3 Bucket",
                "name": bucket["Name"],
                "id": bucket["Name"],
                "region": "global",
                "created": bucket["CreationDate"].isoformat(),
                "tags": [],
            })
    except ClientError:
        pass
    return resources


def _scan_lambda_functions(region: str):
    resources = []
    try:
        lam = boto3.client("lambda", region_name=region)
        paginator = lam.get_paginator("list_functions")
        for page in paginator.paginate():
            for fn in page["Functions"]:
                resources.append({
                    "type": "Lambda Function",
                    "name": fn["FunctionName"],
                    "id": fn["FunctionArn"],
                    "region": region,
                    "runtime": fn.get("Runtime", "N/A"),
                    "memory_mb": fn.get("MemorySize"),
                    "timeout": fn.get("Timeout"),
                    "tags": [],
                })
    except ClientError:
        pass
    return resources


def _scan_load_balancers(region: str):
    resources = []
    try:
        elbv2 = boto3.client("elbv2", region_name=region)
        paginator = elbv2.get_paginator("describe_load_balancers")
        for page in paginator.paginate():
            for lb in page["LoadBalancers"]:
                resources.append({
                    "type": "Load Balancer",
                    "name": lb["LoadBalancerName"],
                    "id": lb["LoadBalancerArn"],
                    "region": region,
                    "lb_type": lb["Type"],
                    "state": lb["State"]["Code"],
                    "tags": [],
                })
    except ClientError:
        pass
    return resources


def _get_name_tag(tags: list) -> str:
    for tag in tags:
        if tag.get("Key") == "Name":
            return tag.get("Value", "")
    return ""
