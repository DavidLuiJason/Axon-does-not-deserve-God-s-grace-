#!/usr/bin/env python3
"""Experimental Linux PTY provider for AXON Code.

Protocol: newline-delimited JSON on stdin/stdout. Each created session is a real
POSIX pseudo-terminal. This is NOT a sandbox: processes run as the current user.
Only start it for a user-trusted workspace after the host application has obtained
explicit execution approval. Do not expose this helper as an unauthenticated service.
"""
from __future__ import annotations
import base64
import errno
import fcntl
import json
import os
import pty
import selectors
import signal
import struct
import sys
import termios
import time
import uuid
import subprocess
from pathlib import Path

MAX_SESSIONS = 4
MAX_INPUT_BYTES = 64 * 1024
MAX_OUTPUT_BYTES = 2 * 1024 * 1024
MAX_ARGUMENTS = 64
MAX_ARG_BYTES = 16 * 1024
MAX_SESSION_SECONDS = 30 * 60
ALLOWED_EXECUTABLES = {"/bin/sh", "/bin/bash"}


def exit_status(process):
    """Exit status of a child whose PTY just closed. The kernel can close the PTY a moment before the child is reapable, so a bare poll() may say None; wait briefly (Director fix, Round 14 verification)."""
    code = process.poll()
    if code is None:
        try:
            code = process.wait(timeout=2)
        except Exception:
            code = process.poll()
    return code


def emit(event: str, **fields: object) -> None:
    sys.stdout.write(json.dumps({"event": event, **fields}, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def validate_create(message: dict) -> tuple[str, list[str], str, int, int, dict[str, str]]:
    if message.get("trustedWorkspace") is not True or not isinstance(message.get("approvalReference"), str) or not message["approvalReference"].strip():
        raise ValueError("PTY launch requires an explicitly trusted workspace and approval reference.")
    command = message.get("command")
    args = message.get("args", [])
    root = message.get("workspaceRoot")
    cwd = message.get("cwd", root)
    if command not in ALLOWED_EXECUTABLES:
        raise ValueError("Executable is not in the provider's reviewed shell allow-list.")
    if not isinstance(args, list) or len(args) > MAX_ARGUMENTS or any(not isinstance(arg, str) or "\x00" in arg for arg in args):
        raise ValueError("PTY argument array is malformed or exceeds its limit.")
    if sum(len(arg.encode("utf-8")) for arg in args) > MAX_ARG_BYTES:
        raise ValueError("PTY arguments exceed the aggregate size limit.")
    if not isinstance(root, str) or not isinstance(cwd, str):
        raise ValueError("Workspace root and working directory are required.")
    canonical_root = os.path.realpath(root)
    canonical_cwd = os.path.realpath(cwd)
    if not os.path.isdir(canonical_root) or not os.path.isdir(canonical_cwd):
        raise ValueError("Workspace root or working directory does not exist.")
    try:
        if os.path.commonpath([canonical_root, canonical_cwd]) != canonical_root:
            raise ValueError("Working directory is outside the approved workspace root.")
    except ValueError:
        raise ValueError("Working directory is outside the approved workspace root.")
    cols = message.get("cols", 100)
    rows = message.get("rows", 30)
    if not isinstance(cols, int) or not isinstance(rows, int) or not (20 <= cols <= 400 and 5 <= rows <= 200):
        raise ValueError("Terminal dimensions are outside supported bounds.")
    requested_env = message.get("env", {})
    if not isinstance(requested_env, dict) or len(requested_env) > 32:
        raise ValueError("Terminal environment is malformed.")
    env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": os.path.expanduser("~"), "TERM": "xterm-256color", "LANG": "C.UTF-8"}
    for key, value in requested_env.items():
        if key not in {"LANG", "TERM", "COLORTERM", "EDITOR"} or not isinstance(value, str) or len(value) > 256 or "\x00" in value:
            raise ValueError(f"Environment variable '{key}' is not permitted.")
        env[key] = value
    return command, args, canonical_cwd, cols, rows, env


def run() -> int:
    selector = selectors.DefaultSelector()
    selector.register(sys.stdin, selectors.EVENT_READ, ("stdin", None))
    sessions: dict[str, dict] = {}
    stdin_open = True

    def close_session(session_id: str, status: str = "terminated") -> None:
        session = sessions.pop(session_id, None)
        if not session:
            return
        try:
            selector.unregister(session["master"])
        except Exception:
            pass
        try:
            os.close(session["master"])
        except OSError:
            pass
        process = session["process"]
        if process.poll() is None:
            # Ask the process group to stop, then reap it.  Returning poll()
            # immediately after SIGKILL used to expose exitCode=null while the
            # child was still being reaped.
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                process.wait(timeout=1.0)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.wait(timeout=1.0)
        return_code = process.poll()
        exit_code = return_code if return_code is not None and return_code >= 0 else None
        signal_number = -return_code if return_code is not None and return_code < 0 else None
        emit("closed", sessionId=session_id, status=status, exitCode=exit_code, signal=signal_number)

    def on_message(message: object) -> None:
        if not isinstance(message, dict) or not isinstance(message.get("op"), str):
            emit("error", code="INVALID_REQUEST", message="Request must be an object with an operation.")
            return
        op = message["op"]
        if op == "create":
            session_id = str(message.get("sessionId") or uuid.uuid4().hex)
            if session_id in sessions:
                emit("error", sessionId=session_id, code="DUPLICATE_SESSION", message="Session ID already exists.")
                return
            if len(sessions) >= MAX_SESSIONS:
                emit("error", sessionId=session_id, code="SESSION_LIMIT", message=f"At most {MAX_SESSIONS} PTY sessions are allowed.")
                return
            try:
                command, args, cwd, cols, rows, env = validate_create(message)
                master, slave = pty.openpty()
                fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
                process = subprocess.Popen([command, *args], stdin=slave, stdout=slave, stderr=slave, cwd=cwd, env=env,
                                           close_fds=True, start_new_session=True)
                os.close(slave)
                os.set_blocking(master, False)
                session = {"master": master, "process": process, "started": time.monotonic(), "outputBytes": 0, "lastActivity": time.monotonic()}
                sessions[session_id] = session
                selector.register(master, selectors.EVENT_READ, ("pty", session_id))
                emit("started", sessionId=session_id, pid=process.pid, cols=cols, rows=rows, provider="linux-posix-pty-v1", isolation="NONE_USER_PROCESS")
            except Exception as exc:
                emit("error", sessionId=session_id, code="PTY_CREATE_FAILED", message=str(exc)[:1000])
            return
        session_id = message.get("sessionId")
        session = sessions.get(session_id) if isinstance(session_id, str) else None
        if not session:
            emit("error", sessionId=session_id, code="SESSION_NOT_FOUND", message="PTY session does not exist.")
            return
        if op == "write":
            encoded = message.get("dataB64")
            try:
                data = base64.b64decode(encoded, validate=True)
                if not data or len(data) > MAX_INPUT_BYTES:
                    raise ValueError("Input is empty or exceeds the session input limit.")
                os.write(session["master"], data)
                session["lastActivity"] = time.monotonic()
            except Exception as exc:
                emit("error", sessionId=session_id, code="PTY_WRITE_FAILED", message=str(exc)[:500])
        elif op == "resize":
            cols, rows = message.get("cols"), message.get("rows")
            if not isinstance(cols, int) or not isinstance(rows, int) or not (20 <= cols <= 400 and 5 <= rows <= 200):
                emit("error", sessionId=session_id, code="INVALID_RESIZE", message="Terminal dimensions are outside supported bounds.")
                return
            try:
                fcntl.ioctl(session["master"], termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
                emit("resized", sessionId=session_id, cols=cols, rows=rows)
            except OSError as exc:
                emit("error", sessionId=session_id, code="PTY_RESIZE_FAILED", message=str(exc))
        elif op == "terminate":
            close_session(session_id)
        else:
            emit("error", sessionId=session_id, code="UNKNOWN_OPERATION", message="Operation is not supported.")

    while stdin_open or sessions:
        for key, _ in selector.select(timeout=0.1):
            kind, session_id = key.data
            if kind == "stdin":
                line = sys.stdin.readline()
                if not line:
                    stdin_open = False
                    try: selector.unregister(sys.stdin)
                    except Exception: pass
                    for active_id in list(sessions): close_session(active_id, "provider_stdin_closed")
                    break
                if len(line.encode("utf-8")) > 100_000:
                    emit("error", code="REQUEST_TOO_LARGE", message="Control message exceeds 100 KB.")
                    continue
                try: on_message(json.loads(line))
                except json.JSONDecodeError: emit("error", code="INVALID_JSON", message="Control input is not valid JSON.")
            elif kind == "pty" and isinstance(session_id, str):
                session = sessions.get(session_id)
                if not session: continue
                try:
                    chunk = os.read(session["master"], 8192)
                    if chunk:
                        session["outputBytes"] += len(chunk)
                        session["lastActivity"] = time.monotonic()
                        if session["outputBytes"] > MAX_OUTPUT_BYTES:
                            close_session(session_id, "output_limit_exceeded")
                            emit("error", sessionId=session_id, code="OUTPUT_LIMIT", message="PTY output exceeded 2 MiB; the process was terminated.")
                        else:
                            emit("data", sessionId=session_id, dataB64=base64.b64encode(chunk).decode("ascii"))
                    else:
                        code = exit_status(session["process"])
                        close_session(session_id, "process_exited")
                        emit("exit", sessionId=session_id, exitCode=code if code is not None and code >= 0 else None,
                             signal=(-code if code is not None and code < 0 else None))
                except OSError as exc:
                    if exc.errno in (errno.EIO, errno.EBADF):
                        code = exit_status(session["process"])
                        close_session(session_id, "process_exited")
                        emit("exit", sessionId=session_id, exitCode=code if code is not None and code >= 0 else None,
                             signal=(-code if code is not None and code < 0 else None))
                    else:
                        close_session(session_id, "pty_read_failed")
                        emit("error", sessionId=session_id, code="PTY_READ_FAILED", message=str(exc))
        now = time.monotonic()
        for session_id, session in list(sessions.items()):
            code = session["process"].poll()
            if code is not None:
                close_session(session_id, "process_exited")
                emit("exit", sessionId=session_id, exitCode=code if code >= 0 else None,
                     signal=(-code if code < 0 else None))
            elif now - session["started"] > MAX_SESSION_SECONDS:
                close_session(session_id, "maximum_session_time")
                emit("error", sessionId=session_id, code="SESSION_TIMEOUT", message="PTY session exceeded 30 minutes.")
    selector.close()
    return 0


if __name__ == "__main__":
    if "--help" in sys.argv:
        print("AXON Code Linux POSIX PTY provider (experimental)\n\nUsage: python3 tools/linux-pty-provider.py\nProtocol: JSON lines on stdin/stdout. Requires Linux/POSIX, Python stdlib pty support.\nSecurity: NOT A SANDBOX. Runs approved shell processes as the current user.")
        raise SystemExit(0)
    raise SystemExit(run())
