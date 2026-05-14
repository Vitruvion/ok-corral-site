"""
Rewrite supabase/seed.sql so it's pure 7-bit ASCII.

Why: pasting SQL into the Supabase SQL editor has been mojibake-ing UTF-8
bytes somewhere in the chain (a Â· instead of ·, etc.). Making the file
pure ASCII closes off the encoding question entirely.

How: PostgreSQL E-string syntax — E'...\\uXXXX...' — lets the database
decode Unicode codepoints from ASCII escapes. We rewrite every '...'
string literal as E'...' with non-ASCII chars escaped, and ASCII-ify
the comments.

This script is idempotent. Re-running it on already-converted SQL is a
no-op.
"""
import re
import sys
from pathlib import Path

PATH = Path(__file__).resolve().parent.parent / 'supabase' / 'seed.sql'

# Comments don't run through Postgres's E-string decoder, so non-ASCII
# chars there are useful only for humans reading the file. We swap them
# for safe ASCII so the file is pasteable anywhere.
COMMENT_MAP = {
    '·': '.',   # ·
    '–': '-',   # –
    '—': '-',   # —
    '•': '*',   # •
    '─': '-',   # ─
    '═': '=',   # ═
    '╔': '+', '╗': '+', '╚': '+', '╝': '+',
    '┌': '+', '┐': '+', '└': '+', '┘': '+',
    '◆': '*',   # ◆
    '‘': "'", '’': "'",
    '“': '"', '”': '"',
}


def asciify_comment(s: str) -> str:
    out = []
    for ch in s:
        if ord(ch) < 128:
            out.append(ch)
        elif ch in COMMENT_MAP:
            out.append(COMMENT_MAP[ch])
        else:
            out.append('?')
    return ''.join(out)


def escape_e_body(s: str) -> str:
    """Encode each non-ASCII char as \\uXXXX inside an E-string body."""
    out = []
    for ch in s:
        cp = ord(ch)
        if cp < 128:
            # backslashes need doubling in E-strings
            if ch == '\\':
                out.append('\\\\')
            else:
                out.append(ch)
        elif cp <= 0xFFFF:
            out.append(f'\\u{cp:04X}')
        else:
            out.append(f'\\U{cp:08X}')
    return ''.join(out)


def rewrite(text: str) -> str:
    i = 0
    n = len(text)
    result = []
    while i < n:
        ch = text[i]
        # Line comment '-- ...' to end of line
        if ch == '-' and i + 1 < n and text[i + 1] == '-':
            j = text.find('\n', i)
            if j == -1:
                j = n
            result.append(asciify_comment(text[i:j]))
            i = j
            continue
        # String literal
        if ch == "'":
            # Detect whether this is already an E-string (E' preceding)
            already_e = False
            if result and result[-1].lower().endswith('e'):
                # If the prior token char is "E" (case-insensitive) and it's
                # not part of an identifier, treat as E-string. Cheap heuristic
                # that works for our generated SQL.
                prior = result[-1]
                if prior.endswith('E') or prior.endswith('e'):
                    # Look two chars back for non-identifier boundary.
                    if len(prior) >= 2:
                        boundary = prior[-2]
                        if not (boundary.isalnum() or boundary == '_'):
                            already_e = True
                    else:
                        already_e = True
            # Capture string body (handle '' escape for embedded apostrophe)
            j = i + 1
            body = []
            while j < n:
                c = text[j]
                if c == "'" and j + 1 < n and text[j + 1] == "'":
                    body.append("''")
                    j += 2
                    continue
                if c == "'":
                    break
                body.append(c)
                j += 1
            body_str = ''.join(body)
            if already_e:
                # leave as-is (already an E-string from a previous run)
                result.append("'" + body_str + "'")
            else:
                # rewrite as E-string with \uXXXX escapes
                result.append("E'" + escape_e_body(body_str) + "'")
            i = j + 1
            continue
        result.append(ch)
        i += 1
    return ''.join(result)


def main():
    text = PATH.read_text(encoding='utf-8')
    new_text = rewrite(text)
    PATH.write_text(new_text, encoding='utf-8', newline='\n')
    nonascii = [c for c in new_text if ord(c) > 127]
    print(f'rewrote {len(text)} -> {len(new_text)} chars')
    print(f'non-ASCII chars remaining: {len(nonascii)}')
    if nonascii:
        unique = sorted(set(nonascii))
        sample = ', '.join(f'U+{ord(c):04X}' for c in unique[:10])
        print(f'unique codepoints: {sample}')
    else:
        print('file is pure 7-bit ASCII')


if __name__ == '__main__':
    main()
