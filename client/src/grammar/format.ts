import type {
	AbnfAlternativeIndent,
	AbnfBreakAlternatives,
} from "../abnf-format.ts";
import type { GrammarDialect } from "./dialects.ts";

/**
 * Shared formatting options for grammar documents.
 */
export interface SharedGrammarFormatterConfig {
	alignEquals: boolean;
	alternativeIndent: AbnfAlternativeIndent;
	blankLinesBetweenRules: number;
	breakAlternatives: AbnfBreakAlternatives;
	continuationIndent: number;
	insertFinalNewline: boolean;
	maxLineLength: number;
	preserveCommentSpacing: boolean;
	trimTrailingBlankLines: boolean;
}

/**
 * Formatting options shared by BNF, EBNF, and RBNF documents.
 */
export interface GenericGrammarFormatterConfig
	extends SharedGrammarFormatterConfig {
	alignProductionNumbers: boolean;
	spaceBeforeInlineComment: number;
}

interface ParsedFormatLine {
	line: string;
	lhs?: string;
	op?: string;
	body?: string;
	comment?: string | undefined;
}

interface AlternativeScanState {
	quote: string | undefined;
	escaped: boolean;
	angleDepth: number;
	parenDepth: number;
	bracketDepth: number;
	braceDepth: number;
}

const RULE_RE =
	/^(\s*(?:\[[^\]]+\]\s*)?(?:<[^<>\r\n]+>|[A-Za-z_][A-Za-z0-9_.:-]*)\s*)(::=)(\s*)(.*)$/;
const EBNF_PRODUCTION_PREFIX_RE = /^\s*\[[^\]]+\]\s*/;
const CRLF_RE = /\r\n/g;
const CR_RE = /\r/g;
const TRAILING_SPACE_RE = /[ \t]+$/gm;
const TRAILING_BLANK_LINES_RE = /\n+$/;

function parseFormatLine(line: string): ParsedFormatLine {
	const match = line.match(RULE_RE);
	if (!match) {
		return { line };
	}
	const body = match[4] ?? "";
	const inlineComment = splitInlineComment(body);
	return {
		line,
		lhs: match[1] ?? "",
		op: match[2] ?? "::=",
		body: inlineComment.body,
		comment: inlineComment.comment,
	};
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

function alignableHead(
	lhs: string,
	dialect: Exclude<GrammarDialect, "abnf">,
	config: GenericGrammarFormatterConfig,
): string {
	if (dialect !== "ebnf" || config.alignProductionNumbers) {
		return lhs;
	}
	return lhs.replace(EBNF_PRODUCTION_PREFIX_RE, "");
}

function pushBlankLines(out: string[], count: number): void {
	for (let i = 0; i < count; i++) {
		if (out[out.length - 1] !== "") {
			out.push("");
		}
	}
}

function initialAlternativeScanState(): AlternativeScanState {
	return {
		quote: undefined,
		escaped: false,
		angleDepth: 0,
		parenDepth: 0,
		bracketDepth: 0,
		braceDepth: 0,
	};
}

function isInsideStructure(state: AlternativeScanState): boolean {
	return (
		state.angleDepth > 0 ||
		state.parenDepth > 0 ||
		state.bracketDepth > 0 ||
		state.braceDepth > 0
	);
}

function scanQuotedCharacter(state: AlternativeScanState, ch: string): boolean {
	if (!state.quote) {
		return false;
	}
	if (state.escaped) {
		state.escaped = false;
		return true;
	}
	if (ch === "\\") {
		state.escaped = true;
		return true;
	}
	if (ch === state.quote) {
		state.quote = undefined;
	}
	return true;
}

function adjustDepth(current: number, delta: number): number {
	return Math.max(0, current + delta);
}

function scanStructuralCharacter(
	state: AlternativeScanState,
	ch: string,
): void {
	if (ch === '"' || ch === "'") {
		state.quote = ch;
		return;
	}
	if (ch === "<") {
		state.angleDepth++;
		return;
	}
	if (ch === ">") {
		state.angleDepth = adjustDepth(state.angleDepth, -1);
		return;
	}
	if (state.angleDepth > 0) {
		return;
	}
	if (ch === "(") {
		state.parenDepth++;
	} else if (ch === ")") {
		state.parenDepth = adjustDepth(state.parenDepth, -1);
	} else if (ch === "[") {
		state.bracketDepth++;
	} else if (ch === "]") {
		state.bracketDepth = adjustDepth(state.bracketDepth, -1);
	} else if (ch === "{") {
		state.braceDepth++;
	} else if (ch === "}") {
		state.braceDepth = adjustDepth(state.braceDepth, -1);
	}
}

function scanAlternativeCharacter(
	state: AlternativeScanState,
	ch: string,
): void {
	if (!scanQuotedCharacter(state, ch)) {
		scanStructuralCharacter(state, ch);
	}
}

function topLevelAlternatives(body: string): string[] {
	const alternatives: string[] = [];
	const state = initialAlternativeScanState();
	let start = 0;

	for (let i = 0; i < body.length; i++) {
		const ch = body[i] ?? "";
		if (ch === "|" && !state.quote && !isInsideStructure(state)) {
			alternatives.push(body.slice(start, i).trim());
			start = i + 1;
			continue;
		}
		scanAlternativeCharacter(state, ch);
	}

	if (alternatives.length === 0) {
		return [body.trim()];
	}
	alternatives.push(body.slice(start).trim());
	return alternatives;
}

function shouldBreakAlternatives(
	line: string,
	alternatives: string[],
	config: GenericGrammarFormatterConfig,
): boolean {
	if (alternatives.length <= 1) {
		return false;
	}
	if (config.breakAlternatives === "always") {
		return true;
	}
	if (config.breakAlternatives === "never" || config.maxLineLength <= 0) {
		return false;
	}
	return line.length > config.maxLineLength;
}

function continuationPrefix(
	lhs: string,
	op: string,
	config: GenericGrammarFormatterConfig,
): string {
	if (config.alternativeIndent === "indent") {
		return `${" ".repeat(Math.max(0, lhs.trimEnd().length))}${" ".repeat(
			Math.max(1, Math.floor(config.continuationIndent)),
		)}`;
	}
	return " ".repeat(lhs.length + op.length + 2);
}

function splitCommentBody(
	body: string,
	index: number,
): { body: string; comment: string } {
	return {
		body: body.slice(0, index).trim(),
		comment: body.slice(index).trim(),
	};
}

function quotedState(
	quote: string | undefined,
	escaped: boolean,
	ch: string,
): { quote: string | undefined; escaped: boolean; handled: boolean } {
	if (!quote) {
		return { quote, escaped, handled: false };
	}
	if (escaped) {
		return { quote, escaped: false, handled: true };
	}
	if (ch === "\\") {
		return { quote, escaped: true, handled: true };
	}
	return {
		quote: ch === quote ? undefined : quote,
		escaped: false,
		handled: true,
	};
}

function splitInlineComment(body: string): { body: string; comment?: string } {
	let quote: string | undefined;
	let escaped = false;
	for (let i = 0; i < body.length; i++) {
		const ch = body[i] ?? "";
		const state = quotedState(quote, escaped, ch);
		quote = state.quote;
		escaped = state.escaped;
		if (state.handled) {
			continue;
		}
		if (ch === '"' || ch === "'") {
			quote = ch;
			continue;
		}
		if (ch === ";" || (ch === "/" && body[i + 1] === "*")) {
			return splitCommentBody(body, i);
		}
	}
	return { body: body.trim() };
}

function formatRuleLine(
	line: ParsedFormatLine,
	dialect: Exclude<GrammarDialect, "abnf">,
	width: number,
	config: GenericGrammarFormatterConfig,
): string[] {
	const rawLhs = line.lhs ?? "";
	const head = alignableHead(rawLhs, dialect, config);
	const lhs = config.alignEquals
		? rawLhs.trimEnd().padEnd(width + (rawLhs.length - head.length))
		: rawLhs.trimEnd();
	const op = line.op ?? "::=";
	const body = (line.body ?? "").trim();
	const comment =
		line.comment && line.comment.length > 0
			? `${" ".repeat(config.spaceBeforeInlineComment)}${line.comment}`
			: "";
	const rendered = `${lhs} ${op}${body.length > 0 ? ` ${body}` : ""}${comment}`;
	const alternatives = topLevelAlternatives(body);
	if (!shouldBreakAlternatives(rendered, alternatives, config)) {
		return [rendered];
	}
	const prefix = continuationPrefix(lhs, op, config);
	const lines = [
		`${lhs} ${op} ${alternatives[0] ?? ""}`,
		...alternatives.slice(1).map((alternative) => `${prefix}| ${alternative}`),
	];
	if (comment.length > 0) {
		lines[lines.length - 1] = `${lines[lines.length - 1]}${comment}`;
	}
	return lines;
}

function renderLines(
	lines: ParsedFormatLine[],
	dialect: Exclude<GrammarDialect, "abnf">,
	config: GenericGrammarFormatterConfig,
): string[] {
	const width = config.alignEquals
		? Math.max(
				0,
				...lines.map(
					(line) =>
						alignableHead(line.lhs?.trimEnd() ?? "", dialect, config).length,
				),
			)
		: alignedWidth(lines, config);
	const out: string[] = [];
	let previousWasRule = false;
	for (const line of lines) {
		if (!line.lhs) {
			out.push(config.preserveCommentSpacing ? line.line : line.line.trimEnd());
			previousWasRule = false;
			continue;
		}
		if (previousWasRule) {
			pushBlankLines(out, config.blankLinesBetweenRules);
		}
		out.push(...formatRuleLine(line, dialect, width, config));
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
	let result = renderLines(
		normalized.split("\n").map(parseFormatLine),
		dialect,
		config,
	)
		.join("\n")
		.replace(TRAILING_SPACE_RE, "");
	if (config.trimTrailingBlankLines) {
		result = result.replace(TRAILING_BLANK_LINES_RE, "");
	}
	if (config.insertFinalNewline && !result.endsWith("\n")) {
		result += "\n";
	}
	return result;
}
