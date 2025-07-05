import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';

export default function App() {
  const [input, setInput] = useState('');
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);



  async function send() {
    if (!input.trim()) return;
    const userMsg = input;
    setLog(l => [...l, { text: userMsg }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ user: userMsg })
      });
      const { bot } = await res.json();
      setLog(l => [...l, { text: bot }]);
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
        padding: '.5rem 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderTopLeftRadius: '0',
        borderTopRightRadius: '0',
        boxShadow: '0 2px 8px #0008',
        fontSize: '2rem',
        fontWeight: 'bold',
        letterSpacing: '.15rem',
        gap: '1rem',
      }}>
        <span style={{fontSize:'1.5rem',userSelect:'none'}}>💬</span>
        <span style={{fontSize:'1.5rem',userSelect:'none'}} >My Local Chatbot</span>
      </header>
      {/* Main chat area */}
      <main style={{
        margin:'2rem auto',
        fontFamily:'sans-serif',
        fontSize:'1.5rem',
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
        width:'70%'
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
                      pre: ({ node, ...props }) => (
                        <pre
                          style={{
                            background: '#181818',
                            color: '#fff',
                            padding: '1em',
                            borderRadius: '8px',
                            overflowX: 'auto',
                            margin: '1em 0',
                            maxWidth: '100%',
                            fontSize: '1.1em',
                          }}
                          {...props}
                        />
                      ),
                      code: ({ node, inline, className, children, ...props }) => {
                        // Convert children to string
                        const codeString = Array.isArray(children) ? children.join('') : String(children);
                        // Regex for JS/C-style (// ...) and Python (# ...) comments
                        const commentRegex = /((?:\/\/|#).*$)/gm;
                        // Replace comments with green span
                        const html = codeString.replace(commentRegex, '<span style="color:#347a09;">$1</span>');
                        if (inline) {
                          return (
                            <code
                              style={{
                                background: '#222',
                                color: '#fffa',
                                borderRadius: '5px',
                                padding: '0.2em 0.4em',
                                fontSize: '1em',
                                fontFamily: 'monospace',
                                whiteSpace: 'pre-wrap',
                              }}
                              dangerouslySetInnerHTML={{ __html: html }}
                              {...props}
                            />
                          );
                        }
                        return (
                          <code
                            style={{
                              background: 'none',
                              color: '#fffa',
                              borderRadius: '5px',
                              padding: 0,
                              fontSize: '1em',
                              fontFamily: 'monospace',
                              whiteSpace: 'pre',
                            }}
                            dangerouslySetInnerHTML={{ __html: html }}
                            {...props}
                          />
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
          <p className='loading-button' style={{color:'white',textAlign:'center', width:'100%',padding:'.5rem 0',borderRadius:'15px'}}>
            Loading your response...
          </p>
        ) : null}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'0.5rem',width:'100%'}}>
          <textarea
            style={{width:'100%',fontSize:'1.5rem',height:'100px',display:loading?'none':'block'}}
            value={input}
            disabled={loading? true:false}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&send()}
          />
          {!loading && (
            <button 
              style={{fontSize:'1.5rem', borderRadius:'15px',padding:'.25rem 1rem',marginTop:'0.5rem'}}
              onClick={send}>Send</button>
          )}
        </div>
      </main>
      {/* Footer */}
      <footer style={{
        width: '100%',
        background: '#181818',
        color: '#aaa',
        padding: '1rem 0',
        textAlign: 'center',
        fontSize: '1.1rem',
        borderBottomLeftRadius: '0',
        borderBottomRightRadius: '0',
        boxShadow: '0 -2px 8px #0008',
        marginTop: '2rem',
      }}>
        <div>Powered by React • <span style={{fontFamily:'monospace'}}>My Chatbot</span> &copy; {new Date().getFullYear()}</div>
        <div style={{fontSize:'0.95rem',marginTop:'0.3em'}}>Open source project &mdash; <a href="#" style={{color:'#4af',textDecoration:'underline'}}>GitHub (coming soon)</a></div>
      </footer>
    </div>
  );
}
