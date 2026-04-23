import { beforeAll, describe, expect, test } from "bun:test";
import "../vscode-mock.ts";

let grammar: typeof import("../../grammar/grammar.ts");

beforeAll(async () => {
	grammar = await import("../../grammar/grammar.ts");
});

describe("grammar parser", () => {
	test("parses W3C XML EBNF productions", () => {
		const doc = grammar.parseGrammar(
			"[1] document ::= prolog element Misc*\n[2] prolog ::= XMLDecl? Misc*\n",
			"ebnf",
		);
		expect(doc.rules.map((rule) => rule.name)).toEqual(["document", "prolog"]);
	});

	test("parses W3C BNF productions", () => {
		const doc = grammar.parseGrammar(
			`<expr> ::= <term> | <expr> "+" <term>\n<term> ::= "n"\n`,
			"bnf",
		);
		expect(doc.rules.map((rule) => rule.name)).toEqual(["<expr>", "<term>"]);
	});

	test("JSON examples parse for each matching dialect", async () => {
		const examples = [
			["examples/json.abnf", "abnf", "json-text"],
			["examples/json.bnf", "bnf", "<json-text>"],
			["examples/json.ebnf", "ebnf", "json-text"],
			["examples/json.rbnf", "rbnf", "<JSON text>"],
		] as const;
		for (const [path, dialect, firstRule] of examples) {
			const doc = grammar.parseGrammar(await Bun.file(path).text(), dialect);
			expect(doc.rules.length).toBeGreaterThan(10);
			expect(doc.rules[0]?.name).toBe(firstRule);
		}
	});
});
