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
            "scale_down": [],
            "scale_up": [],
            "total_estimated_savings": "$0/month",
            "efficiency_score": 100,
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
                    "You are CloudPulse AI, an AWS cost optimization and performance expert. "
                    "Analyze the provided AWS resources and provide actionable insights.\n\n"
                    "Return your analysis as valid JSON with this exact structure:\n"
                    "{\n"
                    '  "summary": "brief overview of findings",\n'
                    '  "efficiency_score": <number 0-100>,\n'
                    '  "total_estimated_savings": "$X/month",\n'
                    '  "issues": [{"resource_name": "name", "resource_id": "id", "resource_type": "type", '
                    '"issue": "description", "severity": "high|medium|low", '
                    '"estimated_savings": "$X/month", "fix_command": "aws cli command"}],\n'
                    '  "scale_down": [{"resource_name": "name", "resource_id": "id", '
                    '"current_type": "e.g. t3.large", "recommended_type": "e.g. t3.medium", '
                    '"reason": "CPU avg 12% for 30 days", "monthly_savings": "$X"}],\n'
                    '  "scale_up": [{"resource_name": "name", "resource_id": "id", '
                    '"current_type": "e.g. t3.small", "recommended_type": "e.g. t3.medium", '
                    '"reason": "CPU avg 92%, risk of degradation", "performance_impact": "description"}],\n'
                    '  "predictions": {"next_month_estimate": "$X", "budget_risk": "low|medium|high", '
                    '"growth_trend": "X% monthly increase", "capacity_warning": "description or null"},\n'
                    '  "top_actions": ["action 1", "action 2", "action 3"]\n'
                    "}\n\n"
                    "Efficiency score rules:\n"
                    "- Start at 100, deduct points for: idle resources (-10 each), "
                    "oversized resources (-5 each), missing optimizations (-3 each)\n"
                    "- Minimum score is 0\n\n"
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
        result = json.loads(content)
        # Ensure required fields exist
        result.setdefault("efficiency_score", 75)
        result.setdefault("scale_down", [])
        result.setdefault("scale_up", [])
        result.setdefault("predictions", {})
        result.setdefault("top_actions", [])
        return result
    except json.JSONDecodeError:
        return {
            "summary": "AI analysis completed but response parsing failed.",
            "raw_response": content,
            "issues": [],
            "scale_down": [],
            "scale_up": [],
            "total_estimated_savings": "Unknown",
            "efficiency_score": 50,
            "predictions": {},
            "top_actions": [],
        }


def chat_with_ai(user_message: str, context: dict) -> str:
    """Handle conversational AI chat about cloud costs."""
    client = get_client()
    model = os.getenv("AZURE_OPENAI_MODEL", "") or os.getenv("AI_MODEL", "llama-3.3-70b-versatile")

    system_prompt = (
        "You are CloudPulse AI, a conversational cloud cost optimization assistant. "
        "You help users understand their AWS spending, identify savings opportunities, "
        "and provide personalized recommendations based on their role.\n\n"
        "When answering:\n"
        "- Be specific with dollar amounts and percentages\n"
        "- Reference actual resource names and IDs when available\n"
        "- Provide actionable next steps\n"
        "- Adapt language based on user role (technical for DevOps, business-focused for Finance/CTO)\n"
        "- If asked 'why is my bill high', break down the top cost drivers\n"
        "- If asked how to save money, provide a prioritized plan\n\n"
        "Available context about the user's AWS environment:\n"
        f"{json.dumps(context, indent=2, default=str)}\n"
    )

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=0.5,
        max_tokens=2048,
    )

    return response.choices[0].message.content.strip()


def simulate_optimization(resources: list, selected_actions: list) -> dict:
    """Simulate the impact of applying optimization recommendations."""
    client = get_client()
    model = os.getenv("AZURE_OPENAI_MODEL", "") or os.getenv("AI_MODEL", "llama-3.3-70b-versatile")

    # Enforce rightsizing-only simulations (no stop/terminate actions).
    allowed_actions = []
    for action in selected_actions:
        text = json.dumps(action).lower()
        if "scale" in text or "downsize" in text or "rightsize" in text:
            if "stop" not in text and "terminate" not in text:
                allowed_actions.append(action)

    prompt = (
        "Given these AWS resources and selected optimization actions, "
        "simulate the cost impact. Return a JSON response with:\n"
        "{\n"
        '  "simulations": [{"resource": "name", "resource_id": "id", '
        '"current_monthly_cost": "$X", "projected_monthly_cost": "$X", '
        '"monthly_savings": "$X", "action": "description"}],\n'
        '  "total_current_cost": "$X/month",\n'
        '  "total_projected_cost": "$X/month",\n'
        '  "total_monthly_savings": "$X/month",\n'
        '  "total_annual_savings": "$X/year",\n'
        '  "performance_impact": "description of any performance trade-offs",\n'
        '  "risk_level": "low|medium|high"\n'
        "}\n\n"
        "Rules:\n"
        "- Recommend ONLY downscale/rightsizing options (e.g. t3.large -> t3.medium).\n"
        "- Do NOT suggest stop, terminate, delete, or remove actions.\n"
        "- If an action is not a downscale/rightsizing action, ignore it.\n\n"
        f"Resources:\n{json.dumps(resources, indent=2, default=str)}\n\n"
        f"Selected Actions:\n{json.dumps(allowed_actions, indent=2, default=str)}\n\n"
        "Only return valid JSON, no markdown or extra text."
    )

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are an AWS cost simulation engine. Provide realistic cost estimates."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=2048,
    )

    content = response.choices[0].message.content.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()

    try:
        result = json.loads(content)
        banned_words = ("stop", "terminate", "delete", "remove")

        filtered = []
        for row in result.get("simulations", []):
            action_text = str(row.get("action", "")).lower()
            if any(word in action_text for word in banned_words):
                continue
            filtered.append(row)

        result["simulations"] = filtered
        return result
    except json.JSONDecodeError:
        return {"error": "Failed to parse simulation results", "raw": content}


def _build_prompt(resources: list) -> str:
    """Build the analysis prompt from resource data."""
    resource_summary = json.dumps(resources, indent=2, default=str)

    return (
        f"Analyze the following {len(resources)} AWS resources for cost optimization opportunities.\n"
        f"Look for:\n\n"
        f"**Scale Down Opportunities** (resources that are over-provisioned):\n"
        f"- EC2 instances with CPU < 20% or memory < 30% (stable workload)\n"
        f"- RDS instances with low connections/CPU\n"
        f"- Over-provisioned Lambda functions\n\n"
        f"**Scale Up Opportunities** (resources at risk of degradation):\n"
        f"- EC2 instances with CPU > 85% or memory > 90%\n"
        f"- RDS hitting connection limits\n\n"
        f"**Idle/Unused Resources**:\n"
        f"- Stopped instances, unattached volumes, unused EIPs\n"
        f"- Unattached load balancers\n\n"
        f"**Misconfigurations**:\n"
        f"- GP2 volumes that should be GP3\n"
        f"- Missing auto-scaling\n"
        f"- Missing Savings Plans or Reserved Instances\n\n"
        f"**Predictive Analysis**:\n"
        f"- Estimate next month's spend based on current trends\n"
        f"- Identify budget overrun risks\n"
        f"- Flag capacity issues\n\n"
        f"Resources:\n{resource_summary}\n\n"
        f"Provide specific AWS CLI fix commands for each issue. "
        f"Calculate the efficiency score based on how optimized these resources are."
    )
