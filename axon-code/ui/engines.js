import {EditorState} from '@codemirror/state';
import {EditorView, lineNumbers, highlightActiveLine} from '@codemirror/view';
import {history, defaultKeymap, historyKeymap, indentWithTab} from '@codemirror/commands';
import {javascript} from '@codemirror/lang-javascript';
import {keymap} from '@codemirror/view';
import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import {assertLoopbackTerminalEndpoint} from './terminalEndpoint.js';

let editorView = null;
let terminal = null;
let terminalSocket = null;
let terminalSessionId = null;

export function mountCodeMirror({parent, initialText='', onChange=()=>{}}) {
  editorView?.destroy();
  editorView = new EditorView({
    state: EditorState.create({
      doc: initialText,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        javascript({typescript: true, jsx: true}),
        EditorView.updateListener.of(update => {
          if (update.docChanged) onChange(update.state.doc.toString());
        }),
        EditorView.theme({
          '&': {height: '100%', backgroundColor: '#101820', color: '#dce5ee'},
          '.cm-scroller': {overflow: 'auto', fontFamily: 'ui-monospace, monospace', fontSize: '13px'},
          '.cm-gutters': {backgroundColor: '#101820', color: '#65717e', border: 'none'},
          '.cm-activeLine': {backgroundColor: '#18232d'},
          '.cm-activeLineGutter': {backgroundColor: '#18232d'}
        })
      ]
    }),
    parent
  });
  return {
    get value(){ return editorView.state.doc.toString(); },
    setValue(value){ editorView.dispatch({changes:{from:0,to:editorView.state.doc.length,insert:String(value)}}); },
    focus(){ editorView.focus(); },
    selectAll(){ editorView.dispatch({selection:{anchor:0,head:editorView.state.doc.length}}); },
    clear(){ editorView.dispatch({changes:{from:0,to:editorView.state.doc.length,insert:''}}); },
    replaceSelection(value){ editorView.dispatch(editorView.state.replaceSelection(value)); },
    getSelection(){ const s=editorView.state.selection.main; return editorView.state.doc.sliceString(s.from,s.to); },
    destroy(){ editorView.destroy(); editorView=null; }
  };
}

export function mountXterm(parent, {onStatus=()=>{}}={}) {
  terminal?.dispose();
  terminal = new Terminal({
    convertEol: true,
    cursorBlink: true,
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
    fontSize: 12,
    theme: {background:'#0b1117', foreground:'#dce5ee', cursor:'#e85a3c'}
  });
  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.open(parent);
  fit.fit();
  const resizeObserver = new ResizeObserver(()=>fit.fit());
  resizeObserver.observe(parent);
  terminal.writeln('AXON Code terminal emulator ready.');
  terminal.writeln('A real PTY requires a trusted host bridge; no shell is simulated.');
  return {
    terminal,
    connect({url, token, hostOrigin}) {
      const endpoint = assertLoopbackTerminalEndpoint(url);
      endpoint.searchParams.set('token', token);
      if (terminalSocket) terminalSocket.close();
      terminalSessionId = null;
      terminalSocket = new WebSocket(endpoint, []);
      terminalSocket.addEventListener('open',()=>onStatus('Connected to authenticated local PTY.'));
      terminalSocket.addEventListener('message',event=>{
        try {
          const msg=JSON.parse(event.data);
          if(msg.event==='started') terminalSessionId = msg.sessionId;
          else if(msg.event==='data' && typeof msg.dataB64 === 'string') {
            const raw=atob(msg.dataB64); const bytes=Uint8Array.from(raw, c=>c.charCodeAt(0));
            terminal.write(bytes);
          } else if(msg.event==='exit') terminal.writeln(`\r\n[process exited: ${msg.exitCode ?? (msg.signal ? `signal ${msg.signal}` : 'unknown')}]`);
          else if(msg.event==='error') terminal.writeln(`\r\n[PTY error: ${msg.message ?? msg.code ?? 'unknown'}]`);
          else if(msg.event==='closed') terminal.writeln(`\r\n[PTY closed: ${msg.status ?? 'closed'}]`);
          else if(msg.event==='resized') return;
          else terminal.write(String(event.data));
        } catch { terminal.write(String(event.data)); }
      });
      terminalSocket.addEventListener('close',()=>onStatus('PTY disconnected.'));
      terminal.onData(data=>{
        if(terminalSocket?.readyState===WebSocket.OPEN) {
          const bytes=new TextEncoder().encode(data);
          let binary=''; for(const b of bytes) binary+=String.fromCharCode(b);
          if(terminalSessionId) terminalSocket.send(JSON.stringify({op:'write',sessionId:terminalSessionId,dataB64:btoa(binary)}));
        }
      });
      terminal.onResize(({cols,rows})=>{
        if(terminalSocket?.readyState===WebSocket.OPEN) if(terminalSessionId) terminalSocket.send(JSON.stringify({op:'resize',sessionId:terminalSessionId,cols,rows}));
      });
      return terminalSocket;
    },
    write(text){terminal.write(text);},
    dispose(){resizeObserver.disconnect();terminalSocket?.close();terminal.dispose();terminal=null;}
  };
}
