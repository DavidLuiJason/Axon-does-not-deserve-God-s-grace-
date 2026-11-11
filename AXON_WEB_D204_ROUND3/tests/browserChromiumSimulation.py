from playwright.sync_api import sync_playwright

passed=[]; failed=[]
def check(name, fn):
    try:
        value=fn()
        if value is True: passed.append(name)
        else: failed.append((name,repr(value)))
    except Exception as e: failed.append((name,type(e).__name__+': '+str(e)[:200]))

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':390,'height':844}, accept_downloads=True)

    # Search engine simulation
    page.set_content('''<title>Search portal</title><h1>Search</h1><form id="s"><input name="q" required><button>Search</button></form><ul id="results"><li><a href="#result">Result</a></li></ul><script>s.onsubmit=e=>{e.preventDefault();results.dataset.query=s.q.value;}</script>''')
    check('search: title renders',lambda: page.title()=='Search portal')
    check('search: input accepts text',lambda: (page.locator('[name=q]').fill('browser privacy') is None) and page.locator('[name=q]').input_value()=='browser privacy')
    check('search: submit handler runs',lambda: (page.locator('button').click() is None) and page.locator('#results').get_attribute('data-query')=='browser privacy')
    check('search: result link resolves',lambda: page.locator('#results a').get_attribute('href')=='#result')
    check('search: result list is readable',lambda: 'Result' in page.locator('#results').inner_text())

    # Cloud account / storage simulation
    page.set_content('''<title>Cloud drive</title><h1>Cloud Drive</h1><form id="login"><input id="email" type="email" required><input id="pw" type="password" required><button>Sign in</button></form><output id="state"></output><input id="files" type="file" multiple><output id="names"></output><script>login.onsubmit=e=>{e.preventDefault();state.textContent='Signed in (simulation)'};files.onchange=()=>names.textContent=[...files.files].map(f=>f.name).join(',')</script>''')
    check('cloud: title renders',lambda: page.title()=='Cloud drive')
    check('cloud: email input is email type',lambda: page.locator('#email').get_attribute('type')=='email')
    check('cloud: password input is masked type',lambda: page.locator('#pw').get_attribute('type')=='password')
    check('cloud: simulated sign-in submits',lambda: (page.locator('#email').fill('user@example.test') is None) and (page.locator('#pw').fill('not-a-real-password') is None) and (page.locator('button').click() is None) and page.locator('#state').inner_text()=='Signed in (simulation)')
    check('cloud: file input supports multiple selection',lambda: page.locator('#files').get_attribute('multiple') is not None)
    check('cloud: file picker selection event',lambda: (page.locator('#files').set_input_files([{'name':'report.txt','mimeType':'text/plain','buffer':b'hello'}]) is None) and page.locator('#names').inner_text()=='report.txt')

    # Cloud document editor simulation
    page.set_content('''<title>Cloud documents</title><h1>Document</h1><div id="editor" contenteditable="true" role="textbox">Draft</div><button id="save">Save</button><output id="saved"></output><script>save.onclick=()=>saved.textContent=editor.innerText</script>''')
    check('docs: contenteditable editor exists',lambda: page.locator('#editor').get_attribute('contenteditable')=='true')
    check('docs: editor can be edited',lambda: (page.locator('#editor').fill('Edited report') is None) and page.locator('#editor').inner_text()=='Edited report')
    check('docs: save action persists displayed content',lambda: (page.locator('#save').click() is None) and page.locator('#saved').inner_text()=='Edited report')
    check('docs: textbox accessibility role exists',lambda: page.get_by_role('textbox').count()==1)
    check('docs: heading is discoverable',lambda: page.get_by_role('heading',name='Document').count()==1)

    # Online store simulation
    page.set_content('''<title>Store</title><h1>Store</h1><article><h2>Phone case</h2><button id="add">Add to cart</button></article><output id="count">0</output><form id="checkout"><input name="address" required><button>Continue</button></form><script>let n=0;add.onclick=()=>count.textContent=String(++n);checkout.onsubmit=e=>e.preventDefault()</script>''')
    check('shop: product page title',lambda: page.title()=='Store')
    check('shop: product heading visible',lambda: page.get_by_role('heading',name='Phone case').count()==1)
    check('shop: add-to-cart click updates count',lambda: (page.locator('#add').click() is None) and page.locator('#count').inner_text()=='1')
    check('shop: second cart click increments',lambda: (page.locator('#add').click() is None) and page.locator('#count').inner_text()=='2')
    check('shop: checkout required field enforced',lambda: page.locator('[name=address]').is_visible() and page.locator('[name=address]').get_attribute('required') is not None)

    # Video and media simulation
    page.set_content('''<title>Video service</title><h1>Video</h1><video id="v" controls playsinline></video><audio id="a" controls></audio><button id="toggle">Toggle state</button><output id="status">ready</output><script>toggle.onclick=()=>status.textContent=v.paused?'paused':'playing'</script>''')
    check('video: title renders',lambda: page.title()=='Video service')
    check('video: HTML video element exists',lambda: page.locator('video').count()==1)
    check('video: controls enabled',lambda: page.locator('video').evaluate('(e)=>e.controls'))
    check('video: inline playback attribute',lambda: page.locator('video').evaluate('(e)=>e.playsInline'))
    check('video: audio element exists',lambda: page.locator('audio[controls]').count()==1)

    # News and wiki simulation
    page.set_content('''<title>News article</title><article><h1>Example headline</h1><p class="byline">By Example Author</p><time datetime="2026-11-10">10 Nov 2026</time><p>Article body text.</p><a href="#sources">Sources</a><section id="sources"><h2>Sources</h2><a href="https://example.test/source">Primary source</a></section></article>''')
    check('news: article heading',lambda: page.get_by_role('heading',name='Example headline').count()==1)
    check('news: author byline',lambda: page.locator('.byline').inner_text()=='By Example Author')
    check('news: publication time metadata',lambda: page.locator('time').get_attribute('datetime')=='2026-11-10')
    check('news: article body text',lambda: 'Article body' in page.locator('article').inner_text())
    check('news: source section link',lambda: page.locator('#sources a').get_attribute('href')=='https://example.test/source')

    # Forms and upload portal
    page.set_content('''<title>Forms portal</title><h1>Upload documents</h1><form id="f"><input id="up" type="file" required><input id="name" required><button>Submit</button></form><output id="out"></output><script>f.onsubmit=e=>{e.preventDefault();out.textContent='Submitted locally'}</script>''')
    check('forms: file input exists',lambda: page.locator('#up').count()==1)
    check('forms: required upload control',lambda: page.locator('#up').get_attribute('required') is not None)
    check('forms: file can be selected',lambda: (page.locator('#up').set_input_files({'name':'invoice.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4'}) is None) and page.locator('#up').input_value().endswith('invoice.pdf'))
    check('forms: text field accepts data',lambda: (page.locator('#name').fill('Sample') is None) and page.locator('#name').input_value()=='Sample')
    check('forms: submit handler runs',lambda: (page.locator('button').click() is None) and page.locator('#out').inner_text()=='Submitted locally')

    # Browser DOM, navigation and APIs
    page.set_content('''<title>Web platform test</title><a id="link" href="#next">Next</a><div id="target"></div><iframe id="frame" srcdoc="<title>Embedded page</title><p>Frame content</p>"></iframe><canvas id="c" width="10" height="10"></canvas><div id="edit" contenteditable="true">start</div>''')
    check('platform: same-document anchor navigation',lambda: (page.locator('#link').click() is None) and page.url.endswith('#next'))
    check('platform: iframe content renders',lambda: page.frame_locator('#frame').locator('p').inner_text()=='Frame content')
    check('platform: canvas context available',lambda: page.locator('#c').evaluate('(e)=>!!e.getContext("2d")'))
    check('platform: canvas can render a pixel',lambda: page.locator('#c').evaluate('(e)=>{let c=e.getContext("2d");c.fillRect(0,0,1,1);return e.toDataURL().startsWith("data:image/png")}'))
    check('platform: contenteditable updates',lambda: (page.locator('#edit').fill('new text') is None) and page.locator('#edit').inner_text()=='new text')

    # Download and browser feature discovery
    page.set_content('''<title>Downloads</title><a id="dl" href="data:text/plain,axon-download" download="axon.txt">Download file</a><button id="copy">Copy</button><p id="selection">copyable words</p>''')
    check('download: anchor exists',lambda: page.locator('#dl').count()==1)
    check('download: filename attribute retained',lambda: page.locator('#dl').get_attribute('download')=='axon.txt')
    check('download: downloadable URL present',lambda: page.locator('#dl').get_attribute('href').startswith('data:text/plain'))
    check('download: link text readable',lambda: page.locator('#dl').inner_text()=='Download file')
    check('download: copy control can receive click',lambda: (page.locator('#copy').click() is None) and page.locator('#copy').is_visible())

    # Layout, responsive behavior, keyboard and semantics
    page.set_content('''<title>Responsive page</title><meta name="viewport" content="width=device-width, initial-scale=1"><main><h1>Responsive</h1><nav aria-label="Main"><a href="#a">A</a></nav><button aria-label="Menu">Open</button><input aria-label="Search" placeholder="Search"></main>''')
    check('layout: mobile viewport width applied',lambda: page.evaluate('innerWidth')==390)
    check('layout: main landmark exists',lambda: page.get_by_role('main').count()==1)
    check('layout: navigation landmark exists',lambda: page.get_by_role('navigation',name='Main').count()==1)
    check('layout: accessible menu button exists',lambda: page.get_by_role('button',name='Menu').count()==1)
    check('layout: search input accessible name',lambda: page.get_by_role('textbox',name='Search').count()==1)

    # Redirect and browser history API (without external network)
    page.set_content('''<title>Navigation test</title><button id="push">Push state</button><button id="replace">Replace state</button><output id="loc"></output><script>push.onclick=()=>{history.pushState({step:1},'', '#step1');loc.textContent=location.hash};replace.onclick=()=>{history.replaceState({step:2},'', '#step2');loc.textContent=location.hash}</script>''')
    check('history: pushState changes fragment',lambda: (page.locator('#push').click() is None) and page.url.endswith('#step1'))
    check('history: state object stored',lambda: page.evaluate('history.state.step')==1)
    check('history: replaceState changes fragment',lambda: (page.locator('#replace').click() is None) and page.url.endswith('#step2'))
    check('history: replace state object stored',lambda: page.evaluate('history.state.step')==2)
    check('history: document title remains readable',lambda: page.title()=='Navigation test')

    browser.close()

print(f'CHROMIUM SIMULATION: {len(passed)} PASS, {len(failed)} FAIL')
for name in passed: print('PASS '+name)
for name,error in failed: print('FAIL '+name+' :: '+error)
if failed: raise SystemExit(1)
if len(passed)!=56: raise SystemExit(f'Expected 56 checks; got {len(passed)}')
