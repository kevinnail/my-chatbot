import Imap from 'imap';
import { simpleParser } from 'mailparser';

// IMAP connection configuration
export const getImapConfig = () => ({
  user: process.env.GMAIL_USER,
  password: process.env.GMAIL_APP_PASSWORD,
  host: process.env.GMAIL_IMAP_HOST || 'imap.gmail.com',
  port: process.env.GMAIL_IMAP_PORT || 993,
  tls: true,
  tlsOptions: {
    servername: 'imap.gmail.com',
  },
});

// Test IMAP connection
export const testImapConnection = () => {
  return new Promise((resolve, reject) => {
    const imap = new Imap(getImapConfig());
    imap.once('ready', () => {
      imap.end();
      resolve(true);
    });

    imap.once('error', (err) => {
      reject(err);
    });

    imap.connect();
  });
};

// Parse email body from IMAP data
export function parseEmailBody(body) {
  // Remove HTML tags and clean up the text
  let cleanText = body
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
    .trim();

  // Limit body length
  if (cleanText.length > 2000) {
    cleanText = cleanText.substring(0, 2000) + '...';
  }

  return cleanText;
}

// Get emails using IMAP
export function getEmailsViaImap(searchCriteria) {
  return new Promise((resolve, reject) => {
    const imap = new Imap(getImapConfig());
    const emails = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        // Search for emails based on criteria
        imap.search(searchCriteria, (err, results) => {
          if (err) {
            reject(err);
            return;
          }

          if (!results || results.length === 0) {
            imap.end();
            resolve([]);
            return;
          }

          // Limit results to prevent overwhelming
          const limitedResults = results.slice(0, 50);

          // Track parsing completion
          let parsedCount = 0;
          const totalEmails = limitedResults.length;

          const fetch = imap.fetch(limitedResults, { bodies: '', markSeen: false });

          fetch.on('message', (msg, seqno) => {
            let body = '';
            let attributes = null;

            msg.on('body', (stream, info) => {
              let buffer = '';
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });

              stream.once('end', () => {
                body = buffer;
              });
            });

            msg.once('attributes', (attrs) => {
              attributes = attrs;
            });

            msg.once('end', () => {
              // Parse the email
              simpleParser(body, (err, parsed) => {
                if (err) {
                  console.error('Error parsing email:', err);
                  parsedCount++;

                  // Check if all emails are processed
                  if (parsedCount === totalEmails) {
                    imap.end();
                    resolve(emails);
                  }
                  return;
                }

                emails.push({
                  id: attributes.uid,
                  subject: parsed.subject || 'No Subject',
                  from: parsed.from?.text || 'Unknown Sender',
                  date: parsed.date || new Date(),
                  body: parseEmailBody(parsed.text || parsed.html || ''),
                  attributes,
                });

                parsedCount++;

                // Check if all emails are processed
                if (parsedCount === totalEmails) {
                  imap.end();
                  resolve(emails);
                }
              });
            });
          });

          fetch.once('error', (err) => {
            reject(err);
          });
        });
      });
    });

    imap.once('error', (err) => {
      reject(err);
    });

    imap.connect();
  });
}
