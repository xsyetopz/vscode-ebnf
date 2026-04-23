import type { GrammarDialect } from "./dialects.ts";

/**
 * Formatting options shared by BNF, EBNF, and RBNF documents.
 */
export interface GenericGrammarFormatterConfig {
	alignEquals: boolean;
	blankLinesBetweenRules: number;
	insertFinalNewline: boolean;
}

interface ParsedFormatLine {
	line: string;
	lhs?: string;
	op?: string;
	body?: string;
}

const RULE_RE =
	/^(\s*(?:\[[^\]]+\]\s*)?(?:<[^<>\r\n]+>|[A-Za-z_][A-Za-z0-9_.:-]*)\s*)(::=)(\s*)(.*)$/;
const CRLF_RE = /\r\n/g;
const CR_RE = /\r/g;
const TRAILING_SPACE_RE = /[ \t]+$/gm;
const RBNF_ASSIGNMENT_RE = /(<[^<>\r\n]+>)\s+::=/g;

function parseFormatLine(line: string): ParsedFormatLine {
	const match = line.match(RULE_RE);
	return match
		? { line, lhs: match[1] ?? "", op: match[2] ?? "::=", body: match[4] ?? "" }
		: { line };
}

function alignedWidth(
	lines: ParsedFormatLine[],
	config: GenericGrammarFormatterConfig,
): number {
	if (!config.alignEquals) {
		return 0;
	}
	return Math.max(0, ...lines.map((line) => line.lhs?.trimEnd().length ?? 0));
}

function pushBlankLines(out: string[], count: number): void {
	for (let i = 0; i < count; i++) {
		if (out[out.length - 1] !== "") {
			out.push("");
		}
	}
}

function formatRuleLine(
	line: ParsedFormatLine,
	width: number,
	config: GenericGrammarFormatterConfig,
): string {
	const rawLhs = line.lhs ?? "";
	const lhs = config.alignEquals
		? rawLhs.trimEnd().padEnd(width)
		: rawLhs.trimEnd();
	const body = (line.body ?? "").trim();
	return `${lhs} ${line.op ?? "::="}${body.length > 0 ? ` ${body}` : ""}`;
}

function renderLines(
	lines: ParsedFormatLine[],
	config: GenericGrammarFormatterConfig,
): string[] {
	const width = alignedWidth(lines, config);
	const out: string[] = [];
	let previousWasRule = false;
	for (const line of lines) {
		if (!line.lhs) {
			out.push(line.line);
			previousWasRule = false;
			continue;
		}
		if (previousWasRule) {
			pushBlankLines(out, config.blankLinesBetweenRules);
		}
		out.push(formatRuleLine(line, width, config));
		previousWasRule = true;
	}
	return out;
}

/**
 * Formats BNF, EBNF, and RBNF production grammars.
 */
export function formatProductionGrammarDocument(
	text: string,
	dialect: Exclude<GrammarDialect, "abnf">,
	config: GenericGrammarFormatterConfig,
): string {
	const normalized = text.replace(CRLF_RE, "\n").replace(CR_RE, "\n");
	const parsed = normalized.split("\n").map(parseFormatLine);
	let result = renderLines(parsed, config)
		.join("\n")
		.replace(TRAILING_SPACE_RE, "");
	if (dialect === "rbnf") {
		result = result.replace(RBNF_ASSIGNMENT_RE, "$1 ::=");
	}
	if (config.insertFinalNewline && !result.endsWith("\n")) {
		result += "\n";
	}
	return result;
}
