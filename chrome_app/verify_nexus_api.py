import json
import os
import urllib.request
import urllib.error
from pathlib import Path


def load_env() -> dict:
    env_path = Path(__file__).resolve().parent / ".env"
    env = {}
    if not env_path.exists():
        return env
    with env_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


_env = load_env()
GEMINI_API_KEY = _env.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY", "")
MODEL_NAME = "gemini-2.5-flash"
API_URL = f"https://generativelanguage.googleapis.com/v1/models/{MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"

def run_nexus_test():
    print(f"--- Nexus Extension Automated Test ---")
    print(f"Testing Model: {MODEL_NAME}")
    
    payload = {
        "contents": [{"parts": [{"text": "Briefly summarize the benefit of using AI for web browsing."}]}]
    }
    
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(API_URL, data=data, headers={"Content-Type": "application/json"}, method="POST")
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            summary = res_data["candidates"][0]["content"]["parts"][0]["text"]
            print("\n[PASSED] Extension Backend Connectivity Test")
            print("-" * 40)
            print(f"Gemini Response: {summary.strip()}")
            print("-" * 40)
            print("\nConclusion: The Gemini integration is active and responding correctly.")
    except Exception as e:
        print(f"\n[FAILED] Error: {str(e)}")
        print("Please ensure you have reloaded the extension in chrome://extensions/")

if __name__ == "__main__":
    run_nexus_test()
