import { describe, expect, test } from "bun:test";
import "../vscode-mock.ts";
import {
	getSyntaxDetailInlays,
	getSyntaxHover,
} from "../../grammar/syntax-details.ts";

describe("grammar syntax details", () => {
	test("describes ABNF numeric terminals and repetitions", () => {
		const numericHover = getSyntaxHover(
			"rule = %x41-5A / 1*2ALPHA",
			0,
			8,
			"abnf",
		);
		const repeatHover = getSyntaxHover(
			"rule = %x41-5A / 1*2ALPHA",
			0,
			18,
			"abnf",
		);

		expect(
			(numericHover?.contents as unknown as { value: string }).value,
		).toContain("hexadecimal range");
		expect(
			(repeatHover?.contents as unknown as { value: string }).value,
		).toContain("bounded repetition");
	});

	test("describes EBNF suffix and character syntax", () => {
		const suffixHover = getSyntaxHover("item ::= name+", 0, 13, "ebnf");
		const charHover = getSyntaxHover("char ::= [#x20-#x21]", 0, 10, "ebnf");

		expect(
			(suffixHover?.contents as unknown as { value: string }).value,
		).toContain("One-or-more suffix");
		expect(
			(charHover?.contents as unknown as { value: string }).value,
		).toContain("character class");
	});

	test("emits sparse syntax-detail inlays", () => {
		const hints = getSyntaxDetailInlays(
			0,
			6,
			'%x41-5A / %i"abc" / 1*2ALPHA',
			"abnf",
		);

		expect(hints).toHaveLength(1);
		expect((hints[0]?.label as string) || "").toContain("range");
		expect((hints[0]?.label as string) || "").toContain("case-insensitive");
	});

	test("uses unified group delimiter wording across dialects", () => {
		const bnfHover = getSyntaxHover("rule ::= (<a>)", 0, 9, "bnf");
		const ebnfHover = getSyntaxHover("rule ::= {name}", 0, 9, "ebnf");
		const rbnfHover = getSyntaxHover("<rule> ::= [name]", 0, 11, "rbnf");

		expect(
			(bnfHover?.contents as unknown as { value: string }).value,
		).toContain("group delimiter");
		expect(
			(ebnfHover?.contents as unknown as { value: string }).value,
		).toContain("group delimiter");
		expect(
			(rbnfHover?.contents as unknown as { value: string }).value,
		).toContain("group delimiter");
	});
});
