#!/usr/bin/env python3
import json
import re

# Read all translation files
with open('/Users/jinjingliang/Documents/projects/orca/prepare-for-release-1.4.92-rc1/src/renderer/src/i18n/locales/en.json', 'r') as f:
    en = json.load(f)

with open('/Users/jinjingliang/Documents/projects/orca/prepare-for-release-1.4.92-rc1/src/renderer/src/i18n/locales/zh.json', 'r') as f:
    zh = json.load(f)

with open('/Users/jinjingliang/Documents/projects/orca/prepare-for-release-1.4.92-rc1/src/renderer/src/i18n/locales/ja.json', 'r') as f:
    ja = json.load(f)

with open('/Users/jinjingliang/Documents/projects/orca/prepare-for-release-1.4.92-rc1/src/renderer/src/i18n/locales/es.json', 'r') as f:
    es = json.load(f)

with open('/Users/jinjingliang/Documents/projects/orca/prepare-for-release-1.4.92-rc1/src/renderer/src/i18n/locales/ko.json', 'r') as f:
    ko = json.load(f)

def get_value(obj, path):
    """Get value at path from object"""
    parts = path.split('.')
    current = obj
    for part in parts:
        if current is None or not isinstance(current, dict):
            return None
        current = current.get(part)
    return current

def set_value(obj, path, value):
    """Set value at path in object"""
    parts = path.split('.')
    current = obj
    for part in parts[:-1]:
        if part not in current:
            current[part] = {}
        current = current[part]
    current[parts[-1]] = value

def find_all_strings(obj, path=''):
    """Find all string values in object with their paths"""
    strings = []
    for key, val in obj.items():
        current_path = path + '.' + key if path else key
        if isinstance(val, dict):
            strings.extend(find_all_strings(val, current_path))
        elif isinstance(val, str):
            strings.append((current_path, val))
    return strings

# Find all English strings
en_strings = find_all_strings(en)

# Check which ones are untranslated in each file
def check_untranslated(target, lang_name):
    untranslated = []
    for path, en_val in en_strings:
        target_val = get_value(target, path)
        if target_val == en_val:
            untranslated.append((path, en_val))
    return untranslated

zh_untranslated = check_untranslated(zh, 'zh')
ja_untranslated = check_untranslated(ja, 'ja')
es_untranslated = check_untranslated(es, 'es')
ko_untranslated = check_untranslated(ko, 'ko')

print(f"Found {len(zh_untranslated)} untranslated in zh.json")
print(f"Found {len(ja_untranslated)} untranslated in ja.json")
print(f"Found {len(es_untranslated)} untranslated in es.json")
print(f"Found {len(ko_untranslated)} untranslated in ko.json")

# Export untranslated strings to files for manual translation
with open('/Users/jinjingliang/Documents/projects/orca/prepare-for-release-1.4.92-rc1/untranslated_zh.txt', 'w') as f:
    for path, val in sorted(zh_untranslated):
        f.write(f"{path}: {val}\n")

with open('/Users/jinjingliang/Documents/projects/orca/prepare-for-release-1.4.92-rc1/untranslated_ja.txt', 'w') as f:
    for path, val in sorted(ja_untranslated):
        f.write(f"{path}: {val}\n")

with open('/Users/jinjingliang/Documents/projects/orca/prepare-for-release-1.4.92-rc1/untranslated_es.txt', 'w') as f:
    for path, val in sorted(es_untranslated):
        f.write(f"{path}: {val}\n")

with open('/Users/jinjingliang/Documents/projects/orca/prepare-for-release-1.4.92-rc1/untranslated_ko.txt', 'w') as f:
    for path, val in sorted(ko_untranslated):
        f.write(f"{path}: {val}\n")

print("\nExported untranslated strings to files.")
print("Files created:")
print("- untranslated_zh.txt")
print("- untranslated_ja.txt")
print("- untranslated_es.txt")
print("- untranslated_ko.txt")
