import { beforeAll, describe, expect, test } from "bun:test";
import "../vscode-mock.ts";

let grammar: typeof import("../../grammar/grammar.ts");
let diagnostics: typeof import("../../grammar/diagnostics.ts");

beforeAll(async () => {
	grammar = await import("../../grammar/grammar.ts");
	diagnostics = await import("../../grammar/diagnostics.ts");
});

describe("grammar diagnostics", () => {
	test("rejects ISO-style EBNF assignment", () => {
		const document = grammar.parseGrammar("syntax = rule ;\n", "ebnf");
		expect(
			document.diagnostics.some((diagnostic) =>
				diagnostic.message.includes("ISO/IEC 14977"),
			),
		).toBe(true);
	});

	test("reports undefined references", () => {
		const text = "root ::= missing\n";
		const document = grammar.parseGrammar(text, "ebnf");
		const symbolTable = grammar.buildGrammarSymbolTable(document, "ebnf");
		const result = { dialect: "ebnf" as const, document, symbolTable };
		expect(
			diagnostics
				.collectGrammarDiagnostics(result, text, { unusedRules: false })
				.some((diagnostic) => diagnostic.message.includes("missing")),
		).toBe(true);
	});
});
