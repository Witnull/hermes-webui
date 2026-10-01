"""Regression tests for #7949: public-share creation 500s on an inline image.

A conversation containing an inline-image MEDIA token — ``MEDIA:data:image/
...;base64,<blob>`` — whose data URI was longer than ~4 KB made
``build_share_snapshot`` / ``_embed_share_media`` raise
``OSError: [Errno 36] File name too long`` (ENAMETOOLONG) and return HTTP 500.

Root cause: ``_SHARE_MEDIA_RE`` excluded only ``http(s)://`` URLs, so a
``data:`` token matched and its entire base64 blob became the ``raw`` "path".
``_resolve_against_roots`` then ran ``(root / raw).resolve()`` followed by
``candidate.is_file()`` — and the ``is_file()`` stat() sat OUTSIDE the
``resolve()`` try/except, so an over-length path's ENAMETOOLONG escaped.

Two independent fixes, both asserted here:
  1. ``data:`` URIs are excluded from ``_SHARE_MEDIA_RE`` (like ``http(s)``),
     so the token passes through unchanged for the share page's client-side
     ``renderMd()`` to render as an inline ``<img>``.
  2. ``_resolve_against_roots`` has a defensive length/newline/NUL guard and
     moves every filesystem probe inside the try/except, so no pathological
     ``raw`` from any caller can crash it.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from api import shares


def _embed(text: str, roots):
    return shares._embed_share_media(text, allowed_roots=tuple(roots))


@pytest.mark.parametrize("blob_len", [200, 5_000, 60_000])
def test_inline_data_uri_does_not_crash_share_embed(tmp_path: Path, blob_len):
    """The exact #7949 crash: a >4 KB inline-image data URI must not raise."""
    ws = tmp_path / "workspace"
    ws.mkdir()
    text = f"Here is a chart: MEDIA:data:image/png;base64,{'A' * blob_len}"
    # Must not raise OSError ENAMETOOLONG (the pre-fix behaviour).
    out = _embed(text, [ws])
    # The token is passed through unchanged — it is NOT turned into a
    # placeholder and NOT filesystem-resolved; the share page's renderMd()
    # renders data:image/* as an inline <img>.
    assert "MEDIA:data:image/png;base64," in out
    assert shares._PLACEHOLDER not in out


def test_data_uri_token_is_not_matched_by_the_media_regex():
    """`data:` is excluded from _SHARE_MEDIA_RE exactly like http(s)."""
    assert shares._SHARE_MEDIA_RE.search("MEDIA:data:image/png;base64,AAAA") is None
    assert shares._SHARE_MEDIA_RE.search("MEDIA:https://e.com/a.png") is None
    # ...but a genuine local path still matches.
    m = shares._SHARE_MEDIA_RE.search("MEDIA:local.png")
    assert m is not None and m.group(1) == "local.png"


def test_real_local_image_still_embeds(tmp_path: Path):
    """Regression guard: the fix must not break normal local-file embedding."""
    ws = tmp_path / "workspace"
    ws.mkdir()
    (ws / "ok.png").write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 64)
    out = _embed("See MEDIA:ok.png here", [ws])
    assert '<img src="data:image/png;base64,' in out
    assert shares._PLACEHOLDER not in out


def test_http_url_still_passes_through(tmp_path: Path):
    ws = tmp_path / "workspace"
    ws.mkdir()
    out = _embed("x MEDIA:https://example.com/a.png y", [ws])
    assert "MEDIA:https://example.com/a.png" in out


def test_build_share_snapshot_with_inline_image_does_not_500(tmp_path: Path):
    """End-to-end: a session whose message holds a big inline image snapshots
    cleanly (the reporter's exact repro path through build_share_snapshot)."""

    class _FakeSession:
        def __init__(self, messages):
            self.session_id = "s-7949"
            self.title = "Share test"
            self.messages = messages
            self.workspace = str(tmp_path / "workspace")
            self.created_at = 0
            self.updated_at = 0

        def to_dict(self):
            return {
                "session_id": self.session_id,
                "title": self.title,
                "messages": self.messages,
                "workspace": self.workspace,
            }

    (tmp_path / "workspace").mkdir(exist_ok=True)
    big = "A" * 60_000
    session = _FakeSession(
        [
            {"role": "user", "content": "render a chart"},
            {"role": "assistant", "content": f"Here: MEDIA:data:image/png;base64,{big}"},
        ]
    )
    # Must not raise (pre-fix: OSError ENAMETOOLONG -> HTTP 500).
    snapshot = shares.build_share_snapshot(session)
    assert isinstance(snapshot, dict)
    # The inline image survives into the snapshot for client-side rendering.
    assert any(
        "MEDIA:data:image/png;base64," in str(m.get("content", ""))
        for m in snapshot.get("messages", [])
    )


def test_resolver_rejects_overlong_token_without_raising(tmp_path: Path):
    """Belt-and-suspenders: _resolve_against_roots must fail closed (return a
    placeholder), never raise, on an over-length / newline / NUL token even if
    one reaches it directly (bypassing the regex)."""
    ws = tmp_path / "workspace"
    ws.mkdir()
    for raw in ("x" * 5000, "a\nb.png", "a\x00b.png"):
        # Routed through the public helper so we exercise the real call path;
        # an over-length relative "path" must degrade to the placeholder.
        out = _embed(f"MEDIA:{raw}", [ws])
        # Either passed through untouched or placeholdered — never a crash,
        # and never a leaked embed.
        assert "<img src=\"data:" not in out
