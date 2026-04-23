import { type Diagnostic, DiagnosticSeverity, Range } from "vscode";
import type { GrammarDocument, IdentifierReference, Rule } from "../types.ts";
import type { GrammarDialect } from "./dialects.ts";
import {
	type LineInfo,
	makeSingleLineRange,
	rangeFromOffsets,
	splitLinesWithOffsets,
} from "./ranges.ts";
import { ISO_14977_NON_SUPPORT } from "./standards.ts";

/**
 * Grammar dialects handled by the production-grammar parser.
 */
export type ProductionDialect = Exclude<GrammarDialect, "abnf">;

interface NameMatch {
	name: string;
	start: number;
	end: number;
	operatorIndex: number;
}

interface ReferenceMatch {
	name: string;
	start: number;
	end: number;
}

interface ProductionSyntax {
	namePattern: RegExp;
}

const RBNF_NAME_RE = /^\s*(<[^<>\r\n]+>)\s*(::=)/;
const EBNF_NAME_RE =
	/^\s*(?:\[[^\]\r\n]+\]\s*)?([A-Za-z_][A-Za-z0-9_.:-]*)\s*(::=)/;
const BNF_NAME_RE = /^\s*(<[^<>\r\n]+>|[A-Za-z_][A-Za-z0-9_.:-]*)\s*(::=)/;
const STRING_RE = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
const XML_BLOCK_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const ANGLE_REFERENCE_RE = /<[^<>\r\n]+>/g;
const BARE_REFERENCE_RE = /\b[A-Za-z_][A-Za-z0-9_.:-]*\b/g;
const XML_HEX_MARKER_RE = /^(x|X)$/;
const EBNF_ISO_ASSIGNMENT_RE = /(^|\s)[A-Za-z_][A-Za-z0-9_.:-]*\s*=/;
const RBNF_ILLEGAL_NAME_RE = /[\t\r\n]/;
const WHITESPACE_RE = /\s+/g;

const PRODUCTION_SYNTAX: Record<ProductionDialect, ProductionSyntax> = {
	bnf: { namePattern: BNF_NAME_RE },
	ebnf: { namePattern: EBNF_NAME_RE },
	rbnf: { namePattern: RBNF_NAME_RE },
};

function syntaxForDialect(dialect: ProductionDialect): ProductionSyntax {
	return PRODUCTION_SYNTAX[dialect];
}

function nameFromMatch(match: RegExpMatchArray): NameMatch {
	const name = match[1] ?? "";
	const full = match[0] ?? "";
	const start = full.indexOf(name);
	return {
		name,
		start,
		end: start + name.length,
		operatorIndex: full.lastIndexOf("::="),
	};
}

function isProductionStart(line: string, syntax: ProductionSyntax): boolean {
	return syntax.namePattern.test(line);
}

function stripLineComment(line: string): string {
	const semicolon = line.indexOf(";");
	if (semicolon < 0) {
		return line;
	}
	return `${line.slice(0, semicolon)}${" ".repeat(line.length - semicolon)}`;
}

function stripCommentsAndLiterals(
	text: string,
	dialect: ProductionDialect,
): string {
	let out = text.replace(STRING_RE, (match) => " ".repeat(match.length));
	if (dialect === "ebnf") {
		out = out.replace(XML_BLOCK_COMMENT_RE, (match) =>
			" ".repeat(match.length),
		);
	}
	return out.split("\n").map(stripLineComment).join("\n");
}

function isInsideExistingReference(
	refs: ReferenceMatch[],
	index: number,
): boolean {
	return refs.some((ref) => index >= ref.start && index < ref.end);
}

function collectReferenceNames(
	body: string,
	dialect: ProductionDialect,
): ReferenceMatch[] {
	const clean = stripCommentsAndLiterals(body, dialect);
	const refs: ReferenceMatch[] = [];
	for (const match of clean.matchAll(ANGLE_REFERENCE_RE)) {
		const name = match[0] ?? "";
		const index = match.index ?? 0;
		refs.push({ name, start: index, end: index + name.length });
	}
	if (dialect === "rbnf") {
		return refs;
	}
	for (const match of clean.matchAll(BARE_REFERENCE_RE)) {
		const name = match[0] ?? "";
		const index = match.index ?? 0;
		if (
			isInsideExistingReference(refs, index) ||
			XML_HEX_MARKER_RE.test(name)
		) {
			continue;
		}
		refs.push({ name, start: index, end: index + name.length });
	}
	return refs.sort((a, b) => a.start - b.start);
}

function collectPrecedingComment(
	lines: LineInfo[],
	ruleLineIndex: number,
): string | undefined {
	let i = ruleLineIndex - 1;
	while (i >= 0 && (lines[i]?.text.trim() ?? "") === "") {
		i--;
	}
	const previous = lines[i]?.text.trim();
	if (previous?.startsWith(";")) {
		return previous.slice(1).trim();
	}
	if (previous?.startsWith("/*") && previous.endsWith("*/")) {
		return previous.slice(2, -2).trim();
	}
	return undefined;
}

function syntaxDiagnostic(
	dialect: ProductionDialect,
	line: LineInfo,
): Diagnostic | undefined {
	const trimmed = line.text.trim();
	if (
		trimmed.length === 0 ||
		trimmed.startsWith(";") ||
		trimmed.startsWith("/*")
	) {
		return undefined;
	}
	if (
		dialect === "ebnf" &&
		EBNF_ISO_ASSIGNMENT_RE.test(line.text) &&
		!line.text.includes("::=")
	) {
		return {
			message: `W3C XML EBNF requires '::='. ${ISO_14977_NON_SUPPORT}`,
			range: makeSingleLineRange(line.line, 0, line.text.length),
			severity: DiagnosticSeverity.Warning,
			source: dialect,
		};
	}
	return undefined;
}

function findProductionEnd(
	lines: LineInfo[],
	start: number,
	syntax: ProductionSyntax,
): number {
	let end = start;
	let cursor = start + 1;
	while (cursor < lines.length) {
		const next = lines[cursor];
		if (!next || isProductionStart(next.text, syntax)) {
			break;
		}
		end = cursor;
		cursor++;
	}
	return end;
}

function referencesFromBody(
	text: string,
	bodyStartOffset: number,
	body: string,
	dialect: ProductionDialect,
	ownName: string,
): IdentifierReference[] {
	return collectReferenceNames(body, dialect)
		.filter((ref) => ref.name !== ownName)
		.map((ref) => ({
			name: ref.name,
			range: rangeFromOffsets(
				text,
				bodyStartOffset + ref.start,
				bodyStartOffset + ref.end,
			),
		}));
}

function emptyBodyDiagnostic(
	name: string,
	range: Range,
	dialect: ProductionDialect,
): Diagnostic {
	return {
		message: `Rule "${name}" has an empty body`,
		range,
		severity: DiagnosticSeverity.Warning,
		source: dialect,
	};
}

function rbnfNameDiagnostic(
	name: string,
	range: Range,
): Diagnostic | undefined {
	if (!RBNF_ILLEGAL_NAME_RE.test(name)) {
		return undefined;
	}
	return {
		message:
			"RBNF rule names must be one angle-bracket identifier on a single line",
		range,
		severity: DiagnosticSeverity.Error,
		source: "rbnf",
	};
}

function productionRule(
	text: string,
	lines: LineInfo[],
	lineIndex: number,
	dialect: ProductionDialect,
	match: RegExpMatchArray,
): { rule: Rule; diagnostics: Diagnostic[]; nextIndex: number } {
	const nameInfo = nameFromMatch(match);
	const endLineIndex = findProductionEnd(
		lines,
		lineIndex,
		syntaxForDialect(dialect),
	);
	const line = lines[lineIndex] as LineInfo;
	const bodyStartOffset = line.offset + nameInfo.operatorIndex + "::=".length;
	const bodyEndLine = lines[endLineIndex];
	const bodyEndOffset = bodyEndLine
		? bodyEndLine.offset + bodyEndLine.text.length
		: bodyStartOffset;
	const body = text.slice(bodyStartOffset, bodyEndOffset);
	const nameRange = makeSingleLineRange(
		line.line,
		nameInfo.start,
		nameInfo.end,
	);
	const rule: Rule = {
		name: nameInfo.name,
		nameRange,
		definitionRange: new Range(
			nameRange.start,
			rangeFromOffsets(text, bodyEndOffset, bodyEndOffset).end,
		),
		definitionText: body.trim().replace(WHITESPACE_RE, " "),
		precedingComment: collectPrecedingComment(lines, lineIndex),
		references: referencesFromBody(
			text,
			bodyStartOffset,
			body,
			dialect,
			nameInfo.name,
		),
	};
	const diagnostics: Diagnostic[] = [];
	if (rule.definitionText.length === 0) {
		diagnostics.push(emptyBodyDiagnostic(rule.name, nameRange, dialect));
	}
	const nameDiagnostic =
		dialect === "rbnf" ? rbnfNameDiagnostic(rule.name, nameRange) : undefined;
	if (nameDiagnostic) {
		diagnostics.push(nameDiagnostic);
	}
	return { rule, diagnostics, nextIndex: endLineIndex + 1 };
}

/**
 * Parses BNF, EBNF, or RBNF text into the shared grammar document model.
 */
export function parseProductionGrammar(
	text: string,
	dialect: ProductionDialect,
): GrammarDocument {
	const syntax = syntaxForDialect(dialect);
	const lines = splitLinesWithOffsets(text);
	const rules: Rule[] = [];
	const diagnostics: Diagnostic[] = [];
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		if (!line) {
			break;
		}
		const match = line.text.match(syntax.namePattern);
		if (!match) {
			const diagnostic = syntaxDiagnostic(dialect, line);
			if (diagnostic) {
				diagnostics.push(diagnostic);
			}
			i++;
			continue;
		}
		const parsed = productionRule(text, lines, i, dialect, match);
		rules.push(parsed.rule);
		diagnostics.push(...parsed.diagnostics);
		i = parsed.nextIndex;
	}
	return { rules, diagnostics };
}
