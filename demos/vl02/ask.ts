// demos/vl02/ask.ts
// One bare model call through OpenRouter, no agent, no tools: shows what goes in and what comes out.
// Usage: npx tsx demos/vl02/ask.ts "<prompt>" [temperature]
// Env: OPENROUTER_API_KEY (required), MODEL (default qwen/qwen3-coder),
//      OPENROUTER_URL (default https://openrouter.ai/api)
// OpenRouter forwards logprobs/top_logprobs to the provider. The provider is pinned to Alibaba
// (Qwen's own service): in a test run on 04.10.2026 the Google provider returned misaligned
// top_logprobs, Alibaba returned clean ones. Override with PROVIDER=<name> if needed
// (openrouter.ai/docs/api/reference, retrieved 04.10.2026). The block is printed only if present.

export {}; // make this file a module so top-level await works

const url = process.env.OPENROUTER_URL ?? "https://openrouter.ai/api";
const key = process.env.OPENROUTER_API_KEY ?? "";
const model = process.env.MODEL ?? "qwen/qwen3-coder";
const providerName = process.env.PROVIDER ?? "Alibaba";
const prompt = process.argv[2] ?? "";
const temperature = Number(process.argv[3] ?? "0");

if (!key || !prompt) {
  console.error('Set OPENROUTER_API_KEY and pass a prompt: npx tsx demos/vl02/ask.ts "<prompt>" [temperature]');
  process.exit(1);
}

type TopLogprob = { token: string; logprob: number };
type Logprob = TopLogprob & { top_logprobs?: TopLogprob[] };
type ChatResponse = {
  model: string;
  provider?: string;
  choices: { message: { content: string | null }; logprobs?: { content?: Logprob[] | null } }[];
  usage?: {
    prompt_tokens: number; // input tokens, counted with the model's own tokenizer
    completion_tokens: number; // output tokens, including reasoning tokens
    completion_tokens_details?: { reasoning_tokens?: number };
    cost?: number; // USD credits charged for this call
  };
};

const res = await fetch(`${url}/v1/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature,
    logprobs: true,
    top_logprobs: 5,
    provider: { order: [providerName], allow_fallbacks: false, require_parameters: true },
  }),
});
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
const data = (await res.json()) as ChatResponse;
const choice = data.choices[0];
const u = data.usage;

console.log(`--- answer (${data.model} via ${data.provider ?? "?"}) ---\n${choice.message.content ?? ""}`);
console.log(
  `\n--- tokens --- in: ${u?.prompt_tokens ?? "?"}  out: ${u?.completion_tokens ?? "?"}` +
    `  (of which reasoning: ${u?.completion_tokens_details?.reasoning_tokens ?? 0})`,
);
if (u?.cost !== undefined) {
  console.log(`--- cost --- ${u.cost.toFixed(6)} USD for this call`);
}

// Alternatives per token: only printed if the provider returns them.
const lp = choice.logprobs?.content ?? [];
if (lp.length === 0) {
  console.log("\n--- no logprobs returned by this provider ---");
} else {
  console.log("\n--- first 12 output tokens with alternatives ---");
  for (const t of lp.slice(0, 12)) {
    const alts = (t.top_logprobs ?? [])
      .map((a) => `${JSON.stringify(a.token)} ${(Math.exp(a.logprob) * 100).toFixed(1)}%`)
      .join("   ");
    console.log(`${JSON.stringify(t.token).padEnd(16)} <- ${alts}`);
  }
}
