import {  useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';
import remarkGfm from 'remark-gfm'
// import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import js from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript'
import { vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import React from 'react';
import { sendPrompt } from './services/fetch-chat';

SyntaxHighlighter.registerLanguage('javascript', js)

// Add CopyButton component for per-button state
function CopyButton({ onClick }) {
  const [hover, setHover] = useState(false);
  const [mouseDown, setMouseDown] = useState(false);

  return (
    <button
      style={{
        position: 'absolute',
        top: 5,
        right: 5,
        fontSize: '.8em',
        padding: '0.14em 0.49em',
        borderRadius: '6px',
        background: mouseDown ? '#111' : hover ? '#222' : '#444',
        color: '#fff',
        border: '1px solid #444',
        cursor: 'pointer',
        zIndex: 2,
        transition: 'background 0.1s',
      }}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setMouseDown(false); }}
      onMouseDown={() => setMouseDown(true)}
      onMouseUp={() => setMouseDown(false)}
    >
      Copy
    </button>
  );
}

export default function App() {
  const [input, setInput] = useState('');
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contextPercent, setContextPercent] = useState(0);

  


 

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
        margin:'1.4rem auto',
        fontFamily:'sans-serif',
        fontSize:'1.2rem', 
        letterSpacing:'.07rem',
        background:'black',
        color:'white',
        padding:'0.7rem',
        borderRadius:'10.5px',
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
                      p: ({ node, ...props }) => {
                        let children = props.children;
                        if (Array.isArray(children) && children.length > 1) {
                          children = children.filter((child, idx, arr) => {
                            // Remove if this child is a lone period and previous is a React element (likely a code block)
                            if (
                              typeof child === 'string' &&
                              child.trim().match(/^\.*$/) &&
                              idx > 0 &&
                              React.isValidElement(arr[idx - 1])
                            ) {
                              return false;
                            }
                            return true;
                          });
                        }
                        return <p style={{ margin: '1em 0' }}>{children}</p>;
                      },
                      a: ({ node, ...props }) => (
                        <a style={{ color: '#4af', textDecoration: 'underline' }} {...props} >{props.children}</a>                      ),
                      pre: ({ node, ...props }) => <>{props.children}</>,
                      code: ({ node, inline, className, children, ...props }) => {
                        const codeString = Array.isArray(children) ? children.join('') : String(children);
                        const language = (className || '').replace('language-', '');

                        // Helper: is this a filename-like string?
                        const isFilename = /^[\w\-./\\]+(\.[\w]+)?$/.test(codeString.trim());

                        if (inline || isFilename) {
                          // Split codeString into parts: comments and non-comments
                          const commentRegex = /((?:\/\/|#).*$)/gm;
                          const parts = [];
                          let lastIndex = 0;
                          let match;
                          while ((match = commentRegex.exec(codeString)) !== null) {
                            if (match.index > lastIndex) {
                              parts.push(codeString.slice(lastIndex, match.index));
                            }
                            parts.push(
                              <span key={match.index} style={{ color: '#347a09' }}>{match[0]}</span>
                            );
                            lastIndex = match.index + match[0].length;
                          }
                          if (lastIndex < codeString.length) {
                            parts.push(codeString.slice(lastIndex));
                          }
                          return (
                            <code
                              style={{
                                background: '#222',
                                color: '#fffa',
                                borderRadius: '3.5px',
                                padding: '0.098em 0.196em',
                                fontSize: '0.8em',
                                fontFamily: 'monospace',
                                whiteSpace: 'pre-wrap',
                              }}
                              {...props}
                            >
                              {parts.length > 0 ? parts : codeString}
                            </code>
                          );
                        }


                        // Block code: use SyntaxHighlighter
                        return (
                          <div style={{ position: 'relative', marginBottom: '0.245em', marginTop: node?.position?.start?.offset > 0 ? '0.7em' : undefined }}>
                            <SyntaxHighlighter
                              language={language || 'text'}
                              style={vs2015}
                              customStyle={{
                                borderRadius: '5.6px',
                                fontSize: '.8em',
                                padding: '0.7em',
                                background: '#181818',
                                margin: 0,
                              }}
                            >
                              {codeString}
                            </SyntaxHighlighter>
                            {node?.position && m.role === 'bot' && (
                              <CopyButton onClick={() => navigator.clipboard.writeText(codeString)} />
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
          <p className='loading-button' style={{fontSize:'1rem'}}>
            Loading your response...
          </p>
        ) : null}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'0.35rem',width:'100%'}}>
          <textarea
            style={{width:'70%',fontSize:'1.05rem',height:'70px',display:loading?'none':'block'}}
            value={input}
            placeholder={`Let's code!  What can I help build for you? `}
            disabled={loading? true:false}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&sendPrompt(input, setLog, setInput, setLoading, setContextPercent)}
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
              onClick={()=>sendPrompt(input, setLog, setInput, setLoading, setContextPercent) }
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
              fontSize: '0.85rem', 
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
