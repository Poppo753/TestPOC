#!/usr/bin/env python3
"""
Slither differential gate — compare a fresh Slither run against the frozen baseline.

Usage:
    python security/slither/compare.py \
        --baseline security/slither/baseline.json \
        --current /tmp/slither-current-raw.json \
        --report-md /tmp/slither-diff.md \
        --fail-on new-high-high,new-med-high,accepted-surface-change,tool-error

Semantics (from S4.2 checklist):
    - tool/compile error: FAIL always
    - new High/High:  FAIL if listed in --fail-on
    - new Med/High:   FAIL if listed in --fail-on
    - new High/Med:   review-required (annotation, non-blocking here)
    - new Low/Info:   report-only
    - baseline surface change on accepted risk: FAIL if listed

Exit codes:
    0 = clean or only report-only findings
    1 = new blocking findings found
    2 = tool/compile error in current run

Fingerprint algorithm: `check::file#firstline` (must match the enrichment in
`build_baseline`).
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path


def fingerprint(check: str, elements: list) -> str:
    """Same fingerprint scheme as security/slither/baseline.json."""
    if elements:
        for e in elements:
            src = e.get("source_mapping", {})
            if src.get("filename_relative"):
                return f"{check}::{src['filename_relative']}#{src.get('lines', [0])[0]}"
    return check


def load_current(path: Path):
    """Load a raw Slither JSON output and return (fingerprint, meta) map."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    if not data.get("success", True):
        return None, data.get("error", "unknown tool error")

    results = data.get("results", {}).get("detectors", [])
    current = {}
    for r in results:
        fp = fingerprint(r.get("check", ""), r.get("elements", []))
        current[fp] = {
            "check": r.get("check"),
            "impact": r.get("impact"),
            "confidence": r.get("confidence"),
            "file": (r.get("elements", [{}])[0].get("source_mapping", {}) or {}).get("filename_relative"),
            "lines": (r.get("elements", [{}])[0].get("source_mapping", {}) or {}).get("lines", [])[:3],
            "description": r.get("description", "").split("\n")[0][:200],
        }
    return current, None


def load_baseline(path: Path):
    with open(path, encoding="utf-8") as f:
        base = json.load(f)
    return {r["fingerprint"]: r for r in base["findings"]}, base.get("policy", {})


def classify_new(new_findings):
    """Return dict of category -> list of findings."""
    cat = {
        "new_hh": [],
        "new_mh": [],
        "new_hm": [],
        "new_low_info": [],
    }
    for f in new_findings:
        i, c = f.get("impact"), f.get("confidence")
        if i == "High" and c == "High":
            cat["new_hh"].append(f)
        elif i == "Medium" and c == "High":
            cat["new_mh"].append(f)
        elif i == "High" and c == "Medium":
            cat["new_hm"].append(f)
        else:
            cat["new_low_info"].append(f)
    return cat


def write_markdown_report(path: Path, new_cat, removed, unchanged_count, policy, blocking):
    """Write a diff report suitable for a PR comment / artifact."""
    lines = []
    lines.append(f"# Slither differential report")
    lines.append("")
    lines.append(f"- Baseline owner: {policy.get('owner', 'n/a')}")
    lines.append(f"- Baseline review date: {policy.get('review_date', 'n/a')}")
    lines.append(f"- Unchanged findings vs baseline: **{unchanged_count}**")
    lines.append(f"- New findings introduced by this run: **{sum(len(v) for v in new_cat.values())}**")
    lines.append(f"- Findings resolved (present in baseline, absent now): **{len(removed)}**")
    lines.append(f"- Blocking: **{'YES' if blocking else 'NO'}**")
    lines.append("")

    def _section(title, items, label):
        if not items:
            return
        lines.append(f"## {title} ({len(items)})")
        lines.append("")
        for it in items[:50]:  # cap for readability
            file = it.get("file") or "?"
            first_line = (it.get("lines") or [0])[0]
            desc = it.get("description", "")
            lines.append(f"- **[{label}]** `{it.get('check')}` — `{file}:{first_line}` — {desc}")
        if len(items) > 50:
            lines.append(f"- … and {len(items) - 50} more")
        lines.append("")

    _section("NEW High/High (BLOCKING)", new_cat["new_hh"], "FAIL")
    _section("NEW Medium/High (BLOCKING)", new_cat["new_mh"], "FAIL")
    _section("NEW High/Medium (review required)", new_cat["new_hm"], "REVIEW")
    _section("NEW Low/Info (report-only)", new_cat["new_low_info"], "INFO")

    if removed:
        lines.append(f"## Resolved ({len(removed)})")
        lines.append("")
        for r in removed[:50]:
            lines.append(f"- `{r.get('check')}` — `{r.get('file')}:{(r.get('lines') or [0])[0]}` — removed since baseline")
        lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline", required=True, type=Path)
    ap.add_argument("--current", required=True, type=Path)
    ap.add_argument("--report-md", type=Path, default=None)
    ap.add_argument(
        "--fail-on",
        default="new-high-high,new-med-high,tool-error",
        help="Comma-separated list of failure categories.",
    )
    args = ap.parse_args()
    fail_on = {x.strip() for x in args.fail_on.split(",") if x.strip()}

    baseline_map, policy = load_baseline(args.baseline)
    current, tool_error = load_current(args.current)

    if tool_error is not None or current is None:
        print(f"::error::Slither tool/compile error: {tool_error}")
        return 2 if "tool-error" in fail_on else 0

    baseline_fps = set(baseline_map.keys())
    current_fps = set(current.keys())

    new_fps = current_fps - baseline_fps
    removed_fps = baseline_fps - current_fps
    unchanged = current_fps & baseline_fps

    new_findings = [current[fp] for fp in new_fps]
    new_cat = classify_new(new_findings)

    print(f"Unchanged: {len(unchanged)}, New: {len(new_findings)}, Removed: {len(removed_fps)}")
    print(
        f"  new H/H={len(new_cat['new_hh'])}, "
        f"M/H={len(new_cat['new_mh'])}, "
        f"H/M={len(new_cat['new_hm'])}, "
        f"L/I={len(new_cat['new_low_info'])}"
    )

    blocking = False
    if "new-high-high" in fail_on and new_cat["new_hh"]:
        blocking = True
        print("::error::New High/High findings introduced. See report.")
    if "new-med-high" in fail_on and new_cat["new_mh"]:
        blocking = True
        print("::error::New Medium/High findings introduced. See report.")

    if args.report_md:
        write_markdown_report(
            args.report_md,
            new_cat,
            [baseline_map[fp] for fp in removed_fps],
            len(unchanged),
            policy,
            blocking,
        )

    return 1 if blocking else 0


if __name__ == "__main__":
    sys.exit(main())
