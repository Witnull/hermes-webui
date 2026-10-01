"""
Regression tests for issue #7955 — ``model.provider: ollama`` with a
``base_url`` makes every Custom-group model fail with
``custom:<tag-prefix> not configured``.

The picker reports a configured provider that aliases to the generic
``custom`` lane as ``custom``, so the session stores ``custom`` while
config.yaml still says ``ollama``. ``model_with_provider_context()``
compared the two raw strings, saw a mismatch, and emitted
``@custom:qwen3.8:27b``. ``resolve_model_provider()`` then read the tag
prefix as a named-provider slug: provider ``custom:qwen3.8``, model ``27b``.

The fix keeps the model bare when the session provider is ``custom`` and
the configured provider aliases to ``custom``, so ``model.base_url``
routing stays in charge.

``ollama -> custom`` lives in the agent's alias table
(``hermes_cli.models._PROVIDER_ALIASES``), which the WebUI merges when the
agent is importable; the tests stand in for it with a stub module holding
only that entry. ``local -> custom`` is in the WebUI's own table and needs
no agent.
"""

import sys
import types

import pytest

import api.config as config

OLLAMA_BASE_URL = "http://localhost:11434/v1"


def _set_config(provider, base_url=None, default=None, custom_providers=None):
    old_cfg = dict(config.cfg)
    model_cfg = {}
    if provider:
        model_cfg["provider"] = provider
    if base_url:
        model_cfg["base_url"] = base_url
    if default:
        model_cfg["default"] = default
    config.cfg["model"] = model_cfg
    config.cfg["providers"] = {}
    config.cfg["custom_providers"] = custom_providers or []
    return old_cfg


def _restore(old_cfg):
    config.cfg.clear()
    config.cfg.update(old_cfg)


@pytest.fixture
def agent_aliases_ollama_to_custom(monkeypatch):
    """Stand in for the agent's alias table, which maps ``ollama`` to ``custom``."""
    models = types.ModuleType("hermes_cli.models")
    models._PROVIDER_ALIASES = {"ollama": "custom"}
    package = types.ModuleType("hermes_cli")
    package.models = models
    monkeypatch.setitem(sys.modules, "hermes_cli", package)
    monkeypatch.setitem(sys.modules, "hermes_cli.models", models)
    assert config._resolve_provider_alias("ollama") == "custom"


# ── The reported bug: provider ollama + base_url, colon-tagged model ─────


def test_ollama_default_keeps_colon_tagged_custom_model_bare(
    agent_aliases_ollama_to_custom,
):
    old = _set_config(provider="ollama", base_url=OLLAMA_BASE_URL, default="qwen3.8:27b")
    try:
        encoded = config.model_with_provider_context("qwen3.8:27b", "custom")
        assert encoded == "qwen3.8:27b", (
            f"session 'custom' is the configured provider here, got {encoded!r}"
        )
    finally:
        _restore(old)


def test_ollama_default_colon_tagged_model_roundtrip(agent_aliases_ollama_to_custom):
    """The tag prefix must not become a named-provider slug."""
    old = _set_config(provider="ollama", base_url=OLLAMA_BASE_URL, default="qwen3.8:27b")
    try:
        model, provider, base_url = config.resolve_model_provider(
            config.model_with_provider_context("qwen3.8:27b", "custom")
        )
        assert model == "qwen3.8:27b", f"tag was split off the model id: {model!r}"
        assert provider != "custom:qwen3.8", "tag prefix read as a provider slug"
        assert not str(provider).startswith("custom:"), f"got {provider!r}"
        assert base_url == OLLAMA_BASE_URL
    finally:
        _restore(old)


def test_ollama_default_non_default_colon_tagged_model_roundtrip(
    agent_aliases_ollama_to_custom,
):
    """'Every Custom-group model', not only the configured default."""
    old = _set_config(provider="ollama", base_url=OLLAMA_BASE_URL, default="qwen3.8:27b")
    try:
        model, provider, base_url = config.resolve_model_provider(
            config.model_with_provider_context("llama4.2:8b-instruct-q4_K_M", "custom")
        )
        assert model == "llama4.2:8b-instruct-q4_K_M"
        assert not str(provider).startswith("custom:"), f"got {provider!r}"
        assert base_url == OLLAMA_BASE_URL
    finally:
        _restore(old)


# ── Same class through the WebUI's own alias table (no agent needed) ─────


def test_legacy_local_default_colon_tagged_model_roundtrip():
    old = _set_config(provider="local", base_url=OLLAMA_BASE_URL, default="qwen3.8:27b")
    try:
        encoded = config.model_with_provider_context("qwen3.8:27b", "custom")
        assert encoded == "qwen3.8:27b", f"got {encoded!r}"
        model, provider, base_url = config.resolve_model_provider(encoded)
        assert (model, provider, base_url) == ("qwen3.8:27b", "custom", OLLAMA_BASE_URL)
    finally:
        _restore(old)


# ── Negative controls: the qualifier stays where it is still needed ──────


def test_custom_session_under_non_custom_default_keeps_hint():
    """A default that does not alias to custom still needs the explicit hint."""
    old = _set_config(provider="anthropic")
    try:
        encoded = config.model_with_provider_context("qwen3.8", "custom")
        assert encoded == "@custom:qwen3.8", f"got {encoded!r}"
    finally:
        _restore(old)


def test_named_custom_session_under_ollama_default_keeps_hint(
    agent_aliases_ollama_to_custom,
):
    """Only the bare 'custom' lane is the aliased default; a named one is not."""
    old = _set_config(
        provider="ollama",
        base_url=OLLAMA_BASE_URL,
        default="qwen3.8:27b",
        custom_providers=[
            {"name": "lab", "base_url": "http://lab.example:8000/v1", "model": "phi-5"}
        ],
    )
    try:
        encoded = config.model_with_provider_context("phi-5", "custom:lab")
        assert encoded == "@custom:lab:phi-5", f"got {encoded!r}"
    finally:
        _restore(old)
