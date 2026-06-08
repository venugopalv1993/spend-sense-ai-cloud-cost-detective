import os
import json
import httpx
from openai import AzureOpenAI, OpenAI


def get_client():
    """Create AI client — uses Azure OpenAI if configured, otherwise falls back to Groq/OpenAI."""
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    azure_key = os.getenv("AZURE_OPENAI_API_KEY", "")
    api_version = os.getenv("OPENAI_API_VERSION", "2024-06-01")
    http_client = httpx.Client(verify=False)

    if azure_endpoint and azure_key:
        return AzureOpenAI(
            azure_endpoint=azure_endpoint,
            api_key=azure_key,
            api_version=api_version,
            http_client=http_client,
        )

    # Fallback to Groq/OpenAI
    api_key = os.getenv("OPENAI_API_KEY", "")
    base_url = os.getenv("AI_BASE_URL", "https://api.groq.com/openai/v1")
    return OpenAI(api_key=api_key, base_url=base_url, http_client=http_client)


def analyze_costs(resources: list) -> dict:
    """Send AWS resources to AI for cost analysis. Returns structured analysis."""
    if not resources:
        return {
            "summary": "No resources found in the selected region.",
            "issues": [],
            "total_estimated_savings": "$0/month",
        }

    client = get_client()
    model = os.getenv("AZURE_OPENAI_MODEL", "") or os.getenv("AI_MODEL", "llama-3.3-70b-versatile")

    prompt = _build_prompt(resources)

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an AWS cost optimization expert. Analyze the provided AWS resources "
                    "and identify cost issues. Return your analysis as valid JSON with this exact structure:\n"
                    '{"summary": "brief overview", "issues": [{"resource_name": "name", '
                    '"resource_id": "id", "resource_type": "type", "issue": "description", '
                    '"severity": "high|medium|low", "estimated_savings": "$X/month", '
                    '"fix_command": "aws cli command"}], "total_estimated_savings": "$X/month"}\n'
                    "Only return valid JSON, no markdown or extra text."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=4096,
    )

    content = response.choices[0].message.content.strip()

    # Parse JSON from response (handle markdown code blocks if present)
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {
            "summary": "AI analysis completed but response parsing failed.",
            "raw_response": content,
            "issues": [],
            "total_estimated_savings": "Unknown",
        }


def _build_prompt(resources: list) -> str:
    """Build the analysis prompt from resource data."""
    resource_summary = json.dumps(resources, indent=2, default=str)

    return (
        f"Analyze the following {len(resources)} AWS resources for cost optimization opportunities.\n"
        f"Look for:\n"
        f"- Over-provisioned resources — EC2 instances with low CPU/memory utilization "
        f"(cpu_utilization_avg_percent and memory_utilization_avg_percent fields show 7-day averages; "
        f"if CPU < 20% or memory < 30%, suggest downsizing to a smaller instance type)\n"
        f"- Unused/idle resources (stopped instances, unattached volumes, unused EIPs)\n"
        f"- Misconfigurations (GP2 volumes that should be GP3, missing auto-scaling)\n"
        f"- Missing Savings Plans or Reserved Instances\n"
        f"- Storage optimization (S3 lifecycle policies, EBS right-sizing)\n\n"
        f"Resources:\n{resource_summary}\n\n"
        f"Provide specific AWS CLI fix commands for each issue."
    )
