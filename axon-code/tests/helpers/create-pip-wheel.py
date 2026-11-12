import base64
import csv
import hashlib
import io
import os
import sys
import zipfile
from pathlib import Path

out = Path(sys.argv[1])
name = 'axon_pip_fixture'
dist = 'axon_pip_fixture-1.0.0.dist-info'
files = {
    f'{name}/__init__.py': "VALUE = 'pip-local-index-ok'\n",
    f'{dist}/METADATA': 'Metadata-Version: 2.1\nName: axon-pip-fixture\nVersion: 1.0.0\n\nLocal test wheel.\n',
    f'{dist}/WHEEL': 'Wheel-Version: 1.0\nGenerator: axon-r14-test\nRoot-Is-Purelib: true\nTag: py3-none-any\n',
}
rows = []
for path, content in files.items():
    data = content.encode()
    digest = base64.urlsafe_b64encode(hashlib.sha256(data).digest()).rstrip(b'=').decode()
    rows.append((path, f'sha256={digest}', str(len(data))))
rows.append((f'{dist}/RECORD', '', ''))
buf = io.StringIO(newline='')
writer = csv.writer(buf, lineterminator='\n')
writer.writerows(rows)
files[f'{dist}/RECORD'] = buf.getvalue()
out.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
    for path, content in files.items():
        archive.writestr(path, content)
print(out)
