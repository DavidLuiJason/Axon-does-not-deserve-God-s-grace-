#!/usr/bin/env python3
from __future__ import annotations
import base64, json, os, selectors, subprocess, sys, tempfile, time, signal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROVIDER = ROOT / 'tools' / 'linux-pty-provider.py'


def test_real_pty() -> tuple[bool, dict]:
    with tempfile.TemporaryDirectory(prefix='axon-r12-pty-') as tmp:
        process = subprocess.Popen([sys.executable, str(PROVIDER)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=False, bufsize=0)
        selector = selectors.DefaultSelector(); selector.register(process.stdout, selectors.EVENT_READ)
        seen = []; pending = bytearray()
        def send(payload):
            process.stdin.write((json.dumps(payload) + '\n').encode()); process.stdin.flush()
        def read(timeout=3):
            nonlocal pending
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                if b'\n' in pending:
                    line, _, rest = pending.partition(b'\n'); pending = bytearray(rest)
                    row = json.loads(line); seen.append(row); return row
                if not selector.select(max(0, deadline - time.monotonic())): return None
                chunk = os.read(process.stdout.fileno(), 65536)
                if not chunk: return None
                pending.extend(chunk)
            return None
        try:
            send({'op':'create','sessionId':'r12-pty-1','command':'/bin/bash','args':['--noprofile','--norc','-i'],
                  'workspaceRoot':tmp,'cwd':tmp,'trustedWorkspace':True,'approvalReference':'owner-approved-test','cols':90,'rows':28})
            started = None
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                row = read(0.5)
                if row and row.get('event') == 'started': started = row; break
            if not started: return False, {'events':seen,'reason':'PTY process did not start'}
            output = ''
            send({'op':'resize','sessionId':'r12-pty-1','cols':110,'rows':35})
            resize = None
            deadline = time.monotonic() + 3
            while time.monotonic() < deadline and resize is None:
                row = read(0.5)
                if not row: continue
                if row.get('event') == 'data' and row.get('sessionId') == 'r12-pty-1':
                    output += base64.b64decode(row['dataB64']).decode(errors='replace')
                elif row.get('event') == 'resized':
                    resize = row
            command = "printf 'AXON_R12_PTY_INTERACTIVE_OK\\n'; pwd; exit\n"
            send({'op':'write','sessionId':'r12-pty-1','dataB64':base64.b64encode(command.encode()).decode()})
            exit_row = None
            deadline = time.monotonic() + 8
            while time.monotonic() < deadline:
                row = read(0.5)
                if not row: continue
                if row.get('event') == 'data' and row.get('sessionId') == 'r12-pty-1':
                    output += base64.b64decode(row['dataB64']).decode(errors='replace')
                elif row.get('event') == 'exit':
                    exit_row = row; break
            okay = started.get('provider') == 'linux-posix-pty-v1' and resize and resize.get('event') == 'resized' and 'AXON_R12_PTY_INTERACTIVE_OK' in output and exit_row is not None and exit_row.get('exitCode') == 0
            return okay, {'started':started,'resize':resize,'exit':exit_row,'output':output[-2000:],'events':seen}
        finally:
            try: process.stdin.close()
            except Exception: pass
            try: process.terminate(); process.wait(timeout=2)
            except Exception: process.kill(); process.wait(timeout=2)
            selector.close()


def test_trust_gate_and_path_boundary() -> tuple[bool, dict]:
    with tempfile.TemporaryDirectory(prefix='axon-r12-pty-sec-') as tmp, tempfile.TemporaryDirectory(prefix='axon-r12-outside-') as outside:
        process = subprocess.Popen([sys.executable, str(PROVIDER)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=False, bufsize=0)
        selector = selectors.DefaultSelector(); selector.register(process.stdout, selectors.EVENT_READ)
        pending = bytearray()
        try:
            def send(payload): process.stdin.write((json.dumps(payload)+'\n').encode()); process.stdin.flush()
            def read():
                nonlocal pending
                deadline = time.monotonic() + 6
                while time.monotonic() < deadline:
                    if b'\n' in pending:
                        line, _, rest = pending.partition(b'\n'); pending = bytearray(rest); return json.loads(line)
                    if not selector.select(max(0, deadline-time.monotonic())): return None
                    chunk = os.read(process.stdout.fileno(), 65536)
                    if not chunk: return None
                    pending.extend(chunk)
                return None
            send({'op':'create','sessionId':'untrusted','command':'/bin/sh','args':['-i'],'workspaceRoot':tmp,'cwd':tmp,'trustedWorkspace':False,'approvalReference':''})
            untrusted=read()
            send({'op':'create','sessionId':'outside','command':'/bin/sh','args':['-i'],'workspaceRoot':tmp,'cwd':outside,'trustedWorkspace':True,'approvalReference':'approval'})
            outside_result=read()
            okay=untrusted and untrusted.get('event')=='error' and untrusted.get('code')=='PTY_CREATE_FAILED' and outside_result and outside_result.get('event')=='error'
            return bool(okay), {'untrusted':untrusted,'outsideWorkspace':outside_result}
        finally:
            process.terminate(); process.wait(timeout=2); selector.close()


def test_signal_exit_reporting() -> tuple[bool, dict]:
    with tempfile.TemporaryDirectory(prefix='axon-r14-pty-signal-') as tmp:
        process = subprocess.Popen([sys.executable, str(PROVIDER)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=False, bufsize=0)
        selector = selectors.DefaultSelector(); selector.register(process.stdout, selectors.EVENT_READ)
        pending = bytearray(); events = []
        def send(payload):
            process.stdin.write((json.dumps(payload) + '\n').encode()); process.stdin.flush()
        def read(timeout=4):
            nonlocal pending
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                if b'\n' in pending:
                    line, _, rest = pending.partition(b'\n'); pending = bytearray(rest)
                    row = json.loads(line); events.append(row); return row
                if not selector.select(max(0, deadline-time.monotonic())): return None
                chunk = os.read(process.stdout.fileno(), 65536)
                if not chunk: return None
                pending.extend(chunk)
            return None
        try:
            send({'op':'create','sessionId':'signal-session','command':'/bin/bash','args':['--noprofile','--norc','-c','kill -TERM $$'],
                  'workspaceRoot':tmp,'cwd':tmp,'trustedWorkspace':True,'approvalReference':'owner-approved-signal-test'})
            deadline=time.monotonic()+6; exit_row=None
            while time.monotonic()<deadline:
                row=read(0.5)
                if row and row.get('event')=='exit':
                    exit_row=row; break
            okay=exit_row is not None and exit_row.get('exitCode') is None and exit_row.get('signal') == signal.SIGTERM
            return bool(okay), {'exit':exit_row,'events':events}
        finally:
            try: process.stdin.close()
            except Exception: pass
            try: process.terminate(); process.wait(timeout=2)
            except Exception: process.kill(); process.wait(timeout=2)
            selector.close()


def test_host_environment_secret_is_not_inherited() -> tuple[bool, dict]:
    with tempfile.TemporaryDirectory(prefix='axon-r14-pty-env-') as tmp:
        env = os.environ.copy()
        env['AXON_R14_TEST_HOST_SECRET'] = 'MUST_NOT_REACH_SHELL'
        process = subprocess.Popen([sys.executable, str(PROVIDER)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   text=False, bufsize=0, env=env)
        selector = selectors.DefaultSelector(); selector.register(process.stdout, selectors.EVENT_READ)
        pending = bytearray(); output = ''
        def send(payload):
            process.stdin.write((json.dumps(payload) + '\n').encode()); process.stdin.flush()
        def read(timeout=4):
            nonlocal pending
            deadline=time.monotonic()+timeout
            while time.monotonic()<deadline:
                if b'\n' in pending:
                    line,_,rest=pending.partition(b'\n'); pending=bytearray(rest); return json.loads(line)
                if not selector.select(max(0,deadline-time.monotonic())): return None
                chunk=os.read(process.stdout.fileno(),65536)
                if not chunk: return None
                pending.extend(chunk)
            return None
        try:
            send({'op':'create','sessionId':'env-session','command':'/bin/bash','args':['--noprofile','--norc','-c','printf "%s" "${AXON_R14_TEST_HOST_SECRET-unset}"'],
                  'workspaceRoot':tmp,'cwd':tmp,'trustedWorkspace':True,'approvalReference':'owner-approved-env-test'})
            deadline=time.monotonic()+6; exit_seen=False
            while time.monotonic()<deadline:
                row=read(0.5)
                if not row: continue
                if row.get('event')=='data':
                    output += base64.b64decode(row.get('dataB64','')).decode(errors='replace')
                if row.get('event')=='exit':
                    exit_seen=True; break
            okay=exit_seen and 'unset' in output and 'MUST_NOT_REACH_SHELL' not in output
            return bool(okay), {'output':output[-1000:],'exitSeen':exit_seen}
        finally:
            try: process.stdin.close()
            except Exception: pass
            try: process.terminate(); process.wait(timeout=2)
            except Exception: process.kill(); process.wait(timeout=2)
            selector.close()


if __name__ == '__main__':
    rows=[]
    for test_id, name, fn in [('R12-PTY-01','Interactive shell uses a real POSIX PTY, accepts input, resizes and exits',test_real_pty),
                              ('R12-PTY-02','PTY provider blocks untrusted workspaces and working directories outside project root',test_trust_gate_and_path_boundary),
                              ('R14-PTY-03','PTY exit event reports terminating signal separately from exit code',test_signal_exit_reporting),
                              ('R14-PTY-04','PTY child environment does not inherit host secret variables',test_host_environment_secret_is_not_inherited)]: 
        try: passed, evidence=fn()
        except Exception as exc: passed, evidence=False, {'error':repr(exc)}
        rows.append({'id':test_id,'test':name,'status':'PASS' if passed else 'FAIL','evidence':evidence})
        print(json.dumps(rows[-1],ensure_ascii=False))
    print(f"Round 12 experimental Linux PTY provider: {sum(row['status']=='PASS' for row in rows)}/{len(rows)} PASS")
    raise SystemExit(0 if all(row['status']=='PASS' for row in rows) else 1)
