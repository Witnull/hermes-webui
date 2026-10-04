"""Same-process persistence authority for one WebUI store/session lifetime.

This guards WebUI-owned files, not external Agent state.db or tool effects.
Handles survive cache eviction and worker teardown; revocation is irreversible
for a captured handle. Only explicit new/import admission starts a new lifetime.
"""

from __future__ import annotations

import json
import threading
import weakref
from contextlib import contextmanager
from pathlib import Path


class SessionPersistenceRevoked(RuntimeError):
    """A deleted or replaced session lifetime may no longer write files."""


class _Lifetime:
    def __init__(self, revoked=False):
        self.revoked = revoked


class _GateLock:
    """Read-write lock: multiple writers can persist in parallel, deletion is exclusive."""

    def __init__(self):
        self._mutex = threading.Lock()
        self._cond = threading.Condition(self._mutex)
        self._writer_active = False
        self._writer_thread = None
        self._writer_depth = 0
        self._active_readers = 0

    def acquire(self, blocking=True, timeout=-1):
        import time
        ident = threading.get_ident()
        deadline = None if timeout is None or timeout < 0 else time.monotonic() + timeout
        with self._mutex:
            if self._writer_active and self._writer_thread == ident:
                self._writer_depth += 1
                return True
            while self._writer_active or self._active_readers > 0:
                if not blocking:
                    return False
                if deadline is not None:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        return False
                    self._cond.wait(timeout=remaining)
                else:
                    self._cond.wait()
            self._writer_active = True
            self._writer_thread = ident
            self._writer_depth = 1
            return True

    def release(self):
        with self._mutex:
            if not self._writer_active or self._writer_thread != threading.get_ident():
                raise RuntimeError("Cannot release unheld gate lock")
            self._writer_depth -= 1
            if self._writer_depth == 0:
                self._writer_active = False
                self._writer_thread = None
                self._cond.notify_all()

    def __enter__(self):
        self.acquire()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.release()

    @contextmanager
    def shared(self):
        ident = threading.get_ident()
        with self._mutex:
            while self._writer_active:
                if self._writer_thread == ident:
                    break
                self._cond.wait()
            self._active_readers += 1
        try:
            yield
        finally:
            with self._mutex:
                self._active_readers -= 1
                if self._active_readers == 0:
                    self._cond.notify_all()


class _Gate:
    def __init__(self, root, sid):
        self.root = root
        self.sid = sid
        self.lock = _GateLock()
        self.current = _Lifetime(_deleted_on_disk(root, sid))


def _deleted_on_disk(root, sid):
    path = root / "_deleted_webui_sessions.json"
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return False
    # A corrupt/unreadable deletion record is unknown, never write permission.
    if (
        not isinstance(raw, dict)
        or type(raw.get("version")) is not int
        or raw["version"] != 1
    ):
        raise RuntimeError("Unrecognized deleted-session record")
    ids = raw.get("ids")
    if not isinstance(ids, list) or not all(isinstance(x, str) for x in ids):
        raise RuntimeError("Malformed deleted-session record")
    return sid in ids


_GATES = weakref.WeakValueDictionary()
_GATES_LOCK = threading.Lock()


def session_persistence_gate(session_id, session_dir):
    sid = str(session_id or "").strip()
    if not sid or sid in (".", "..") or "/" in sid or "\\" in sid:
        raise ValueError("Invalid session persistence identity")
    root = Path(session_dir).resolve()
    key = (str(root), sid)
    with _GATES_LOCK:
        gate = _GATES.get(key)
        if gate is None:
            gate = _Gate(root, sid)
            _GATES[key] = gate
        return gate


class SessionPersistenceHandle:
    def __init__(self, session_id, session_dir):
        self.gate = session_persistence_gate(session_id, session_dir)
        self.lifetime = self.gate.current

    def matches(self, session_id, session_dir):
        return (
            self.gate.sid == str(session_id).strip()
            and self.gate.root == Path(session_dir).resolve()
        )

    def __deepcopy__(self, memo):
        # A copied Session is still a handle to the same lifetime.
        return self

    @property
    def valid(self):
        return self.lifetime is self.gate.current and not self.lifetime.revoked

    @contextmanager
    def writing(self):
        with self.gate.lock.shared():
            if not self.valid:
                raise SessionPersistenceRevoked(
                    f"Session {self.gate.sid!r} persistence authority was revoked"
                )
            yield


def revoke_session_persistence(gate):
    """Caller holds gate.lock through revocation and physical deletion."""
    gate.current.revoked = True


def reopen_session_persistence(gate):
    """Explicit import only; never revive a handle held by an old worker."""
    gate.current.revoked = True
    gate.current = _Lifetime()
