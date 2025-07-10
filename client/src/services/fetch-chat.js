        const BASE_URL = process.env.REACT_APP_BASE_URL;


export   async function sendPrompt(input, setLog, setInput, setLoading, setContextPercent) {
    if (!input.trim()) return;
    const userMsg = input;
    setLog(l => [...l, { text: userMsg, role: 'user' }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/chat`, {
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