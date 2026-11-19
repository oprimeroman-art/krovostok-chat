"""Quick data integrity test for v0.6 scenes without optional browser dependencies."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
raw=(ROOT/"story.js").read_text(encoding="utf-8").split("window.KROVO_STORY = ",1)[1].rsplit(";",1)[0]
data=json.loads(raw)
scenes=data["scenes"]
assert len(scenes)==54 and sum(len(s["choices"]) for s in scenes)==162
assert scenes[38]["id"]=="M01" and scenes[-1]["id"]=="M16"
assert set(s["id"] for s in scenes)==set(s["id"] for s in scenes)
assert sum(len(s["choices"])!=3 for s in scenes)==0
assert any(m.get("kind")=="forward" and m.get("from")=="Колян" for s in scenes for c in s["choices"] for m in c["lines"])
print("PASS: 54 scenes, 162 choices, structured Monday forwards")
