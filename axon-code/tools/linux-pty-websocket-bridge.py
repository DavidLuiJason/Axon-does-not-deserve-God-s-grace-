#!/usr/bin/env python3
"""Loopback-only authenticated WebSocket bridge for the Linux PTY provider.

The trusted host sends one JSON config line on stdin. The bridge generates a
single-use random token and prints its local endpoint/token to stdout. This
helper is NOT an OS sandbox; the PTY child runs as the current OS user.
"""
from __future__ import annotations
import asyncio, base64, hmac, ipaddress, json, os, secrets, sys, time
from collections import deque
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

MAX_FRAME_BYTES = 64 * 1024
MAX_MESSAGES_PER_WINDOW = 60
RATE_WINDOW_SECONDS = 10
MAX_PROVIDER_LINE_BYTES = 100_000


def safe_env() -> dict[str, str]:
    allowed = ('PATH', 'HOME', 'LANG', 'TMPDIR', 'LC_ALL')
    return {key: os.environ[key] for key in allowed if key in os.environ}


def read_config() -> dict:
    line = sys.stdin.readline(MAX_FRAME_BYTES + 1)
    if not line or len(line.encode('utf-8')) > MAX_FRAME_BYTES:
        raise ValueError('Bridge startup configuration is missing or oversized.')
    config = json.loads(line)
    if not isinstance(config, dict) or config.get('op') != 'start':
        raise ValueError('Bridge startup configuration is invalid.')
    origin = config.get('origin')
    parsed = urlsplit(origin) if isinstance(origin, str) else None
    if not parsed or parsed.scheme not in ('http', 'https') or parsed.hostname not in ('127.0.0.1', 'localhost') or not parsed.netloc:
        raise ValueError('The configured Origin must be an explicit loopback HTTP(S) origin.')
    if config.get('trustedWorkspace') is not True or not isinstance(config.get('approvalReference'), str) or not config['approvalReference'].strip():
        raise ValueError('PTY launch requires a trusted workspace and explicit approval reference.')
    root = config.get('workspaceRoot'); cwd = config.get('cwd', root)
    if not isinstance(root, str) or not isinstance(cwd, str): raise ValueError('Workspace root and cwd are required.')
    root_path = Path(root).resolve(); cwd_path = Path(cwd).resolve()
    if not root_path.is_dir() or not cwd_path.is_dir() or root_path not in (cwd_path, *cwd_path.parents):
        raise ValueError('PTY cwd must be an existing directory inside the approved workspace root.')
    command = config.get('command', '/bin/bash')
    if command not in ('/bin/sh', '/bin/bash'): raise ValueError('PTY executable is not in the reviewed allow-list.')
    args = config.get('args', [])
    if not isinstance(args, list) or len(args) > 64 or any(not isinstance(x, str) or '\x00' in x for x in args):
        raise ValueError('PTY arguments are malformed or oversized.')
    return {**config, 'origin': origin, 'workspaceRoot': str(root_path), 'cwd': str(cwd_path), 'command': command, 'args': args}


async def run() -> int:
    try:
        from websockets.asyncio.server import serve
    except Exception as exc:
        print(json.dumps({'event':'blocked','reason':f'Pinned websockets dependency is unavailable: {exc}'}), flush=True)
        return 2
    try:
        config = read_config()
    except Exception as exc:
        print(json.dumps({'event':'blocked','reason':str(exc)}), flush=True)
        return 2

    token = secrets.token_urlsafe(32)
    connected = False
    provider = None
    provider_task = None
    port_requested = config.get('port', 0)
    if not isinstance(port_requested, int) or not (0 <= port_requested <= 65535):
        print(json.dumps({'event':'blocked','reason':'Requested port is invalid.'}), flush=True); return 2

    async def handler(websocket):
        nonlocal connected, provider, provider_task
        peer = websocket.remote_address
        try:
            if not peer or not ipaddress.ip_address(peer[0]).is_loopback:
                await websocket.close(code=1008, reason='Loopback clients only'); return
        except Exception:
            await websocket.close(code=1008, reason='Invalid peer address'); return
        request = websocket.request
        headers = request.headers
        expected_host = f'127.0.0.1:{port_actual}'
        allowed_hosts = {expected_host, f'localhost:{port_actual}'}
        host_values = headers.get_all('Host')
        origin_values = headers.get_all('Origin')
        if len(host_values) != 1 or host_values[0] not in allowed_hosts:
            await websocket.close(code=1008, reason='Host header rejected'); return
        if len(origin_values) != 1 or origin_values[0] != config['origin']:
            await websocket.close(code=1008, reason='Origin rejected'); return
        parsed_path = urlsplit(request.path)
        supplied = parse_qs(parsed_path.query).get('token', [''])[0]
        if parsed_path.path != '/session' or not hmac.compare_digest(supplied, token):
            await websocket.close(code=1008, reason='Session token rejected'); return
        if connected:
            await websocket.close(code=1008, reason='Session token already used'); return
        connected = True
        provider = await asyncio.create_subprocess_exec(
            sys.executable, str(Path(__file__).with_name('linux-pty-provider.py')),
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
            env=safe_env(), cwd=config['workspaceRoot'])
        create = {'op':'create','trustedWorkspace':True,'approvalReference':config['approvalReference'],
                  'workspaceRoot':config['workspaceRoot'],'cwd':config['cwd'],'command':config['command'],
                  'args':config['args'],'cols':config.get('cols',100),'rows':config.get('rows',30),'env':config.get('env',{})}
        provider.stdin.write((json.dumps(create,separators=(',',':'))+'\n').encode()); await provider.stdin.drain()
        rate = deque()
        async def forward_output():
            while True:
                line = await provider.stdout.readline()
                if not line: break
                if len(line) > MAX_PROVIDER_LINE_BYTES: await websocket.close(code=1011, reason='PTY provider output exceeded limit'); break
                try: await websocket.send(line.decode('utf-8').rstrip('\n'))
                except Exception: break
        provider_task = asyncio.create_task(forward_output())
        try:
            async for frame in websocket:
                now = time.monotonic()
                while rate and now-rate[0] > RATE_WINDOW_SECONDS: rate.popleft()
                rate.append(now)
                if len(rate) > MAX_MESSAGES_PER_WINDOW:
                    await websocket.close(code=1008, reason='Message rate limit exceeded'); break
                if isinstance(frame, bytes):
                    if len(frame) > MAX_FRAME_BYTES: await websocket.close(code=1009, reason='Frame too large'); break
                    frame = frame.decode('utf-8')
                if len(frame.encode('utf-8')) > MAX_FRAME_BYTES:
                    await websocket.close(code=1009, reason='Frame too large'); break
                try: message = json.loads(frame)
                except Exception:
                    await websocket.close(code=1007, reason='Invalid JSON'); break
                if not isinstance(message, dict) or message.get('op') not in ('write','resize','terminate'):
                    await websocket.close(code=1008, reason='Unsupported PTY operation'); break
                if message.get('op') == 'write':
                    raw = message.get('dataB64')
                    if not isinstance(raw,str) or len(raw) > MAX_FRAME_BYTES: await websocket.close(code=1009, reason='Input too large'); break
                    try: decoded = base64.b64decode(raw, validate=True)
                    except Exception: await websocket.close(code=1007, reason='Invalid base64 input'); break
                    if not decoded or len(decoded) > MAX_FRAME_BYTES: await websocket.close(code=1009, reason='Input too large'); break
                provider.stdin.write((json.dumps(message,separators=(',',':'))+'\n').encode()); await provider.stdin.drain()
                if message.get('op') == 'terminate': break
        finally:
            if provider and provider.returncode is None:
                provider.stdin.close()
                try: await asyncio.wait_for(provider.wait(), timeout=2)
                except asyncio.TimeoutError: provider.kill(); await provider.wait()
            if provider_task:
                provider_task.cancel()

    async with serve(handler, '127.0.0.1', port_requested, origins=[config['origin']], compression=None,
                     max_size=MAX_FRAME_BYTES, max_queue=8, write_limit=MAX_FRAME_BYTES,
                     open_timeout=5, ping_interval=20, ping_timeout=10, close_timeout=2,
                     server_header=None) as server:
        port_actual = server.sockets[0].getsockname()[1]
        print(json.dumps({'event':'ready','host':'127.0.0.1','port':port_actual,'path':'/session',
                          'token':token,'tokenUse':'single-use','maxFrameBytes':MAX_FRAME_BYTES,
                          'rateLimit':{'messages':MAX_MESSAGES_PER_WINDOW,'windowSeconds':RATE_WINDOW_SECONDS},
                          'isolation':'NONE_USER_PROCESS'}), flush=True)
        while not connected:
            await asyncio.sleep(0.05)
        while provider and provider.returncode is None:
            await asyncio.sleep(0.05)
    return 0

if __name__ == '__main__':
    try: raise SystemExit(asyncio.run(run()))
    except KeyboardInterrupt: raise SystemExit(130)
