import {  useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';
import remarkGfm from 'remark-gfm'
// import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import js from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript'
import { vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs';

SyntaxHighlighter.registerLanguage('javascript', js)

export default function App() {
  const [input, setInput] = useState('');
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contextPercent, setContextPercent] = useState(0);
  const [hover, setHover] = useState(false);
  async function send() {
    if (!input.trim()) return;
    const userMsg = input;
    setLog(l => [...l, { text: userMsg, role: 'user' }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ user: userMsg })
      });
      const { bot, context_percent } = await res.json();
      setLog(l => [...l, { text: bot, role: 'bot' }]);
      if (typeof context_percent === 'number') setContextPercent(context_percent);
    } finally {
      setLoading(false);
    }
  }

 

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'black'}}>
      {/* Header */}
      <header style={{
        width: '100%',
        background: '#181818',
        color: 'white',
        padding: '.5rem 0 .5rem .5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        borderTopLeftRadius: '0',
        borderTopRightRadius: '0',
        boxShadow: '0 2px 8px #0008',
        fontSize: '1.4rem', 
        fontWeight: 'bold',
        letterSpacing: '.15rem',
        gap: '1rem',
      }}>
        <span style={{fontSize:'1.05rem',userSelect:'none'}}><img width="28px" style={{borderRadius:'25%',transform:'translateY(5px)'}} alt='logo' src="./logo.png"/></span>
        <span style={{fontSize:'1.05rem',userSelect:'none'}} >My Coding Assistant</span>
      </header>
      {/* Main chat area */}
      <main style={{
        margin:'2rem auto',
        fontFamily:'sans-serif',
        fontSize:'1.05rem', 
        letterSpacing:'.1rem',
        background:'black',
        color:'white',
        padding:'1rem',
        borderRadius:'15px',
        flex:'1 0 auto',
        boxShadow:'0 2px 16px #000a',
        minHeight:'60vh',
        display:'flex',
        flexDirection:'column',
        width:'90%'
      }}>

        <div style={{display:'flex',flexDirection:'column',gap:'1rem',marginBottom:'1.5rem'}}>
          {log.map((m, i) => (
          <div
          key={i}
          style={{
            display: 'flex',
            flexDirection: i % 2 === 1 ? 'row' : 'row-reverse',
            alignItems: 'flex-start',
            gap: '1rem',
              }}
            >

              <div
                style={{
                  alignSelf: i % 2 === 0 ? 'flex-end' : 'flex-start',
                  background: i % 2 === 0 ? '#222' : '#444',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '.75rem 1.25rem',
                  maxWidth: '70%',
                  wordBreak: 'break-word',
                  boxShadow: i % 2 === 0 ? '0 2px 8px #1118' : '0 2px 8px #2228',
                }}
                >

                {i % 2 === 1 ? (
                  <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                    components={{
                      ul: ({ node, ...props }) => (
                        <ul style={{ margin: '1em 0', paddingLeft: '1.5em' }} {...props} />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol style={{ margin: '1em 0', paddingLeft: '1.5em' }} {...props} />
                      ),
                      li: ({ node, ...props }) => (
                        <li
                          style={{
                            marginBottom: '0.5em',
                            listStyleType: 'disc',
                            display: 'list-item',
                          }}
                          {...props}
                        />
                      ),
                      p: ({ node, ...props }) => (
                        <p style={{ margin: '1em 0',  }} {...props} />
                      ),
                      a: ({ node, ...props }) => (
                        <a style={{ color: '#4af', textDecoration: 'underline' }} {...props} >{props.children}</a>                      ),
                      pre: ({ node, ...props }) => <>{props.children}</>,
                      code: ({ node, inline, className, children, ...props }) => {
                        const codeString = Array.isArray(children) ? children.join('') : String(children);
                        const language = (className || '').replace('language-', '');

                        if (inline) {
                          // Inline code: custom style and comment highlighting
                          const commentRegex = /((?:\/\/|#).*$)/gm;
                          const html = codeString.replace(commentRegex, '<span style="color:#347a09;">$1</span>');
                          return (
                            <code
                              style={{
                                background: '#222',
                                color: '#fffa',
                                borderRadius: '5px',
                                padding: '0.14em 0.28em', 
                                fontSize: '0.7em', 
                                fontFamily: 'monospace',
                                whiteSpace: 'pre-wrap',
                              }}
                              dangerouslySetInnerHTML={{ __html: html }}
                              {...props}
                            />
                          );
                        }

                        // Block code: use SyntaxHighlighter
                        return (
                          <div style={{ position: 'relative', marginBottom: '0.35em' }}>
                            <SyntaxHighlighter
                              language={language || 'text'}
                              style={vs2015}
                              customStyle={{
                                borderRadius: '8px',
                                fontSize: '.8em', 
                                padding: '1em', 
                                background: '#181818',
                                margin: 0,
                              }}
                            >
                              {codeString}
                            </SyntaxHighlighter>
                            {node?.position && m.role === 'bot' && (
                              <button
                                style={{
                                  position: 'absolute',
                                  top: 5,
                                  right: 5,
                                  fontSize: '1em', 
                                  padding: '0.14em 0.49em', 
                                  borderRadius: '6px',
                                  background:hover? '#444' : '#222',
                                  color: '#fff',
                                  border: '1px solid #444',
                                  cursor: 'pointer',
                                  zIndex: 2,
                                }}
                                onClick={() => navigator.clipboard.writeText(codeString)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
                              >Copy</button>
                            )}
                          </div>
                        );
                      },
                    }}
                  >
                    {m.text}
                  </ReactMarkdown>
                ) : (
                  m.text
                )}
              </div>
            </div>
          ))}
        </div>
        {loading ? (
          <p className='loading-button'>
            Loading your response...
          </p>
        ) : null}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'0.5rem',width:'100%'}}>
          <textarea
            style={{width:'70%',fontSize:'1.05rem',height:'70px',display:loading?'none':'block'}}
            value={input}
            disabled={loading? true:false}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&send()}
          />
          {!loading && (
            <button 
              style={{
                fontSize: '0.77rem', 
                borderRadius: '15px',
                padding: '.28rem 1.05rem',
                margin: '0.5rem 15% 0 0',
                background: 'linear-gradient(90deg, #4af 0%, #0fa 100%)',
                color: '#fff',
                border: 'none',
                boxShadow: '0 2px 12px #0af4',
                fontWeight: 'bold',
                letterSpacing: '.08em',
                cursor: 'pointer',
                transition: 'background 0.3s, transform 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.7em',
                disabled:loading? true:false,
                alignSelf:'flex-end'
              }}
              onClick={send}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginRight:'0.2em'}}>
                <path d="M3 20L21 12L3 4V10L17 12L3 14V20Z" fill="white"/>
              </svg>
              Send
            </button>
          )}
        </div>
        {/* Context Usage Progress Bar */}
        <div style={{
          width: '90%',
          margin: '1.5rem auto 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexDirection: 'row',
          justifyContent: 'flex-start',
        }}>
          <div style={{
            width: '154px', 
            height: '20px', 
            background: '#222',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '2px solid #444',
            position: 'relative',
            boxShadow: '0 1px 6px #0006',
          }}>
            <div style={{
              width: `${Math.min(100, contextPercent).toFixed(1)}%`,
              height: '100%',
              background: contextPercent < 70 ? 'linear-gradient(90deg,#4af,#0fa)' : contextPercent < 90 ? 'linear-gradient(90deg,#ff0,#fa0)' : 'linear-gradient(90deg,#f44,#a00)',
              transition: 'width 0.5s cubic-bezier(.4,2,.6,1)',
            }} />
            <span style={{
              position: 'absolute',
              left: 0, right: 0, top: 0, bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '0.77rem', 
              textShadow: '0 1px 4px #000a',
              pointerEvents: 'none',
            }}>{contextPercent.toFixed(1)}% context used</span>
          </div>
        </div>
      </main>
      {/* Footer */}
      <footer style={{
        width: '100%',
        background: '#181818',
        color: '#aaa',
        padding: '1rem 0',
        textAlign: 'center',
        fontSize: '0.77rem', 
        borderBottomLeftRadius: '0',
        borderBottomRightRadius: '0',
        boxShadow: '0 -2px 8px #0008',
        marginTop: '2rem',
      }}>
        <div>Powered by React/ Express/ Node/ WSL • <span style={{fontFamily:'monospace'}}>My Coding Assistant</span> &copy; {new Date().getFullYear()}</div>
        <div style={{fontSize:'0.67rem',marginTop:'0.3em'}}> <a href="#https://www.github.com/kevinnail" style={{color:'#4af',textDecoration:'underline'}}>GitHub (coming soon)</a></div>
      </footer>
    </div>
  );
}
