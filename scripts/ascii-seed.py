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


_HEX = set('0123456789abcdefABCDEF')


def escape_e_body(s: str) -> str:
    """Encode each non-ASCII char as \\uXXXX inside an E-string body.

    Idempotent: already-escaped sequences (\\uXXXX, \\UXXXXXXXX) pass through
    unchanged so re-running this script doesn't double-escape backslashes.
    Stray backslashes that aren't part of a recognized escape do get doubled.
    """
    out = []
    i = 0
    n = len(s)
    while i < n:
        ch = s[i]
        cp = ord(ch)
        if cp >= 128:
            # Raw non-ASCII char → escape it.
            if cp <= 0xFFFF:
                out.append(f'\\u{cp:04X}')
            else:
                out.append(f'\\U{cp:08X}')
            i += 1
            continue
        if ch == '\\':
            # Count consecutive backslashes, then look at what follows.
            j = i
            while j < n and s[j] == '\\':
                j += 1
            # If any run of backslashes is followed by uXXXX or UXXXXXXXX,
            # collapse to a single \uXXXX / \UXXXXXXXX. This makes the script
            # idempotent: prior buggy runs that over-escaped (\\u00B7,
            # \\·, …) get normalized back to · on the next pass.
            if j + 4 < n and s[j] == 'u' and all(s[j + 1 + k] in _HEX for k in range(4)):
                out.append('\\u' + s[j + 1:j + 5])
                i = j + 5
                continue
            if j + 8 < n and s[j] == 'U' and all(s[j + 1 + k] in _HEX for k in range(8)):
                out.append('\\U' + s[j + 1:j + 9])
                i = j + 9
                continue
            # Stray backslashes not followed by a recognized escape — pass
            # through as-is. (Our seed data has no legitimate literal
            # backslashes, so this branch is mostly defensive.)
            out.append(s[i:j])
            i = j
            continue
        out.append(ch)
        i += 1
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
            # Always escape non-ASCII inside the body. The `already_e` flag
            # only controls whether we emit an additional `E` prefix — if
            # the prior char was already `E`, just emit `'...'` so we don't
            # produce `EE'...'`.
            escaped_body = escape_e_body(body_str)
            if already_e:
                result.append("'" + escaped_body + "'")
            else:
                result.append("E'" + escaped_body + "'")
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
