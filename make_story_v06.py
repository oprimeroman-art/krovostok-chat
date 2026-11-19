"""Rebuild v0.6 from legacy Thursday+weekend generator and appended Monday data."""
from pathlib import Path
import json
import runpy
ROOT=Path(__file__).resolve().parent
runpy.run_path(str(ROOT/"make_story.py"),run_name="__main__")
target=ROOT/"story.js"
text=target.read_text(encoding="utf-8")
data=json.loads(text.split("window.KROVO_STORY = ",1)[1].rsplit(";",1)[0])
assert len(data["scenes"])==38, "Expected legacy 38 scenes; refusing duplicate Monday append"
new=json.loads((ROOT/"data"/"monday_scenes.json").read_text(encoding="utf-8"))
assert len(new)==16 and new[0]["id"]=="M01" and new[-1]["id"]=="M16"
data["scenes"].extend(new)
data["meta"]["title"]="КРОВОСТОК — Четверг / Пятница / Выходные / Понедельник"
data["meta"]["scenes"]=len(data["scenes"])
target.write_text("/* Story data: original game dialogue; no copied song lyrics. */\nwindow.KROVO_STORY = "+json.dumps(data,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf-8")
print("Rebuilt",len(data["scenes"]),"scenes")
