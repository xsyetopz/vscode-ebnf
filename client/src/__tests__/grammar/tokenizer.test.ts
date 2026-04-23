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
			tokens.some((token) => token.kind === "number" && token.text === "%x41"),
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
