import { describe, expect, test } from "bun:test";
import {
	GRAMMAR_DIALECTS,
	GRAMMAR_LANGUAGE_IDS,
} from "../../grammar/grammar.ts";
import { GRAMMAR_STANDARDS } from "../../grammar/standards.ts";

describe("grammar standards", () => {
	test("registry contains four supported dialects", () => {
		expect(GRAMMAR_LANGUAGE_IDS).toEqual(["abnf", "bnf", "ebnf", "rbnf"]);
		expect(
			GRAMMAR_DIALECTS.map((dialect) => dialect.assignmentOperator),
		).toEqual(["=", "::=", "::=", "::="]);
	});

	test("each standard has source URL and example", () => {
		for (const dialect of GRAMMAR_LANGUAGE_IDS) {
			const standard = GRAMMAR_STANDARDS[dialect];
			expect(standard.url).toStartWith("http");
			expect(standard.exampleFile).toEndWith(`.${dialect}`);
		}
	});
});
