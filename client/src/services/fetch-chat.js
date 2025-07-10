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
        body: JSON.stringify({ msg: userMsg, userId: '1' }) //the point of this local, no need for sign in/ user id, userId default to 1
      });
      const { bot, context_percent } = await res.json();
      setLog(l => [...l, { text: bot, role: 'bot' }]);
      if (context_percent !== undefined && context_percent !== null) {
        setContextPercent(Number(context_percent));
      }
    } finally {
      setLoading(false);
    }
  }