
import os
import sys
import django
import asyncio

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'safechat.settings')
django.setup()

from moderation.ai_detector import ToxicityDetector

async def test_moderation():
    detector = ToxicityDetector()
    test_phrases = [
        "i will stab you",
        "I will shoot you",
        "stabbing someone is fun",
        "you are a nice person",
        "kill yourself",
        "kys"
    ]
    
    print("\n--- Moderation Test Results ---")
    for phrase in test_phrases:
        result = await detector.analyze_async(phrase)
        status = "❌ TOXIC" if result['is_toxic'] else "✅ CLEAN"
        score = result['toxicity_score']
        method = result['method']
        words = result.get('detected_words', [])
        print(f"[{status}] (Score: {score:.2f}, Method: {method})")
        print(f"   Text: '{phrase}'")
        if words:
            print(f"   Words: {words}")
        print("-" * 30)

if __name__ == "__main__":
    asyncio.run(test_moderation())
