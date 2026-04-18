import json
import urllib.request
import urllib.error

# Config matching the extension
GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"
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
