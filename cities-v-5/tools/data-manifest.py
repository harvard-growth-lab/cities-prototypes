"""Snapshot the data manifest for the text editor (?edit).

Reads the "Data manifest" Google Sheet (it is link-readable, so no sign-in)
and writes ../data-manifest.js: one entry per metric row, with the fields
(parquet columns) it names and how the sheet says it is computed. The editor
lists these when text is marked dynamic. Run it again whenever the sheet
changes:

    python3 cities-v-5/tools/data-manifest.py

Only the page with ?edit loads the snapshot.
"""
import csv
import io
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

SHEET = "1RdaA7qJiePBGVlfibSnHXteRWwQMJs3zyT6BB4mMzxY"
GID = "1856054194"
URL = f"https://docs.google.com/spreadsheets/d/{SHEET}/export?format=csv&gid={GID}"
VIEW = f"https://docs.google.com/spreadsheets/d/{SHEET}/edit?gid={GID}#gid={GID}"
OUT = Path(__file__).resolve().parent.parent / "data-manifest.js"
SKIP = {"year", "period", "start_year", "end_year"}  # the time axis, never a value on its own


def split_top(s):
    """Split on commas that are not inside parentheses."""
    out, depth, cur = [], 0, ""
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch == "," and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return [p.strip() for p in out if p.strip()]


def fields(row):
    files = re.findall(r"[\w]+\.parquet", row["Data Files"])
    seen, out = set(), []
    for line in row["Metric Name"].splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.match(r"([\w]+\.parquet):\s*(.*)", line)
        line_file, rest = (m.group(1), m.group(2)) if m else (None, line)
        for part in split_top(rest):
            name = re.match(r"[A-Za-z_]\w*", part)
            if not name or name.group(0) in SKIP:
                continue
            paren = re.search(r"\((.*)\)", part)
            note = paren.group(1).strip() if paren else ""
            named = re.findall(r"[\w]+\.parquet", note)
            if named:
                note = ""
            targets = named or [line_file or (files[0] if len(files) == 1 else "")]
            for f in targets:
                key = (name.group(0), f)
                if key in seen:
                    continue
                seen.add(key)
                out.append({"column": name.group(0), "file": f, "note": note})
    return out


def main():
    with urllib.request.urlopen(URL, timeout=30) as r:
        text = r.read().decode("utf-8")
    rows = []
    for i, row in enumerate(csv.DictReader(io.StringIO(text)), start=2):  # sheet row number
        if row["Metric Name"].strip() in ("", "TBD"):
            continue
        rows.append({
            "row": i,
            "section": row["Section"].strip(),
            "module": row["Module"].strip(),
            "analysis": row["Analysis"].strip(),
            "level": row["Level"].strip(),
            "metric": re.sub(r"\s+", " ", row["Data/Metric"]).strip(),
            "years": row["Years"].strip(),
            "type": row["Data type"].strip(),
            "status": row["Status"].strip(),
            "compute": row["Needs Computation?"].strip().lower() == "yes",
            "calculation": re.sub(r"\s+", " ", row["Calculation"]).strip(),
            "instruction": re.sub(r"\s+", " ", row["Computation Instruction"]).strip(),
            "fields": fields(row),
        })
    data = {"source": VIEW, "fetched": date.today().isoformat(), "rows": rows}
    OUT.write_text(
        "/* The data manifest, as a snapshot for the text editor (?edit only).\n"
        "   Made by tools/data-manifest.py from " + VIEW + "\n"
        "   Do not edit by hand: run the script again when the sheet changes. */\n"
        "window.DATA_MANIFEST = " + json.dumps(data, indent=1, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print(f"{len(rows)} metrics, {sum(len(r['fields']) for r in rows)} fields -> {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
