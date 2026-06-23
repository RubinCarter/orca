#!/usr/bin/env python3
"""
Translation script for zh.json i18n file.
Updates untranslated English strings to Chinese while preserving proper nouns.
"""

import json
import re

# Load both files
with open('src/renderer/src/i18n/locales/zh.json', 'r', encoding='utf-8') as f:
    zh = json.load(f)

with open('src/renderer/src/i18n/locales/en.json', 'r', encoding='utf-8') as f:
    en = json.load(f)

def flatten_dict(d, parent_key='', sep='.'):
    """Flatten nested dictionary"""
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep).items())
        else:
            items.append((new_key, v))
    return dict(items)

def unflatten_dict(flat_dict, sep='.'):
    """Unflatten dictionary"""
    result = {}
    for key, value in flat_dict.items():
        parts = key.split(sep)
        d = result
        for part in parts[:-1]:
            if part not in d:
                d[part] = {}
            d = d[part]
        d[parts[-1]] = value
    return result

en_flat = flatten_dict(en)
zh_flat = flatten_dict(zh)

# Proper nouns and technical terms to keep in English (expanded list)
keep_english = {
    'Orca', 'OpenClaw', 'Hermes', 'Rovo Dev', 'Qwen Code', 'Mistral Vibe', 'Kimi', 'Droid', 'Cursor', 'Continue',
    'Command Code', 'Codebuff', 'Cline', 'Autohand Code', 'Auggie', 'Charm', 'Kiro', 'Kilocode', 'Amp', 'Goose',
    'Aider', 'Antigravity', 'Gemini', 'OMP', 'Pi', 'OpenCode', 'GitHub Copilot', 'Grok', 'Codex', 'OpenClaude',
    'Claude Agent Teams', 'Claude', 'Devin', 'Ante', 'Zed', 'VS Code', 'Linear', 'Jira', 'GitLab', 'GitHub',
    'WebSocket', 'SSH', 'PR', 'API', 'WSL', 'GPU', 'CPU', 'HTML', 'WebGL', 'PowerShell', 'bash', 'Bash',
    'Azure DevOps', 'Bitbucket', 'Atlassian', 'Markdown', 'Git', 'Git CLI', 'gh', 'Docker', 'WSL', 'SSH',
    'GPU', 'CPU', 'RAM', 'JSON', 'YAML', 'yaml', 'XML', 'HTTP', 'HTTPS', 'URL', 'CLI', 'AI', 'UX', 'UI',
    'CSS', 'JS', 'JavaScript', 'TypeScript', 'TS', 'Node', 'Node.js', 'React', 'Vue', 'Angular', 'Python',
    'Ruby', 'Java', 'Go', 'Rust', 'C++', 'C#', 'Swift', 'Kotlin', 'PHP', 'Perl', 'Shell', 'Terminal',
    'terminal', 'Cookie', 'cookie', 'cookies', 'Cookies', 'Web', 'web', 'Web Client', 'WebSocket', 'websocket',
    'Agent', 'agent', 'Agents', 'agents', 'Conductor', 'Source', 'source', 'Budget', 'budget',
    '127.0.0.1', 'bastion.example.com', 'auth=Fe26.2**…', 'apfs', 'calt', 'ripgrep',
    'OpenClaude', 'GitHub Copilot', 'OMP', 'OpenCode Go', 'Conductor', 'Devin', 'Ante',
    'Kiro', 'Mistral Vibe', 'Qwen Code', 'Rovo Dev', 'OpenClaw', 'Hermes', 'Command Code',
    'Autohand Code', 'Auggie', 'Charm', 'Kilocode', 'Amp', 'Goose', 'Aider', 'Antigravity', 'Codebuff',
    'Continue', 'Droid', 'Pi', 'OMP', 'Grok', 'Claude Agent Teams',
    # Additional proper nouns
    'Rovo', 'Copilot', 'Azure', 'Atlassian', 'Debian', 'Ubuntu', 'Alpine', 'CentOS', 'Fedora', 'Arch',
    'macOS', 'Mac', 'Windows', 'Linux', 'iOS', 'Android', 'Chrome', 'Safari', 'Firefox', 'Edge',
    'VSCode:', 'Vim', 'Emacs', 'Sublime', 'Atom', 'IntelliJ', 'WebStorm', 'PyCharm', 'PhpStorm',
    'Xcode', 'Android Studio', 'Eclipse', 'NetBeans', 'GitKraken', 'Sourcetree', 'Tower',
    'GitHub Actions', 'GitLab CI', 'CircleCI', 'Travis CI', 'Jenkins', 'TeamCity', 'Bamboo',
    'npm', 'yarn', 'pnpm', 'pip', 'gem', 'cargo', 'maven', 'gradle', 'nuget', 'choco',
    'webpack', 'rollup', 'vite', 'parcel', 'esbuild', 'babel', 'eslint', 'prettier',
    'jest', 'mocha', 'jasmine', 'cypress', 'playwright', 'selenium', 'vitest',
    'postcss', 'sass', 'less', 'stylus', 'tailwind', 'bootstrap', 'material-ui',
    'react-query', 'redux', 'mobx', 'zustand', 'recoil', 'jotai',
    'express', 'koa', 'fastify', 'nest', 'next', 'nuxt', 'gatsby', 'astro',
    'prisma', 'sequelize', 'typeorm', 'mongoose', 'knex', 'objection',
    'postgresql', 'postgres', 'mysql', 'sqlite', 'mongodb', 'redis', 'elasticsearch', 'cassandra',
    'docker-compose', 'kubernetes', 'k8s', 'helm', 'terraform', 'ansible', 'pulumi',
    'aws', 'azure', 'gcp', 'gcloud', 'firebase', 'supabase', 'heroku', 'vercel', 'netlify',
    'stripe', 'twilio', 'sendgrid', 'mailgun', 'aws-ses',
}

# Patterns to keep (strings that shouldn't be translated)
keep_patterns = [
    r'^\d+\.\d+\.\d+.*$',  # IP addresses
    r'^https?://.*$',  # URLs
    r'^/.*$',  # Paths
    r'^\[?[A-Za-z]+\]?$',  # Single words that are likely technical terms
    r'^\{\{.*\}\}$',  # Template variables only
    r'^:[A-Z]',  # Emoji-like strings
    r'^size-',  # CSS classes
    r'^size-\d+',  # CSS classes
    r'^text-',  # CSS classes
    r'^muted-foreground',  # CSS classes
    r'^[A-Za-z]+\.exe$',  # Executables
    r'^gh\s',  # GitHub CLI commands
    r'^git\s',  # Git commands
    r'^\w+://',  # Protocol URLs
    r'^\$\w+',  # Environment variables
    r'^\d+%$',  # Percentages
    r'^\d+[KMGT]B$',  # File sizes
]

def should_translate(value):
    """Determine if a string should be translated"""
    if not isinstance(value, str) or not value.strip():
        return False
    
    # Check if value is in keep_english set
    if value in keep_english:
        return False
    
    # Check patterns
    for pattern in keep_patterns:
        if re.match(pattern, value):
            return False
    
    # Check if it contains only technical terms or template variables
    words = value.split()
    non_template_words = [w for w in words if not re.match(r'\{\{.*\}\}', w)]
    if not non_template_words:
        return False  # Only template variables
    
    # Check if mostly English proper nouns
    if all(w in keep_english or not re.match(r'^[a-zA-Z]', w) for w in non_template_words):
        return False
    
    return True

def translate_value(value):
    """Translate a single English value to Chinese"""
    # This is a simplified translation - in practice you would use a translation service or mapping
    # For now, return None to indicate no translation available
    return None

# Find all untranslated strings
untranslated = []
for key, en_value in en_flat.items():
    if key in zh_flat:
        zh_value = zh_flat[key]
        if en_value == zh_value and should_translate(en_value):
            untranslated.append((key, en_value))

print(f"Found {len(untranslated)} untranslated strings")

# Show first 50 for review
for key, value in sorted(untranslated)[:50]:
    print(f"  {key}: {value}")
