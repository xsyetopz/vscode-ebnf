import { Hover, InlayHint, InlayHintKind, MarkdownString, Range } from "vscode";
import type { GrammarDialect } from "./dialects.ts";

const EBNF_CHAR_CLASS_RE = /\[(?:\^)?[^\]\r\n]*\]/g;
const EBNF_CHAR_CODE_RE = /#x[0-9A-Fa-f]+/g;
const ABNF_NUMERIC_RE =
	/%[xXdDbB][0-9A-Fa-f]+(?:(?:-[0-9A-Fa-f]+)|(?:\.[0-9A-Fa-f]+)+)?/g;
const ABNF_REPEAT_RE = /\d*\*\d*/g;
const SUFFIX_REPEAT_RE = /[?+*]/g;
const ABNF_HEX_RE = /%[xX]/;
const ABNF_DECIMAL_RE = /%[dD]/;
const ABNF_BINARY_RE = /%[bB]/;
const ABNF_RANGE_RE = /-/;
const ABNF_SEQUENCE_RE = /\./;
const ABNF_CASE_SENSITIVE_RE = /%[sS]"/;
const ABNF_CASE_INSENSITIVE_RE = /%[iI]"/;
const ABNF_OPTIONAL_RE = /\[\s*[^\]]+\]/;
const ABNF_REPEAT_HINT_RE = /\d*\*\d*/;
const OPTIONAL_SUFFIX_RE = /\?/;
const ZERO_OR_MORE_SUFFIX_RE = /\*/;
const ONE_OR_MORE_SUFFIX_RE = /\+/;

interface SyntaxMatch {
	range: Range;
	markdown: string;
}

type SyntaxLabelMatcher = {
	label: string;
	pattern: RegExp;
};

const ABNF_SYNTAX_LABELS: readonly SyntaxLabelMatcher[] = [
	{ label: "hex", pattern: ABNF_HEX_RE },
	{ label: "decimal", pattern: ABNF_DECIMAL_RE },
	{ label: "binary", pattern: ABNF_BINARY_RE },
	{ label: "case-sensitive", pattern: ABNF_CASE_SENSITIVE_RE },
	{ label: "case-insensitive", pattern: ABNF_CASE_INSENSITIVE_RE },
	{ label: "optional", pattern: ABNF_OPTIONAL_RE },
	{ label: "repetition", pattern: ABNF_REPEAT_HINT_RE },
] as const;

const PRODUCTION_SYNTAX_LABELS: readonly SyntaxLabelMatcher[] = [
	{ label: "optional", pattern: OPTIONAL_SUFFIX_RE },
	{ label: "zero-or-more", pattern: ZERO_OR_MORE_SUFFIX_RE },
	{ label: "one-or-more", pattern: ONE_OR_MORE_SUFFIX_RE },
] as const;

function groupDelimiterMarkdown(
	dialect: GrammarDialect,
	delimiter: string,
	label: string,
	detail: string,
): string {
	return `**${dialect.toUpperCase()} ${label}**\n\n\`${delimiter}\` ${detail}`;
}

const DIALECT_GROUP_MARKDOWN: Record<
	GrammarDialect,
	Partial<Record<string, string>>
> = {
	abnf: {
		"(": groupDelimiterMarkdown(
			"abnf",
			"(",
			"group delimiter",
			"groups subexpressions.",
		),
		")": groupDelimiterMarkdown(
			"abnf",
			")",
			"group delimiter",
			"groups subexpressions.",
		),
		"[": groupDelimiterMarkdown(
			"abnf",
			"[",
			"optional group delimiter",
			"encloses an optional subexpression.",
		),
		"]": groupDelimiterMarkdown(
			"abnf",
			"]",
			"optional group delimiter",
			"encloses an optional subexpression.",
		),
	},
	bnf: {
		"(": groupDelimiterMarkdown(
			"bnf",
			"(",
			"group delimiter",
			"is a grammar grouping delimiter.",
		),
		")": groupDelimiterMarkdown(
			"bnf",
			")",
			"group delimiter",
			"is a grammar grouping delimiter.",
		),
		"[": groupDelimiterMarkdown(
			"bnf",
			"[",
			"group delimiter",
			"is a grammar grouping delimiter.",
		),
		"]": groupDelimiterMarkdown(
			"bnf",
			"]",
			"group delimiter",
			"is a grammar grouping delimiter.",
		),
		"{": groupDelimiterMarkdown(
			"bnf",
			"{",
			"group delimiter",
			"is a grammar grouping delimiter.",
		),
		"}": groupDelimiterMarkdown(
			"bnf",
			"}",
			"group delimiter",
			"is a grammar grouping delimiter.",
		),
	},
	ebnf: {
		"(": groupDelimiterMarkdown(
			"ebnf",
			"(",
			"group delimiter",
			"groups subexpressions before suffix operators.",
		),
		")": groupDelimiterMarkdown(
			"ebnf",
			")",
			"group delimiter",
			"groups subexpressions before suffix operators.",
		),
		"[": groupDelimiterMarkdown(
			"ebnf",
			"[",
			"character class delimiter",
			"participates in W3C XML character class syntax.",
		),
		"]": groupDelimiterMarkdown(
			"ebnf",
			"]",
			"character class delimiter",
			"participates in W3C XML character class syntax.",
		),
		"{": groupDelimiterMarkdown(
			"ebnf",
			"{",
			"group delimiter",
			"is a grammar grouping delimiter.",
		),
		"}": groupDelimiterMarkdown(
			"ebnf",
			"}",
			"group delimiter",
			"is a grammar grouping delimiter.",
		),
	},
	rbnf: {
		"(": groupDelimiterMarkdown(
			"rbnf",
			"(",
			"group delimiter",
			"is a grammar grouping delimiter.",
		),
		")": groupDelimiterMarkdown(
			"rbnf",
			")",
			"group delimiter",
			"is a grammar grouping delimiter.",
		),
		"[": groupDelimiterMarkdown(
			"rbnf",
			"[",
			"group delimiter",
			"is a grammar grouping delimiter.",
		),
		"]": groupDelimiterMarkdown(
			"rbnf",
			"]",
			"group delimiter",
			"is a grammar grouping delimiter.",
		),
		"{": groupDelimiterMarkdown(
			"rbnf",
			"{",
			"group delimiter",
			"is a grammar grouping delimiter.",
		),
		"}": groupDelimiterMarkdown(
			"rbnf",
			"}",
			"group delimiter",
			"is a grammar grouping delimiter.",
		),
	},
};

/**
 * Returns syntax hover details for lexical grammar constructs.
 */
export function getSyntaxHover(
	text: string,
	line: number,
	character: number,
	dialect: GrammarDialect,
): Hover | undefined {
	for (const match of collectSyntaxMatches(text, line, dialect)) {
		if (
			character >= match.range.start.character &&
			character <= match.range.end.character
		) {
			return new Hover(new MarkdownString(match.markdown), match.range);
		}
	}
	return undefined;
}

/**
 * Returns sparse syntax-detail inlays for one rule definition.
 */
export function getSyntaxDetailInlays(
	line: number,
	character: number,
	body: string,
	dialect: GrammarDialect,
): InlayHint[] {
	const labels = syntaxDetailLabels(body, dialect);
	if (labels.length === 0) {
		return [];
	}
	const hint = new InlayHint(
		new Range(line, character, line, character).end,
		` ${labels.join(", ")}`,
		InlayHintKind.Parameter,
	);
	hint.paddingLeft = true;
	return [hint];
}

function syntaxDetailLabels(body: string, dialect: GrammarDialect): string[] {
	const labels = new Set<string>(
		collectPatternLabels(body, baseLabelMatchers(dialect)),
	);
	if (dialect === "abnf") {
		addAbnfTerminalLabels(labels, body);
	} else if (dialect === "ebnf" && EBNF_CHAR_CLASS_RE.test(body)) {
		labels.add("character-class");
		EBNF_CHAR_CLASS_RE.lastIndex = 0;
	}
	return Array.from(labels);
}

function baseLabelMatchers(
	dialect: GrammarDialect,
): readonly SyntaxLabelMatcher[] {
	return dialect === "abnf" ? ABNF_SYNTAX_LABELS : PRODUCTION_SYNTAX_LABELS;
}

function collectPatternLabels(
	body: string,
	matchers: readonly SyntaxLabelMatcher[],
): string[] {
	return matchers
		.filter(({ pattern }) => pattern.test(body))
		.map(({ label }) => label);
}

function addAbnfTerminalLabels(labels: Set<string>, body: string): void {
	if (ABNF_RANGE_RE.test(body) && ABNF_NUMERIC_RE.test(body)) {
		labels.add("range");
	}
	ABNF_NUMERIC_RE.lastIndex = 0;
	if (ABNF_SEQUENCE_RE.test(body) && ABNF_NUMERIC_RE.test(body)) {
		labels.add("sequence");
	}
	ABNF_NUMERIC_RE.lastIndex = 0;
}

function collectSyntaxMatches(
	text: string,
	line: number,
	dialect: GrammarDialect,
): SyntaxMatch[] {
	return [
		...collectMatches(
			text,
			line,
			ABNF_NUMERIC_RE,
			(match) => abnfNumericMarkdown(match),
			dialect === "abnf",
		),
		...collectMatches(
			text,
			line,
			ABNF_REPEAT_RE,
			(match) => repetitionMarkdown(match, dialect),
			dialect === "abnf",
		),
		...collectMatches(
			text,
			line,
			SUFFIX_REPEAT_RE,
			(match) => repetitionMarkdown(match, dialect),
			dialect !== "abnf",
		),
		...collectMatches(
			text,
			line,
			EBNF_CHAR_CLASS_RE,
			(match) =>
				`**W3C XML EBNF character class**\n\n\`${match}\` is terminal character syntax, not a rule reference.`,
			dialect === "ebnf",
		),
		...collectMatches(
			text,
			line,
			EBNF_CHAR_CODE_RE,
			(match) =>
				`**W3C XML EBNF character code**\n\n\`${match}\` is terminal character syntax, not a rule reference.`,
			dialect === "ebnf",
		),
		...collectGroupMatches(text, line, dialect),
	];
}

function collectMatches(
	text: string,
	line: number,
	pattern: RegExp,
	render: (match: string) => string,
	enabled: boolean,
): SyntaxMatch[] {
	if (!enabled) {
		return [];
	}
	const matches: SyntaxMatch[] = [];
	for (const match of text.matchAll(pattern)) {
		const value = match[0] ?? "";
		const start = match.index ?? 0;
		matches.push({
			range: new Range(line, start, line, start + value.length),
			markdown: render(value),
		});
	}
	pattern.lastIndex = 0;
	return matches;
}

function collectGroupMatches(
	text: string,
	line: number,
	dialect: GrammarDialect,
): SyntaxMatch[] {
	const matches: SyntaxMatch[] = [];
	for (let i = 0; i < text.length; i++) {
		const markdown = DIALECT_GROUP_MARKDOWN[dialect][text[i] ?? ""];
		if (!markdown) {
			continue;
		}
		matches.push({
			range: new Range(line, i, line, i + 1),
			markdown,
		});
	}
	return matches;
}

function abnfNumericMarkdown(match: string): string {
	const base = match[1]?.toLowerCase();
	const baseName =
		base === "x" ? "hexadecimal" : base === "d" ? "decimal" : "binary";
	const body = match.slice(2);
	if (body.includes("-")) {
		return `**ABNF ${baseName} range**\n\n\`${match}\` matches a numeric terminal range.`;
	}
	if (body.includes(".")) {
		return `**ABNF ${baseName} sequence**\n\n\`${match}\` matches a dotted numeric terminal sequence.`;
	}
	return `**ABNF ${baseName} terminal**\n\n\`${match}\` matches one numeric terminal value.`;
}

function repetitionMarkdown(match: string, dialect: GrammarDialect): string {
	if (dialect === "abnf") {
		const [minText, maxText] = match.split("*");
		if (minText && maxText) {
			return `**ABNF bounded repetition**\n\n\`${match}\` repeats from ${minText} to ${maxText} times.`;
		}
		if (minText) {
			return `**ABNF minimum repetition**\n\n\`${match}\` repeats ${minText} or more times.`;
		}
		if (maxText) {
			return `**ABNF maximum repetition**\n\n\`${match}\` repeats up to ${maxText} times.`;
		}
		return `**ABNF repetition**\n\n\`${match}\` repeats zero or more times.`;
	}
	if (match === "?") {
		return `**Optional suffix**\n\n\`${match}\` marks zero or one occurrence.`;
	}
	if (match === "+") {
		return `**One-or-more suffix**\n\n\`${match}\` marks one or more occurrences.`;
	}
	return `**Zero-or-more suffix**\n\n\`${match}\` marks zero or more occurrences.`;
}
