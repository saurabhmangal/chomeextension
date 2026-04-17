import json
import os
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent / ".env"


def load_env(env_path: Path) -> dict:
    env = {}
    if not env_path.exists():
        raise FileNotFoundError(f".env file not found at {env_path}")

    with env_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def send_request(api_key: str, model_name: str, prompt_text: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1/models/{model_name}:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt_text
                    }
                ]
            }
        ],
        "generationConfig": {
            "maxOutputTokens": 256
        }
    }

    import urllib.request

    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "ignore")
        raise RuntimeError(
            f"HTTP {exc.code} {exc.reason}: {body or '[no body]'}"
        )


def extract_text(response_data: str) -> str:
    try:
        response_json = json.loads(response_data)
    except json.JSONDecodeError:
        raise SystemExit(f"Invalid JSON response:\n{response_data}")

    if "candidates" in response_json and response_json["candidates"]:
        candidate = response_json["candidates"][0]
        if isinstance(candidate, dict):
            content = candidate.get("content") or {}
            if isinstance(content, dict):
                parts = content.get("parts") or []
                if parts and isinstance(parts[0], dict):
                    text = parts[0].get("text")
                    if text:
                        return text
            return json.dumps(candidate, indent=2)
        return str(candidate)
    if "output" in response_json:
        output = response_json["output"]
        if isinstance(output, dict) and "text" in output:
            return output["text"]
        return json.dumps(output, indent=2)

    return json.dumps(response_json, indent=2)


def main() -> None:
    env = load_env(ENV_PATH)
    api_key = env.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("GEMINI_API_KEY not found in .env or environment")

    prompt_text = "Who are you?"
    model_candidates = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-001",
        "gemini-2.0-flash",
        "gemini-2.0-flash-001"
    ]

    last_error = None
    response_text = None
    chosen_model = None

    for model_name in model_candidates:
        try:
            print(f"Trying model: {model_name}")
            response_data = send_request(api_key, model_name, prompt_text)
            response_text = extract_text(response_data)
            chosen_model = model_name
            break
        except Exception as exc:
            last_error = exc
            print(f"Model {model_name} failed: {exc}")

    if response_text is None:
        raise SystemExit(f"All model attempts failed. Last error: {last_error}")

    print(f"\n=== Gemini Response from {chosen_model} ===\n")
    print(response_text)
    print("\n============================\n")


if __name__ == "__main__":
    main()
