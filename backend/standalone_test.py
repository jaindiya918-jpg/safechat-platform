
import re
from typing import Dict, List

# Re-implementing the logic for standalone testing
class KeywordDetector:
    def __init__(self):
        self.toxic_keywords = {
            'high': [
                'hate', 'die', 'death', 'nazi', 'terrorist',
                'rape', 'murder', 'violence', 'abuse', 'attack',
                'stab', 'shoot', 'kill', 'gun', 'bomb', 'murderer'
            ],
            'medium': [
                'stupid', 'idiot', 'dumb', 'moron', 'loser', 'pathetic',
                'trash', 'garbage', 'worthless', 'useless', 'disgusting',
                'fuck', 'shit', 'bitch', 'asshole', 'fucking'
            ],
            'low': [
                'shut up', 'annoying', 'boring', 'lame',
                'bad', 'terrible', 'awful', 'horrible',
                'fuck', 'shit', 'fucking', 'damn'
            ]
        }
        self.harassment_patterns = [
            r'\bkys\b',
            r'\bgo\s+die\b',
            r'\byou\s+.*fuck',
            r'\bfuck\s+you',
            r'\byou\s+suck',
            r'\bkill\s+yourself\b',
            r'\bkill\s+you\b',
            r'\bkilling\s+you\b',
            r'\bstab\s+you\b',
            r'\bshoot\s+you\b',
            r'\bi\s+will\s+kill\s+you\b',
            r'\bi\s+will\s+stab\s+you\b',
            r'\bi\s+will\s+shoot\s+you\b'
        ]

    def detect(self, text: str) -> Dict:
        text_lower = text.lower()
        detected_words = []
        severity_scores = {'high': 0, 'medium': 0, 'low': 0}

        def make_fuzzy_pattern(word: str) -> str:
            chars = [re.escape(c) for c in word]
            return r"\b" + r"\W*".join(chars) + r"\b"

        for severity, keywords in self.toxic_keywords.items():
            for keyword in keywords:
                pattern = make_fuzzy_pattern(keyword)
                if re.search(pattern, text_lower):
                    detected_words.append(keyword)
                    severity_scores[severity] += 1

        for pattern in self.harassment_patterns:
            if re.search(pattern, text_lower):
                detected_words.append('harassment_pattern')
                severity_scores['high'] += 1

        toxicity_score = (
            severity_scores['high'] * 1.0 +
            severity_scores['medium'] * 0.6 +
            severity_scores['low'] * 0.2
        )
        toxicity_score = min(toxicity_score / 1.5, 1.0)
        is_toxic = toxicity_score >= 0.4 or severity_scores['high'] > 0

        return {
            'is_toxic': is_toxic,
            'toxicity_score': toxicity_score,
            'detected_words': detected_words
        }

def test():
    detector = KeywordDetector()
    test_phrases = [
        "i will stab you",
        "i will kill you",
        "you follow me or i shoot you",
        "have a nice day",
        "you are stupid"
    ]
    
    print("\nStandalone Toxicity Test (Keywords & Patterns)")
    for phrase in test_phrases:
        result = detector.detect(phrase)
        status = "❌ TOXIC" if result['is_toxic'] else "✅ CLEAN"
        print(f"[{status}] '{phrase}'")
        if result['is_toxic']:
            print(f"   Score: {result['toxicity_score']:.2f}, Found: {result['detected_words']}")

if __name__ == "__main__":
    test()
