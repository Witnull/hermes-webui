"""
============================================================================
Hermes WebUI Custom - Dedicated Custom Routes Bridge
File: api/custom_routes.py
============================================================================
Houses custom endpoints (/api/config/raw, /api/logs/clear, log file listing)
in isolation so that core api/routes.py only requires minimal 1-line bridges,
guaranteeing future upstream merges remain completely conflict-free.
============================================================================
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from urllib.parse import parse_qs

logger = logging.getLogger("hermes-webui.custom_routes")

_LOG_FILE_WHITELIST = {
    "agent": "agent.log",
    "errors": "errors.log",
    "gateway": "gateway.log",
    "gui": "gui.log",
    "crash": "crash.log",
}


def _active_profile_config_path() -> Path:
    """Return the authoritative config.yaml path for the active profile."""
    try:
        from api.profiles import get_active_hermes_home
        home = Path(get_active_hermes_home()).expanduser()
    except Exception:
        home = Path(os.environ.get("HERMES_HOME") or (Path.home() / ".hermes")).expanduser()

    override = os.environ.get("HERMES_CONFIG_PATH")
    if override:
        p = Path(override).expanduser()
        if p.exists() and p.is_file():
            return p
    return home / "config.yaml"


def _reload_cfg() -> None:
    """Reload in-memory configurations across CLI and WebUI layers."""
    try:
        from api.config import reload_config
        reload_config()
    except Exception:
        pass
    try:
        from hermes_cli.config import reload as _cli_reload
        _cli_reload()
    except Exception:
        pass


def get_custom_plugin_enabled_flag(plugin_key: str, name: str, default: bool) -> bool:
    """Check dashboard_plugins settings override for plugin enabled flag."""
    try:
        from api.routes import load_settings
        dash_prefs = (load_settings() or {}).get("dashboard_plugins", {})
        if plugin_key in dash_prefs:
            return bool(dash_prefs[plugin_key])
        if name in dash_prefs:
            return bool(dash_prefs[name])
    except Exception:
        pass
    return default


def handle_logs_clear(handler, parsed, body: dict | None = None) -> bool:
    """Clear (truncate) one or all active-profile Hermes log files."""
    query = parse_qs(parsed.query or "")
    file_key = ((body and body.get("file")) or query.get("file", ["agent"])[0] or "agent").strip().lower()

    try:
        from api.profiles import get_active_hermes_home
        hermes_home = Path(get_active_hermes_home()).expanduser()
    except Exception:
        hermes_home = Path(os.environ.get("HERMES_HOME") or (Path.home() / ".hermes")).expanduser()
    log_dir = hermes_home / "logs"
    if not log_dir.exists():
        from api.routes import j
        return j(handler, {"ok": True, "cleared": file_key, "files": []})

    cleared_files = []
    from api.routes import j, bad

    if file_key == "all":
        for p in log_dir.glob("*.log*"):
            if p.is_file() and not p.name.startswith("."):
                try:
                    with p.open("r+", encoding="utf-8", errors="ignore") as f:
                        f.truncate(0)
                    cleared_files.append(p.name)
                except Exception:
                    try:
                        p.write_text("", encoding="utf-8")
                        cleared_files.append(p.name)
                    except Exception:
                        pass
        return j(handler, {"ok": True, "cleared": "all", "files": cleared_files})

    filename = _LOG_FILE_WHITELIST.get(file_key, f"{file_key}.log" if file_key.replace("_", "").isalnum() else None)
    if not filename:
        return bad(handler, "Unknown log file", status=400)

    log_path = log_dir / filename
    if log_path.exists() and log_path.is_file():
        try:
            with log_path.open("r+", encoding="utf-8", errors="ignore") as f:
                f.truncate(0)
            cleared_files.append(filename)
        except Exception:
            try:
                log_path.write_text("", encoding="utf-8")
                cleared_files.append(filename)
            except Exception as exc:
                return bad(handler, f"Failed to clear log: {exc}", status=500)

    # Also truncate rotated .log.1 copy if present
    rot = log_dir / f"{filename}.1"
    if rot.exists() and rot.is_file():
        try:
            with rot.open("r+", encoding="utf-8", errors="ignore") as f:
                f.truncate(0)
            cleared_files.append(rot.name)
        except Exception:
            pass

    return j(handler, {"ok": True, "cleared": file_key, "files": cleared_files})


def handle_custom_get(handler, parsed) -> bool:
    """Handle custom GET endpoints."""
    path = parsed.path
    from api.routes import j, bad

    if path == "/api/config/raw":
        cfg = _active_profile_config_path()
        content = cfg.read_text(encoding="utf-8") if cfg.exists() else ""
        return j(handler, {"yaml": content, "path": str(cfg)})

    if path == "/api/logs":
        query = parse_qs(parsed.query or "")
        if query.get("action", [""])[0] == "list":
            try:
                from api.profiles import get_active_hermes_home
                hermes_home = Path(get_active_hermes_home()).expanduser()
            except Exception:
                hermes_home = Path(os.environ.get("HERMES_HOME") or (Path.home() / ".hermes")).expanduser()
            log_dir = hermes_home / "logs"
            available = []
            if log_dir.exists():
                for key, fname in _LOG_FILE_WHITELIST.items():
                    p = log_dir / fname
                    available.append({
                        "key": key,
                        "filename": fname,
                        "exists": p.exists(),
                        "size": p.stat().st_size if p.exists() else 0
                    })
            return j(handler, {"files": available})

    return False


def handle_custom_post(handler, parsed, body: dict) -> bool:
    """Handle custom POST endpoints."""
    path = parsed.path
    from api.routes import j

    if path == "/api/config/raw":
        cfg = _active_profile_config_path()
        cfg.write_text(body.get("yaml_text", ""), encoding="utf-8")
        _reload_cfg()
        return j(handler, {"ok": True, "path": str(cfg)})

    if path == "/api/logs/clear":
        return handle_logs_clear(handler, parsed, body)

    return False


def handle_custom_put(handler, parsed, body: dict) -> bool:
    """Handle custom PUT endpoints."""
    path = parsed.path
    from api.routes import j

    if path == "/api/config/raw":
        cfg = _active_profile_config_path()
        cfg.write_text(body.get("yaml_text", ""), encoding="utf-8")
        _reload_cfg()
        return j(handler, {"ok": True, "path": str(cfg)})

    return False


def handle_custom_delete(handler, parsed, body: dict) -> bool:
    """Handle custom DELETE endpoints."""
    path = parsed.path

    if path == "/api/logs":
        return handle_logs_clear(handler, parsed, body)

    return False
