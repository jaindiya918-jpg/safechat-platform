import os
import asyncio
import time
from dotenv import load_dotenv
from moderation.ai_detector import ToxicityDetector

# Load env vars
load_dotenv()

async def test_async_detection():
    print(f"Checking API Key: {'Present' if os.getenv('OPENAI_API_KEY') else 'MISSING'}")
    
    detector = ToxicityDetector(method='api')
    
    text = "You are amazing and I love this stream!"
    toxic_text = "You are a stupid idiot"

    print(f"\nTesting clean text: '{text}'")
    start = time.time()
    res1 = await detector.analyze_async(text)
    end = time.time()
    print(f"Result: {res1}")
    print(f"Time: {end - start:.4f}s")

    print(f"\nTesting toxic text: '{toxic_text}'")
    start = time.time()
    res2 = await detector.analyze_async(toxic_text)
    end = time.time()
    print(f"Result: {res2}")
    print(f"Time: {end - start:.4f}s")
    
    # Check concurrent performance
    print(f"\nTesting concurrency (3 requests)...")
    start = time.time()
    results = await asyncio.gather(
        detector.analyze_async("Request 1"),
        detector.analyze_async("Request 2"),
        detector.analyze_async("Request 3")
    )
    end = time.time()
    print(f"Total time for 3 requests: {end - start:.4f}s")
    print(f"Average time per request: {(end - start)/3:.4f}s")

if __name__ == "__main__":
    asyncio.run(test_async_detection())
