#!/usr/bin/env python3
"""AXON Director tool: inspect a zip that a builder returned, in one command.

Usage:
  python3 verify_return.py BASE.zip RETURNED.zip --lane "glob,glob,..." [--run-tests] [--make-delta OUT.zip]

BASE.zip      the repository zip the builder was given (or the last good repository zip)
RETURNED.zip  the zip the builder (ChatGPT or an AI Studio export) returned
--lane        comma separated globs of the files the builder was allowed to touch ("**" allowed)
--run-tests   overlay RETURNED on BASE in a temp folder and run the project's test:kernel commands
              (before and after) and every new test file; reports tests that got worse
--make-delta  write a zip with ONLY the in-lane new/changed files (for AI Studio exports)
It never changes your files. Needs python3; --run-tests needs node and tsx.
"""
import sys, os, re, zipfile, tempfile, shutil, subprocess, json, fnmatch

FORBIDDEN = ['package.json', 'tools/files.lock', 'tools/guard.mjs', 'tools/auto-unpack.sh',
             '.github/', 'public/dictionary/', '.gitignore', '.nvmrc']
PLACEHOLDERS = [r'\bTODO\b', r'\bFIXME\b', r'not implemented', r'NotImplemented', r'//\s*stub', r'placeholder implementation', r'implement me']

def read_zip(path):
    z = zipfile.ZipFile(path)
    names = [n for n in z.namelist() if not n.endswith('/')]
    # step into the folder that holds package.json (or src/ docs/ tests/) when the zip has wrapper folders
    prefix = ''
    cands = sorted({n[:-len('package.json')] for n in names if n.endswith('package.json') and n.count('/') <= 3}, key=lambda x: x.count('/'))
    if cands:
        prefix = cands[0]
    else:
        tops = {n.split('/')[0] for n in names}
        if len(tops) == 1 and all('/' in n for n in names):
            top = list(tops)[0]
            inner = [n[len(top) + 1:] for n in names]
            if any(x.startswith(('src/', 'docs/', 'tests/')) for x in inner):
                prefix = top + '/'
    out = {}
    for n in names:
        rel = n[len(prefix):] if prefix and n.startswith(prefix) else n
        if rel.startswith('__MACOSX/') or rel.endswith('.DS_Store'):
            continue
        out[rel] = z.read(n)
    return out, prefix

def glob_match(path, pat):
    rx = re.escape(pat).replace(r'\*\*/', '(?:.*/)?').replace(r'\*\*', '.*').replace(r'\*', '[^/]*')
    return re.fullmatch(rx, path) is not None

def run(cmd, cwd, timeout=240):
    try:
        p = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout + p.stderr)
    except subprocess.TimeoutExpired:
        return 124, 'TIMEOUT'

def kernel_commands(root):
    try:
        pj = json.load(open(os.path.join(root, 'package.json')))
        line = pj['scripts'].get('test:kernel', '')
        return [c.strip() for c in line.split('&&') if c.strip()]
    except Exception:
        return []

def write_tree(files, root):
    for rel, data in files.items():
        p = os.path.join(root, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, 'wb').write(data)

def main():
    a = sys.argv[1:]
    if len(a) < 2:
        print(__doc__); sys.exit(2)
    base_zip, ret_zip = a[0], a[1]
    lane = []; run_tests = False; delta = None
    i = 2
    while i < len(a):
        if a[i] == '--lane': lane = [x.strip() for x in a[i + 1].split(',') if x.strip()]; i += 2
        elif a[i] == '--run-tests': run_tests = True; i += 1
        elif a[i] == '--make-delta': delta = a[i + 1]; i += 2
        else: i += 1
    base, bp = read_zip(base_zip); ret, rp = read_zip(ret_zip)
    print(f'BASE: {len(base)} files (top folder stripped: {bp or "none"})   RETURNED: {len(ret)} files (top folder stripped: {rp or "none"})')
    new = sorted(k for k in ret if k not in base)
    changed = sorted(k for k in ret if k in base and ret[k] != base[k])
    same = [k for k in ret if k in base and ret[k] == base[k]]
    problems = []
    print(f'NEW: {len(new)}   CHANGED: {len(changed)}   IDENTICAL-TO-BASE: {len(same)}')
    if len(ret) > 200 and len(same) > len(new) + len(changed):
        print('NOTE: the returned zip looks like a WHOLE-PROJECT export (most files unchanged). Judge only the in-lane files; never upload it whole (roadmap 5.2).')
    for k in new: print('  + ' + k)
    for k in changed:
        lb = base[k].count(b'\n'); lr = ret[k].count(b'\n')
        flag = ''
        if lb > 20 and lr < lb * 0.7:
            flag = f'   <-- SHRUNK {lb}->{lr} lines'; problems.append(f'shrunk file {k}')
        print(f'  ~ {k} ({lb}->{lr} lines){flag}')
    touched = new + changed
    out_lane = [k for k in touched if lane and not any(glob_match(k, g) for g in lane)]
    forb = [k for k in touched if any(k == f or k.startswith(f) for f in FORBIDDEN)]
    zips = [k for k in touched if k.lower().endswith('.zip')]
    if lane: print(f'OUT OF LANE: {len(out_lane)}'); [print('  ! ' + k) for k in out_lane]
    if out_lane: problems.append(f'{len(out_lane)} out-of-lane files')
    if forb: print('FORBIDDEN FILES TOUCHED:'); [print('  ! ' + k) for k in forb]; problems.append('forbidden files touched')
    if zips: print('NESTED ZIPS:'); [print('  ! ' + k) for k in zips]; problems.append('nested zip')
    hits = []
    for k in touched:
        if k.endswith(('.ts', '.tsx', '.js', '.mjs')):
            txt = ret[k].decode('utf8', 'replace')
            for pat in PLACEHOLDERS:
                for m in re.finditer(pat, txt, re.I):
                    ln = txt.count('\n', 0, m.start()) + 1
                    hits.append(f'{k}:{ln}: {m.group(0)}')
    print(f'PLACEHOLDER SCAN: {len(hits)} hits'); [print('  ? ' + h) for h in hits[:40]]
    if hits: problems.append('placeholder words found (check each)')
    reports = [k for k in new if k.startswith('docs/reports/')]
    print('REPORT FILE:', reports or 'MISSING'); 
    if not reports and any(k.startswith('src/') for k in touched): problems.append('no report file')
    newtests = [k for k in touched if k.startswith('tests/') and k.endswith('.test.ts')]
    if run_tests:
        tmp = tempfile.mkdtemp(prefix='axonverify_')
        b_dir = os.path.join(tmp, 'base'); o_dir = os.path.join(tmp, 'overlay')
        write_tree(base, b_dir); write_tree(base, o_dir); write_tree({k: ret[k] for k in touched}, o_dir)
        cmds = kernel_commands(o_dir)
        # new tests are not in package.json yet (builders only report the lines): add them
        for t in newtests:
            c = f'tsx {t}'
            if c not in cmds: cmds.append(c)
        print(f'\nRUNNING {len(cmds)} test commands on BASE and on OVERLAY (this takes a while)...')
        worse = []
        for c in cmds:
            rb, ob = (run(c, b_dir) if (c.replace('tsx ', '') not in newtests) else (None, 'n/a (new test)'))
            ro, oo = run(c, o_dir)
            status = 'PASS' if ro == 0 else 'FAIL'
            was = 'n/a' if rb is None else ('PASS' if rb == 0 else 'FAIL')
            mark = ''
            if ro != 0 and was in ('PASS', 'n/a'): mark = '   <-- NEW FAILURE'; worse.append(c)
            print(f'  [{status}] (base: {was}) {c}{mark}')
            if ro != 0 and mark: print('        ' + '\n        '.join(oo.strip().splitlines()[-6:]))
        if worse: problems.append(f'{len(worse)} tests fail that did not fail before')
        # type check the in-lane SOURCE files with a global tsc if there is one (strict, DOM lib, no project types; test files are skipped)
        srcfiles = []
        for k in touched:
            if k.endswith('.ts') and k.startswith('src/'):
                head = ret[k].decode('utf8', 'replace')
                if not any(x in head for x in ("from 'react'", 'from "react"', "'@capacitor", "'lucide-react'", "import.meta")):
                    srcfiles.append(os.path.join(o_dir, k))
        skipped = [k for k in touched if k.endswith('.tsx') and k.startswith('src/')]
        if skipped: print('TYPE CHECK skips React files (their types are not installed here; read them by hand and rely on the cloud build):', ', '.join(skipped))
        if srcfiles and shutil.which('tsc'):
            cfg = os.path.join(tmp, 'tsconfig.check.json')
            json.dump({'compilerOptions': {'target': 'ES2022', 'module': 'ESNext', 'lib': ['ES2022', 'DOM', 'DOM.Iterable'], 'skipLibCheck': True,
                       'moduleResolution': 'bundler', 'isolatedModules': True, 'moduleDetection': 'force', 'strict': True, 'noEmit': True, 'types': [], 'jsx': 'react-jsx'},
                       'files': srcfiles}, open(cfg, 'w'))
            rc, oc = run('tsc -p ' + cfg, o_dir)
            print('TYPE CHECK (global tsc, strict, in-lane src files only):', 'PASS' if rc == 0 else 'FAIL')
            if rc != 0:
                problems.append('type check failed'); print('        ' + '\n        '.join(oc.strip().splitlines()[:15]))
        else:
            print('TYPE CHECK: not run here (no tsc or no src files). Rely on the builder\'s report and the cloud build.')
        shutil.rmtree(tmp, ignore_errors=True)
        print('NOTE: the project\'s own type check (vite/client types, React, Capacitor) still only runs in the cloud build.')
    if delta:
        keep = [k for k in touched if (not lane) or any(glob_match(k, g) for g in lane)]
        with zipfile.ZipFile(delta, 'w', zipfile.ZIP_DEFLATED) as z:
            for k in keep: z.writestr(k, ret[k])
        print(f'DELTA written: {delta} ({len(keep)} files)')
    print('\nVERDICT:', 'NO PROBLEMS FOUND BY THIS SCRIPT (still read the code and the report)' if not problems else 'PROBLEMS -> ' + '; '.join(problems))

main()
