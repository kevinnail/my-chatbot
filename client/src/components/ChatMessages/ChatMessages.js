import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import js from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import { vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import CopyButton from '../CopyButton/CopyButton.js';

// Register the language for syntax highlighting
SyntaxHighlighter.registerLanguage('javascript', js);

const ChatMessages = ({ log, loading }) => {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1rem',marginBottom:'1.5rem'}}>
      {log.map((m, i) => {
        const isUser = m.role === 'user';
        const isError = m.role === 'error';
        const isBot = m.role === 'bot';
        
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: isUser ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: '1rem',
            }}
          >
            <div
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                background: isUser ? '#4f62cb' : isError ? '#4a1a1a' : '#1f64a7',
                color: '#ffffffd3',
                borderRadius: '10px',
                padding: '.75rem 1.25rem',
                maxWidth: '70%',
                wordBreak: 'break-word',
                boxShadow: isUser ? '0 2px 8px #1118' : isError ? '0 2px 8px #f448' : '0 2px 8px #2228',
                border: isError ? '1px solid #ff6b6b' : 'none',
              }}
            >
              {isBot ? (
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
                      <a style={{ color: '#4af', textDecoration: 'underline' }} {...props} >{props.children}</a>
                    ),
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
                              border: '1px solid #444',
                              borderTopColor: '#aaa',
                              borderLeftColor: '#aaa',
                              borderRightColor: '#fff',
                              borderBottomColor: '#fff',
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
              ) : isError ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ node, ...props }) => (
                      <p style={{ margin: '1em 0', color: '#ff6b6b' }}>{props.children}</p>
                    ),
                    strong: ({ node, ...props }) => (
                      <strong style={{ color: '#ff8a8a' }} {...props} />
                    ),
                  }}
                >
                  {m.text}
                </ReactMarkdown>
              ) : (
                m.text
              )}
            </div>
          </div>
        );
      })}
      {loading && (
        <p className='loading-button' style={{fontSize:'1rem'}}>
          Loading your response...
        </p>
      )}
    </div>
  );
};

export default ChatMessages; 