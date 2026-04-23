import { describe, expect, test } from "bun:test";
import {
	type AbnfFormatterConfig,
	formatAbnfDocument,
} from "../abnf-format.ts";

const RULE_DEFINITION_RE = /^[A-Za-z][A-Za-z0-9-]*\s*=\/?/;

function defaultConfig(
	overrides?: Partial<AbnfFormatterConfig>,
): AbnfFormatterConfig {
	return {
		alignEquals: true,
		continuationIndent: 4,
		alternativeIndent: "align",
		insertFinalNewline: true,
		blankLinesBetweenRules: 1,
		breakAlternatives: "always",
		maxLineLength: 80,
		preserveContinuationLineBreaks: false,
		spaceBeforeInlineComment: 2,
		...overrides,
	};
}

function ruleBodyLines(formatted: string): string[] {
	const lines = formatted.replace(/\r\n/g, "\n").split("\n");
	const body: string[] = [];
	let inRule = false;

	for (const line of lines) {
		if (RULE_DEFINITION_RE.test(line)) {
			inRule = true;
			continue;
		}
		if (!inRule) {
			continue;
		}
		if (line.trim().length === 0) {
			inRule = false;
			continue;
		}
		if (RULE_DEFINITION_RE.test(line)) {
			inRule = true;
			continue;
		}
		if (line.startsWith(";")) {
			inRule = false;
			continue;
		}
		body.push(line);
	}

	return body;
}

describe("ABNF formatter", () => {
	test("multiline alternatives default", () => {
		const input = "r = a / b / c\n";
		const formatted = formatAbnfDocument(input, defaultConfig());
		expect(formatted).toContain("\n");
		expect(formatted).toContain("/ ");
		const body = ruleBodyLines(formatted);
		for (const line of body) {
			expect(line.startsWith(" ")).toBe(true);
		}
	});

	test("auto alternatives inline when it fits", () => {
		const input = "r = a / b / c\n";
		const formatted = formatAbnfDocument(
			input,
			defaultConfig({ breakAlternatives: "auto", maxLineLength: 80 }),
		);
		expect(formatted.trimEnd()).toBe("r = a / b / c");
	});

	test("wrap long concatenations and keep continuation indented", () => {
		const input =
			"rule = a b c d e f g h i j k l m n o p q r s t u v w x y z\n";
		const formatted = formatAbnfDocument(
			input,
			defaultConfig({ breakAlternatives: "never", maxLineLength: 40 }),
		);
		const lines = formatted.trimEnd().split("\n");
		expect(lines.length).toBeGreaterThan(1);
		for (let i = 1; i < lines.length; i++) {
			expect(lines[i]?.startsWith(" ")).toBe(true);
		}
	});

	test("preserve continuation line breaks when enabled", () => {
		const input = "r = a b\n    c d\n";
		const formatted = formatAbnfDocument(
			input,
			defaultConfig({
				preserveContinuationLineBreaks: true,
				breakAlternatives: "never",
			}),
		);
		expect(formatted).toContain("\n");
		const lines = formatted.trimEnd().split("\n");
		expect(lines.length).toBe(2);
		expect(lines[1]?.startsWith(" ")).toBe(true);
	});

	test("inline comment forces following tokens onto next line", () => {
		const input = "r = a ; comment\n    b\n";
		const formatted = formatAbnfDocument(
			input,
			defaultConfig({ breakAlternatives: "never" }),
		);
		const lines = formatted.trimEnd().split("\n");
		expect(lines.length).toBe(2);
		expect(lines[0]).toContain("; comment");
		expect(lines[0]).not.toContain(" b");
		expect(lines[1]?.trimStart()).toBe("b");
	});

	test("configurable blank lines between rules", () => {
		const input = "a = b\nc = d\n";
		const formatted = formatAbnfDocument(
			input,
			defaultConfig({ blankLinesBetweenRules: 2 }),
		);
		const lines = formatted.replace(/\r\n/g, "\n").trimEnd().split("\n");
		expect(lines[1]).toBe("");
		expect(lines[2]).toBe("");
	});
});
