import { describe, expect, test } from "bun:test";

const SYNTAX_FILES = [
	"syntaxes/abnf.tmLanguage.json",
	"syntaxes/bnf.tmLanguage.json",
	"syntaxes/ebnf.tmLanguage.json",
	"syntaxes/rbnf.tmLanguage.json",
] as const;

describe("grammar syntax definitions", () => {
	test("all tmLanguage files parse as JSON", async () => {
		for (const path of SYNTAX_FILES) {
			const text = await Bun.file(path).text();
			expect(() => JSON.parse(text)).not.toThrow();
		}
	});

	test("ABNF syntax covers numeric and repetition repositories", async () => {
		const grammar = JSON.parse(
			await Bun.file("syntaxes/abnf.tmLanguage.json").text(),
		) as {
			repository: Record<string, unknown>;
		};

		expect(grammar.repository["numeric-value"]).toBeDefined();
		expect(grammar.repository["repetition-bounded"]).toBeDefined();
		expect(grammar.repository["comment"]).toBeDefined();
	});

	test("EBNF syntax covers comments, character syntax, and identifiers", async () => {
		const grammar = JSON.parse(
			await Bun.file("syntaxes/ebnf.tmLanguage.json").text(),
		) as {
			repository: Record<string, unknown>;
		};

		expect(grammar.repository["comment"]).toBeDefined();
		expect(grammar.repository["expression"]).toBeDefined();
		expect(JSON.stringify(grammar.repository["expression"])).toContain(
			"character-class",
		);
		expect(JSON.stringify(grammar.repository["expression"])).toContain(
			"character-code",
		);
	});

	test("BNF and RBNF syntax expose modular operator and literal repositories", async () => {
		for (const path of [
			"syntaxes/bnf.tmLanguage.json",
			"syntaxes/rbnf.tmLanguage.json",
		] as const) {
			const grammar = JSON.parse(await Bun.file(path).text()) as {
				repository: Record<string, unknown>;
			};

			expect(grammar.repository["comment"]).toBeDefined();
			expect(grammar.repository["double-string"]).toBeDefined();
			expect(grammar.repository["single-string"]).toBeDefined();
			expect(grammar.repository["alternation"]).toBeDefined();
			expect(grammar.repository["suffix-repetition"]).toBeDefined();
			expect(grammar.repository["identifier"]).toBeDefined();
		}
	});

	test("mixed inline comment patterns remain present near operators and literals", async () => {
		const bnf = JSON.parse(
			await Bun.file("syntaxes/bnf.tmLanguage.json").text(),
		) as {
			repository: Record<string, { match?: string; begin?: string }>;
		};
		const ebnf = JSON.parse(
			await Bun.file("syntaxes/ebnf.tmLanguage.json").text(),
		) as {
			repository: Record<string, { match?: string; begin?: string }>;
		};
		const rbnf = JSON.parse(
			await Bun.file("syntaxes/rbnf.tmLanguage.json").text(),
		) as {
			repository: Record<string, { match?: string; begin?: string }>;
		};

		expect(
			new RegExp(bnf.repository["comment"]?.begin ?? "").test("; note"),
		).toBe(true);
		expect(
			new RegExp(bnf.repository["alternation"]?.match ?? "").test("|"),
		).toBe(true);
		expect(
			new RegExp(bnf.repository["suffix-repetition"]?.match ?? "").test("+"),
		).toBe(true);
		expect(
			new RegExp(ebnf.repository["comment"]?.begin ?? "").test("/* note */"),
		).toBe(true);
		expect(
			new RegExp(ebnf.repository["character-class"]?.match ?? "").test(
				"[#x20-#x21]",
			),
		).toBe(true);
		expect(
			new RegExp(rbnf.repository["repetition-range"]?.match ?? "").test("1*2"),
		).toBe(true);
	});

	test("concrete mixed sample lines match expected BNF repositories", async () => {
		const grammar = JSON.parse(
			await Bun.file("syntaxes/bnf.tmLanguage.json").text(),
		) as {
			repository: Record<string, { match?: string; begin?: string }>;
		};
		const sample = '<value> ::= "x" | <name> ; note';

		expect(
			new RegExp(grammar.repository["double-string"]?.begin ?? "").test(sample),
		).toBe(true);
		expect(
			new RegExp(grammar.repository["alternation"]?.match ?? "").test(sample),
		).toBe(true);
		expect(
			new RegExp(grammar.repository["comment"]?.begin ?? "").test(sample),
		).toBe(true);
		expect(
			new RegExp(grammar.repository["identifier"]?.match ?? "").test(sample),
		).toBe(true);
	});

	test("concrete mixed sample lines match expected EBNF repositories", async () => {
		const grammar = JSON.parse(
			await Bun.file("syntaxes/ebnf.tmLanguage.json").text(),
		) as {
			repository: Record<string, { match?: string; begin?: string }>;
		};
		const sample = 'token ::= ("a" | "b")+ /* note */ next [#x20-#x21]';

		expect(
			new RegExp(grammar.repository["double-string"]?.begin ?? "").test(sample),
		).toBe(true);
		expect(
			new RegExp(grammar.repository["alternation"]?.match ?? "").test(sample),
		).toBe(true);
		expect(
			new RegExp(grammar.repository["suffix-repetition"]?.match ?? "").test(
				sample,
			),
		).toBe(true);
		expect(
			new RegExp(grammar.repository["comment"]?.begin ?? "").test(sample),
		).toBe(true);
		expect(
			new RegExp(grammar.repository["character-class"]?.match ?? "").test(
				sample,
			),
		).toBe(true);
	});

	test("concrete mixed sample lines match expected RBNF repositories", async () => {
		const grammar = JSON.parse(
			await Bun.file("syntaxes/rbnf.tmLanguage.json").text(),
		) as {
			repository: Record<string, { match?: string; begin?: string }>;
		};
		const sample = '<A rule> ::= 1*2<other> | "x" ; note';

		expect(
			new RegExp(grammar.repository["repetition-prefix"]?.match ?? "").test(
				sample,
			),
		).toBe(true);
		expect(
			new RegExp(grammar.repository["repetition-range"]?.match ?? "").test(
				sample,
			),
		).toBe(true);
		expect(
			new RegExp(grammar.repository["double-string"]?.begin ?? "").test(sample),
		).toBe(true);
		expect(
			new RegExp(grammar.repository["alternation"]?.match ?? "").test(sample),
		).toBe(true);
		expect(
			new RegExp(grammar.repository["comment"]?.begin ?? "").test(sample),
		).toBe(true);
	});
});
