// Example frontend call — no API keys here, ever.
// Swap `provider` to "openai" or "anthropic" per request.

async function askLLM(userText, provider = "anthropic") {
  const res = await fetch("https://llm-proxy-worker.<your-subdomain>.workers.dev/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      messages: [{ role: "user", content: userText }],
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Request failed");
  }

  const data = await res.json();
  return data.content;
}

// Usage:
// const reply = await askLLM("Summarize this trade dataset...", "anthropic");
