#!/usr/bin/env python3
"""Split email-templates.md into one paste-ready .html per template.

The markdown file is the source of truth - it carries the reasoning, the
measured contrast table and the rules. But it stores each body inside a
```html fence, and a fence is easy to select along with the HTML: pasted into
Supabase it rendered the word "html" at the top of the email, which is exactly
the kind of defect that reaches a real person before anybody notices.

So the bodies are also emitted as bare files. Open, Cmd+A, Cmd+C, paste. There
is nothing in them to trim.

Run after editing email-templates.md:  python3 tools/split-emails.py
"""
import io, re, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, 'email-templates.md')
OUT  = os.path.join(ROOT, 'email-templates')

s = io.open(SRC, encoding='utf-8').read()
names    = re.findall(r'^## \d+\. (.+)$', s, re.M)
subjects = re.findall(r'\*\*Subject:\*\* `([^`]+)`', s)
bodies   = re.findall(r'```html\n(.*?)\n```', s, re.S)

if not (len(names) == len(subjects) == len(bodies)):
    sys.exit(f'headings {len(names)}, subjects {len(subjects)}, bodies {len(bodies)} - '
             'they must match, so one of them is malformed')

os.makedirs(OUT, exist_ok=True)
for n, body in zip(names, bodies):
    fn = os.path.join(OUT, n.lower().replace(' ', '-') + '.html')
    io.open(fn, 'w', encoding='utf-8').write(body)
    print(f'  {os.path.relpath(fn, ROOT)}  {len(body)} bytes')
print(f'{len(bodies)} templates written')
