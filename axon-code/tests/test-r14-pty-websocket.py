#!/usr/bin/env python3
"""Adversarial integration tests for the authenticated loopback PTY WebSocket bridge."""
import asyncio, base64, json, os, sys, tempfile, time
from pathlib import Path
import websockets
from websockets.exceptions import InvalidStatus, ConnectionClosed
ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'http://127.0.0.1:5173'
MAX_FRAME = 64 * 1024

async def launch_bridge():
    temp = tempfile.TemporaryDirectory(prefix='axon-pty-')
    root = Path(temp.name)
    proc = await asyncio.create_subprocess_exec(sys.executable, str(ROOT/'tools/linux-pty-websocket-bridge.py'), cwd=ROOT,
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    config = {'op':'start','origin':ORIGIN,'port':0,'workspaceRoot':str(root),'cwd':str(root),'command':'/bin/bash','args':[],
              'trustedWorkspace':True,'approvalReference':'R14_TEST_APPROVAL'}
    proc.stdin.write((json.dumps(config)+'\n').encode()); await proc.stdin.drain()
    line = await asyncio.wait_for(proc.stdout.readline(), timeout=5)
    ready = json.loads(line)
    assert ready['event'] == 'ready', ready
    uri = f"ws://127.0.0.1:{ready['port']}/session?token={ready['token']}"
    return temp, proc, ready, uri

async def stop(proc, temp):
    if proc.returncode is None:
        proc.stdin.close()
        try: await asyncio.wait_for(proc.wait(), timeout=3)
        except asyncio.TimeoutError: proc.kill(); await proc.wait()
    temp.cleanup()

async def main():
    results=[]
    # Wrong Origin is rejected by the WebSocket handshake origin policy.
    case_start=time.monotonic()
    temp, proc, ready, uri = await launch_bridge()
    try:
        try:
            async with websockets.connect(uri, origin='http://evil.test'):
                raise AssertionError('wrong Origin was accepted')
        except InvalidStatus:
            results.append(('R14-WP00-WS-ORIGIN','PASS','Wrong Origin rejected at handshake',round((time.monotonic()-case_start)*1000,2)))
    finally: await stop(proc,temp)

    # Wrong Host and wrong token are refused without creating a PTY.
    case_start=time.monotonic()
    temp, proc, ready, uri = await launch_bridge()
    try:
        async with websockets.connect(uri, origin=ORIGIN, additional_headers={'Host':'evil.test'}) as ws:
            try: await ws.recv()
            except ConnectionClosed as exc: assert exc.code == 1008
            else: raise AssertionError('wrong Host was accepted')
        results.append(('R14-WP00-WS-HOST','PASS','Wrong Host rejected',round((time.monotonic()-case_start)*1000,2)))
    finally: await stop(proc,temp)

    case_start=time.monotonic()
    temp, proc, ready, uri = await launch_bridge()
    try:
        wrong = uri.replace(ready['token'],'not-the-token')
        async with websockets.connect(wrong, origin=ORIGIN) as ws:
            try: await ws.recv()
            except ConnectionClosed as exc: assert exc.code == 1008
            else: raise AssertionError('wrong token was accepted')
        results.append(('R14-WP00-WS-TOKEN','PASS','Invalid session token rejected',round((time.monotonic()-case_start)*1000,2)))
    finally: await stop(proc,temp)

    # A valid session starts a real PTY and streams shell output.
    case_start=time.monotonic()
    temp, proc, ready, uri = await launch_bridge()
    try:
        assert ready['host']=='127.0.0.1' and ready['tokenUse']=='single-use'
        async with websockets.connect(uri, origin=ORIGIN, max_size=MAX_FRAME) as ws:
            started = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
            assert started['event']=='started' and started['isolation']=='NONE_USER_PROCESS'
            await ws.send(json.dumps({'op':'write','sessionId':started['sessionId'],'dataB64':base64.b64encode(b'echo R14_BRIDGE_OK\n').decode()}))
            seen=False
            for _ in range(10):
                event=json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
                if event.get('event')=='data' and 'R14_BRIDGE_OK' in base64.b64decode(event['dataB64']).decode(errors='replace'):
                    seen=True; break
            assert seen, 'real PTY output was not streamed'
            await ws.send(json.dumps({'op':'terminate','sessionId':started['sessionId']}))
        results.append(('R14-WP00-WS-PTY','PASS','Authenticated bridge streamed output from real Linux PTY',round((time.monotonic()-case_start)*1000,2)))
    finally: await stop(proc,temp)

    # Oversized frames are rejected with WebSocket close code 1009.
    case_start=time.monotonic()
    temp, proc, ready, uri = await launch_bridge()
    try:
        async with websockets.connect(uri, origin=ORIGIN, max_size=None) as ws:
            await ws.send('x'*(MAX_FRAME+1))
            try: await ws.recv()
            except ConnectionClosed as exc: assert exc.code==1009
            else: raise AssertionError('oversized frame was accepted')
        results.append(('R14-WP00-WS-FRAME','PASS','Oversized frame rejected',round((time.monotonic()-case_start)*1000,2)))
    finally: await stop(proc,temp)

    # More than the configured messages per window closes the session.
    case_start=time.monotonic()
    temp, proc, ready, uri = await launch_bridge()
    try:
        async with websockets.connect(uri, origin=ORIGIN) as ws:
            started=json.loads(await asyncio.wait_for(ws.recv(),timeout=5)); sid=started['sessionId']
            for _ in range(61): await ws.send(json.dumps({'op':'resize','sessionId':sid,'cols':100,'rows':30}))
            try:
                while True: await ws.recv()
            except ConnectionClosed as exc: assert exc.code==1008
        results.append(('R14-WP00-WS-RATE','PASS','Message rate limit enforced',round((time.monotonic()-case_start)*1000,2)))
    finally: await stop(proc,temp)

    fingerprint = __import__('hashlib').sha256(f"{os.uname().sysname}|{os.uname().release}|{os.uname().machine}".encode()).hexdigest()[:16]
    rows=[{'id':rid,'suite':'r14-wp00-pty-websocket-security','capability':'hardened-loopback-pty-bridge','status':status,
           'command':'python3 tests/test-r14-pty-websocket.py','exitCode':0,'durationMs':duration,'hostFingerprint':fingerprint,
           'name':name,'negativeTest':rid not in ('R14-WP00-WS-PTY',),'mutantCaught':False,'grade':'T1'} for rid,status,name,duration in results]
    out=ROOT/'results'/'r14-wp00-websocket-tests.json'; out.write_text(json.dumps(rows,indent=2)+'\n')
    print(json.dumps(rows,indent=2))
    return 0 if len(rows)==6 and all(row['status']=='PASS' for row in rows) else 1

if __name__=='__main__': raise SystemExit(asyncio.run(main()))
