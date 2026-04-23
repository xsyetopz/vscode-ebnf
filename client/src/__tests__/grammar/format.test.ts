import { describe, expect, test } from "bun:test";
import { formatProductionGrammarDocument } from "../../grammar/format.ts";

const config = {
	alignEquals: true,
	alignProductionNumbers: true,
	alternativeIndent: "align" as const,
	blankLinesBetweenRules: 1,
	breakAlternatives: "always" as const,
	continuationIndent: 4,
	insertFinalNewline: true,
	maxLineLength: 80,
	preserveCommentSpacing: true,
	spaceBeforeInlineComment: 2,
	trimTrailingBlankLines: true,
};

describe("production grammar formatter", () => {
	test("aligns BNF assignments and breaks top-level alternatives", () => {
		const formatted = formatProductionGrammarDocument(
			'<value> ::= <object> | <array> | <string>\n<longer-name> ::= "x"\n',
			"bnf",
			config,
		);
		expect(formatted).toContain(
			"<value>       ::= <object>\n                  | <array>\n                  | <string>",
		);
		expect(formatted).toContain('<longer-name> ::= "x"');
	});

	test("keeps nested EBNF choices inline", () => {
		const formatted = formatProductionGrammarDocument(
			'char ::= unescaped | "\\\\" ("quote" | "/")\n',
			"ebnf",
			config,
		);
		expect(formatted).toContain(
			'char ::= unescaped\n         | "\\\\" ("quote" | "/")',
		);
	});

	test("aligns RBNF names with spaces", () => {
		const formatted = formatProductionGrammarDocument(
			'<JSON text> ::= <WS> <value> <WS>\n<digit one through nine> ::= "1" | "2"\n',
			"rbnf",
			config,
		);
		expect(formatted).toContain(
			"<JSON text>              ::= <WS> <value> <WS>",
		);
		expect(formatted).toContain(
			'<digit one through nine> ::= "1"\n                             | "2"',
		);
	});

	test("can disable EBNF production number alignment", () => {
		const formatted = formatProductionGrammarDocument(
			"[1] document ::= prolog element\n[123] content ::= CharData\n",
			"ebnf",
			{ ...config, alignProductionNumbers: false, breakAlternatives: "never" },
		);
		expect(formatted).toContain("[1] document ::= prolog element");
		expect(formatted).toContain("[123] content");
		expect(formatted).toContain("::= CharData");
	});

	test("trims trailing blank lines and normalizes inline comment spacing", () => {
		const formatted = formatProductionGrammarDocument(
			"value ::= item;note\n\n\n",
			"bnf",
			config,
		);
		expect(formatted).toBe("value ::= item  ;note\n");
	});
});
