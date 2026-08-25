#!/usr/bin/env python3
"""
Prueft Theme-Regeln, die theme-check nicht abdeckt, die Shopify beim Sync
aber hart ablehnt. Eine abgelehnte Datei fehlt danach kommentarlos im Theme.

Aufruf:  python3 scripts/validate-theme.py
"""
import json
import re
import sys
from glob import glob
from pathlib import Path

SCHEMA_RE = re.compile(r"\{% schema %\}(.*?)\{% endschema %\}", re.S)
# Shopify schreibt beim Zurueckspielen aus dem Theme-Editor einen
# /* ... */-Kommentarblock an den Anfang der JSON-Templates.
COMMENT_RE = re.compile(r"^\s*/\*.*?\*/\s*", re.S)


def load_json(path):
    return json.loads(COMMENT_RE.sub("", Path(path).read_text()))

# https://shopify.dev/docs/storefronts/themes/architecture/limits
NAME_MAX = 25
SECTIONS_PER_TEMPLATE = 25
BLOCKS_PER_SECTION = 50
UNIT_MAX = 3

problems = []


def fail(where, message):
    problems.append(f"{where}: {message}")


def check_setting(setting, where):
    if setting.get("type") == "range":
        for key in ("min", "max", "step", "default"):
            if key in setting and isinstance(setting[key], str):
                fail(where, f"range '{setting.get('id')}': {key} darf kein String sein")
        lo, hi = setting.get("min"), setting.get("max")
        step = setting.get("step", 1)
        if None not in (lo, hi) and step:
            steps = (hi - lo) / step
            if abs(steps - round(steps)) > 1e-9:
                fail(where, f"range '{setting.get('id')}': (max-min)/step ist nicht ganzzahlig")
            if steps > 101:
                fail(where, f"range '{setting.get('id')}': mehr als 101 Stufen")
        unit = setting.get("unit")
        if unit and len(unit) > UNIT_MAX:
            fail(where, f"range '{setting.get('id')}': unit '{unit}' laenger als {UNIT_MAX} Zeichen")
    if setting.get("type") == "select":
        values = [o.get("value") for o in setting.get("options", [])]
        if len(values) < 2:
            fail(where, f"select '{setting.get('id')}': braucht mindestens zwei Optionen")
        if "default" in setting and setting["default"] not in values:
            fail(where, f"select '{setting.get('id')}': default '{setting['default']}' fehlt in den Optionen")
    if setting.get("type") == "font_picker" and not setting.get("default"):
        fail(where, f"font_picker '{setting.get('id')}': default ist Pflicht und muss ein echter Font-Handle sein")


def check_schema(schema, where):
    name = schema.get("name")
    if name and len(name) > NAME_MAX:
        fail(where, f"name '{name}' hat {len(name)} Zeichen, erlaubt sind {NAME_MAX}")
    for setting in schema.get("settings", []):
        check_setting(setting, where)
    blocks = schema.get("blocks", [])
    if len(blocks) > BLOCKS_PER_SECTION:
        fail(where, f"{len(blocks)} Blocktypen, erlaubt sind {BLOCKS_PER_SECTION}")
    for block in blocks:
        block_where = f"{where} > block '{block.get('type')}'"
        bname = block.get("name")
        if bname and len(bname) > NAME_MAX:
            fail(block_where, f"name '{bname}' hat {len(bname)} Zeichen, erlaubt sind {NAME_MAX}")
        for setting in block.get("settings", []):
            check_setting(setting, block_where)
    for preset in schema.get("presets", []):
        pname = preset.get("name")
        if pname and len(pname) > NAME_MAX:
            fail(f"{where} > preset", f"name '{pname}' hat {len(pname)} Zeichen, erlaubt sind {NAME_MAX}")


def main():
    section_types = {}
    for path in sorted(glob("sections/*.liquid")):
        match = SCHEMA_RE.search(Path(path).read_text())
        if not match:
            continue
        try:
            schema = json.loads(match.group(1))
        except json.JSONDecodeError as exc:
            fail(path, f"Schema ist kein gueltiges JSON: {exc}")
            continue
        section_types[Path(path).stem] = schema
        check_schema(schema, path)

    for path in sorted(glob("config/settings_schema.json")):
        for group in load_json(path):
            for setting in group.get("settings", []):
                check_setting(setting, f"{path} > {group.get('name')}")

    # Templates gegen die Section-Schemas pruefen
    targets = sorted(glob("templates/**/*.json", recursive=True)) + sorted(glob("sections/*-group.json"))
    for path in targets:
        data = load_json(path)
        sections = data.get("sections", {})
        if len(sections) > SECTIONS_PER_TEMPLATE:
            fail(path, f"{len(sections)} Sections, erlaubt sind {SECTIONS_PER_TEMPLATE}")
        for key, section in sections.items():
            stype = section.get("type")
            schema = section_types.get(stype)
            if schema is None:
                fail(path, f"'{key}' verweist auf unbekannte Section '{stype}'")
                continue
            allowed = {b.get("type") for b in schema.get("blocks", [])}
            block_settings = {
                b.get("type"): {s.get("id") for s in b.get("settings", []) if "id" in s}
                for b in schema.get("blocks", [])
            }
            known = {s.get("id") for s in schema.get("settings", []) if "id" in s}
            for sid in (section.get("settings") or {}):
                if sid not in known:
                    fail(path, f"'{key}': unbekannte Einstellung '{sid}' in '{stype}'")
            for bid, block in (section.get("blocks") or {}).items():
                btype = block.get("type")
                if allowed and btype not in allowed:
                    fail(path, f"'{key}': unbekannter Block '{btype}' in '{stype}'")
                    continue
                for sid in (block.get("settings") or {}):
                    if sid not in block_settings.get(btype, set()):
                        fail(path, f"'{key}': unbekannte Einstellung '{sid}' in '{stype}/{btype}'")

    # Referenzen auf Snippets und Sections
    snippets = {Path(p).stem for p in glob("snippets/*.liquid")}
    for path in glob("**/*.liquid", recursive=True):
        body = Path(path).read_text()
        for m in re.finditer(r"\{%-?\s*(?:render|include)\s+'([^']+)'", body):
            if m.group(1) not in snippets:
                fail(path, f"Snippet '{m.group(1)}' existiert nicht")
        for m in re.finditer(r"\{%-?\s*section\s+'([^']+)'", body):
            if m.group(1) not in section_types:
                fail(path, f"Section '{m.group(1)}' existiert nicht")

    if problems:
        print(f"{len(problems)} Problem(e):\n")
        for p in problems:
            print("  -", p)
        return 1
    print("Alles in Ordnung.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
