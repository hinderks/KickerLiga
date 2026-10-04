// demos/vl02/tokens.ts
// Splits a file into tokens with the tokenizer of the lab model and prints them.
// Usage: TOKENIZER=<hugging face repo of the lab model> npx tsx demos/vl02/tokens.ts <file>
// Needs: npm i -D @huggingface/transformers tsx (downloads only tokenizer files, not the weights)

import { readFileSync } from "node:fs";
import { AutoTokenizer } from "@huggingface/transformers";

const repo = process.env.TOKENIZER ?? "";
const file = process.argv[2] ?? "";
if (!repo || !file) {
  console.error("Usage: TOKENIZER=<repo> npx tsx demos/vl02/tokens.ts <file>");
  process.exit(1);
}

const text = readFileSync(file, "utf8");
const tokenizer = await AutoTokenizer.from_pretrained(repo);
const ids: number[] = tokenizer.encode(text);

// Decode every id on its own so the token boundaries become visible.
const pieces = ids.map((id) => tokenizer.decode([id]));
console.log(pieces.map((p) => p.replace(/\n/g, "\\n")).join("|"));
console.log(`\n${text.length} characters, ${ids.length} tokens, ${(text.length / ids.length).toFixed(2)} characters per token`);
