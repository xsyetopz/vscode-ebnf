import { describe, expect, test } from "bun:test";
import { tokenizeGrammar } from "../../grammar/tokenizer.ts";

describe("grammar tokenizer", () => {
	test("tokenizes ABNF-specific forms", () => {
		const tokens = tokenizeGrammar('rule =/ %x41 / %s"A"\n', "abnf");
		expect(
			tokens.some(
				(token) => token.kind === "assignment" && token.text === "=/",
			),
		).toBe(true);
		expect(
			tokens.some(
				(token) => token.kind === "charCode" && token.text === "%x41",
			),
		).toBe(true);
		expect(
			tokens.some(
				(token) => token.kind === "literal" && token.text === '%s"A"',
			),
		).toBe(true);
	});

	test("tokenizes EBNF production decorations", () => {
		const tokens = tokenizeGrammar(
			"[1] value ::= string? /* note */\n",
			"ebnf",
		);
		expect(
			tokens.some(
				(token) => token.kind === "ruleName" && token.text === "value",
			),
		).toBe(true);
		expect(
			tokens.some(
				(token) => token.kind === "assignment" && token.text === "::=",
			),
		).toBe(true);
		expect(
			tokens.some((token) => token.kind === "repeat" && token.text === "?"),
		).toBe(true);
	});

	test("does not tokenize W3C EBNF character literals as references", () => {
		const tokens = tokenizeGrammar(
			"unescaped ::= [#x20-#x21] | [a-zA-Z] | [^#x0-#x8] | real\n",
			"ebnf",
		);
		const references = tokens
			.filter((token) => token.kind === "reference")
			.map((token) => token.text);

		expect(references).toContain("real");
		expect(references).not.toContain("x20");
		expect(references).not.toContain("a-zA-Z");
	});

	test("tokenizes production comments, numbers, and EBNF character syntax", () => {
		const tokens = tokenizeGrammar(
			"/* note */\n[1] char ::= [#x20-#x21] | #xA ; trailing\n",
			"ebnf",
		);

		expect(tokens.some((token) => token.kind === "comment")).toBe(true);
		expect(
			tokens.some((token) => token.kind === "number" && token.text === "[1]"),
		).toBe(true);
		expect(
			tokens.some(
				(token) => token.kind === "charClass" && token.text === "[#x20-#x21]",
			),
		).toBe(true);
		expect(
			tokens.some((token) => token.kind === "charCode" && token.text === "#xA"),
		).toBe(true);
	});

	test("keeps RBNF spaced name atomic", () => {
		const tokens = tokenizeGrammar(
			"<WF flow descriptor> ::= <FLOWSPEC>\n",
			"rbnf",
		);
		expect(tokens.find((token) => token.kind === "ruleName")?.text).toBe(
			"<WF flow descriptor>",
		);
	});
});
