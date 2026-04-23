import { tokenize } from "./abnf/tokenizer.ts";
import type { AbnfToken } from "./abnf/types.ts";
import { AbnfTokenKind } from "./abnf/types.ts";

/**
 * ABNF alternative indentation modes.
 */
export type AbnfAlternativeIndent = "align" | "indent";
/**
 * ABNF alternative line-break modes.
 */
export type AbnfBreakAlternatives = "always" | "auto" | "never";

/**
 * Formatting options for ABNF documents.
 */
export interface AbnfFormatterConfig {
	alignEquals: boolean;
	continuationIndent: number;
	alternativeIndent: AbnfAlternativeIndent;
	insertFinalNewline: boolean;
	blankLinesBetweenRules: number;
	breakAlternatives: AbnfBreakAlternatives;
	maxLineLength: number; // 0 disables
	preserveContinuationLineBreaks: boolean;
	spaceBeforeInlineComment: number;
}

interface RuleBlock {
	kind: "rule";
	name: string;
	operator: "=" | "=/";
	bodyTokens: AbnfToken[];
}

interface StandaloneComment {
	kind: "comment";
	text: string;
}

type DocumentItem = RuleBlock | StandaloneComment;

/**
 * Formats an ABNF document while preserving grammar structure.
 */
export function formatAbnfDocument(
	text: string,
	config: AbnfFormatterConfig,
): string {
	if (text.trim().length === 0) {
		return text;
	}

	const tokens = tokenize(text);
	const items = parseDocumentItems(tokens);
	const formatted = formatItems(items, config);

	if (config.insertFinalNewline && !formatted.endsWith("\n")) {
		return `${formatted}\n`;
	}
	return formatted;
}

interface RuleBodyCollection {
	bodyTokens: AbnfToken[];
	nextIndex: number;
}

function isNextLineRuleStart(
	tokens: AbnfToken[],
	afterNewlineIndex: number,
): boolean {
	const wsEnd = skipWhitespace(tokens, afterNewlineIndex);
	if (
		wsEnd < tokens.length &&
		tokens[wsEnd]?.kind === AbnfTokenKind.Rulename &&
		tokens[wsEnd]?.column === 0
	) {
		const afterName = skipWhitespace(tokens, wsEnd + 1);
		if (
			afterName < tokens.length &&
			(tokens[afterName]?.kind === AbnfTokenKind.DefinedAs ||
				tokens[afterName]?.kind === AbnfTokenKind.IncrementalAs)
		) {
			return true;
		}
	}
	return false;
}

function isRuleEndAfterComment(tokens: AbnfToken[], pos: number): boolean {
	if (pos >= tokens.length) {
		return true;
	}
	if (isNextLineRuleStart(tokens, pos)) {
		return true;
	}
	const peek = tokens[pos];
	if (peek === undefined || peek.kind === AbnfTokenKind.Newline) {
		return true;
	}
	const wsAfter = skipWhitespace(tokens, pos);
	const afterWs = tokens[wsAfter];
	if (afterWs?.kind === AbnfTokenKind.Comment && afterWs.column === 0) {
		return true;
	}
	return false;
}

function handleBodyComment(
	tokens: AbnfToken[],
	bodyTokens: AbnfToken[],
	cur: AbnfToken,
	i: number,
): { nextIndex: number; done: boolean } {
	if (cur.column === 0) {
		return { nextIndex: i, done: true };
	}
	bodyTokens.push(cur);
	let next = i + 1;
	next = consumeNewline(tokens, next);
	return { nextIndex: next, done: isRuleEndAfterComment(tokens, next) };
}

function collectRuleBody(
	tokens: AbnfToken[],
	startIndex: number,
): RuleBodyCollection {
	const bodyTokens: AbnfToken[] = [];
	let i = startIndex;

	while (i < tokens.length) {
		const cur = tokens[i];
		if (cur === undefined) {
			break;
		}

		if (cur.kind === AbnfTokenKind.Comment) {
			const result = handleBodyComment(tokens, bodyTokens, cur, i);
			i = result.nextIndex;
			if (result.done) {
				break;
			}
			continue;
		}

		if (cur.kind === AbnfTokenKind.Newline) {
			i++;
			if (isNextLineRuleStart(tokens, i)) {
				break;
			}
			bodyTokens.push(cur);
			continue;
		}

		bodyTokens.push(cur);
		i++;
	}

	return { bodyTokens, nextIndex: i };
}

interface ParseRuleResult {
	item: DocumentItem;
	nextIndex: number;
}

function parseRuleDefinition(
	tokens: AbnfToken[],
	ruleStart: number,
	ruleName: string,
): ParseRuleResult {
	let i = ruleStart + 1; // skip rulename token
	i = skipWhitespace(tokens, i);

	if (i >= tokens.length) {
		return { item: { kind: "comment", text: ruleName }, nextIndex: i };
	}

	const opTok = tokens[i];
	if (opTok === undefined) {
		return { item: { kind: "comment", text: ruleName }, nextIndex: i };
	}

	if (
		opTok.kind !== AbnfTokenKind.DefinedAs &&
		opTok.kind !== AbnfTokenKind.IncrementalAs
	) {
		const lineText = collectLineText(tokens, ruleStart);
		return {
			item: { kind: "comment", text: lineText.text },
			nextIndex: lineText.nextIndex,
		};
	}

	const operator: "=" | "=/" =
		opTok.kind === AbnfTokenKind.IncrementalAs ? "=/" : "=";
	i++;

	const collected = collectRuleBody(tokens, i);
	return {
		item: {
			kind: "rule",
			name: ruleName,
			operator,
			bodyTokens: collected.bodyTokens,
		},
		nextIndex: collected.nextIndex,
	};
}

function parseDocumentItems(tokens: AbnfToken[]): DocumentItem[] {
	const items: DocumentItem[] = [];
	let i = 0;

	while (i < tokens.length) {
		i = skipBlankLines(tokens, i);
		if (i >= tokens.length) {
			break;
		}

		const tok = tokens[i];
		if (tok === undefined) {
			break;
		}

		if (tok.kind === AbnfTokenKind.Comment) {
			items.push({ kind: "comment", text: tok.text });
			i++;
			i = consumeNewline(tokens, i);
			continue;
		}

		if (tok.kind === AbnfTokenKind.Rulename) {
			const result = parseRuleDefinition(tokens, i, tok.text);
			items.push(result.item);
			i = result.nextIndex;
			continue;
		}

		// Skip unknown or whitespace tokens at top level
		i++;
	}

	return items;
}

function skipWhitespace(tokens: AbnfToken[], start: number): number {
	let pos = start;
	while (
		pos < tokens.length &&
		tokens[pos]?.kind === AbnfTokenKind.Whitespace
	) {
		pos++;
	}
	return pos;
}

function skipBlankLines(tokens: AbnfToken[], start: number): number {
	let pos = start;
	while (pos < tokens.length) {
		const tok = tokens[pos];
		if (tok === undefined) {
			break;
		}
		if (tok.kind === AbnfTokenKind.Newline) {
			pos++;
			continue;
		}
		if (tok.kind === AbnfTokenKind.Whitespace) {
			pos++;
			continue;
		}
		break;
	}
	return pos;
}

function consumeNewline(tokens: AbnfToken[], start: number): number {
	if (start < tokens.length && tokens[start]?.kind === AbnfTokenKind.Newline) {
		return start + 1;
	}
	return start;
}

interface LineCollectionResult {
	text: string;
	nextIndex: number;
}

function collectLineText(
	tokens: AbnfToken[],
	start: number,
): LineCollectionResult {
	let text = "";
	let i = start;
	while (i < tokens.length) {
		const t = tokens[i];
		if (t === undefined || t.kind === AbnfTokenKind.Newline) {
			break;
		}
		text += t.text;
		i++;
	}
	if (i < tokens.length && tokens[i]?.kind === AbnfTokenKind.Newline) {
		i++;
	}
	return { text, nextIndex: i };
}

function formatItems(
	items: DocumentItem[],
	config: AbnfFormatterConfig,
): string {
	const groups = groupConsecutiveRules(items);
	const outputParts: string[] = [];

	for (const group of groups) {
		const groupLines = formatGroup(group, config);
		outputParts.push(groupLines);
	}

	return outputParts.join("\n");
}

type DocumentGroup = DocumentItem[];

function groupConsecutiveRules(items: DocumentItem[]): DocumentGroup[] {
	const groups: DocumentGroup[] = [];
	let currentGroup: DocumentGroup = [];

	for (const item of items) {
		if (item.kind === "comment") {
			if (currentGroup.length > 0) {
				groups.push(currentGroup);
				currentGroup = [];
			}
			groups.push([item]);
		} else {
			currentGroup.push(item);
		}
	}

	if (currentGroup.length > 0) {
		groups.push(currentGroup);
	}

	return groups;
}

function calculateNameWidth(ruleBlocks: RuleBlock[]): number {
	let nameWidth = 0;
	for (const rule of ruleBlocks) {
		if (rule.name.length > nameWidth) {
			nameWidth = rule.name.length;
		}
	}
	return nameWidth;
}

function formatGroup(
	group: DocumentGroup,
	config: AbnfFormatterConfig,
): string {
	const lines: string[] = [];

	const first = group[0];
	if (group.length === 1 && first?.kind === "comment") {
		lines.push(first.text);
		return lines.join("\n");
	}

	const ruleBlocks = group.filter(
		(item): item is RuleBlock => item.kind !== "comment",
	);

	const nameWidth = config.alignEquals ? calculateNameWidth(ruleBlocks) : 0;
	const blankLines = Math.max(0, Math.floor(config.blankLinesBetweenRules));

	for (let i = 0; i < ruleBlocks.length; i++) {
		const rule = ruleBlocks[i];
		if (rule === undefined) {
			continue;
		}

		const ruleText = formatRule(rule, nameWidth, config);
		if (i > 0) {
			for (let b = 0; b < blankLines; b++) {
				lines.push("");
			}
		}
		lines.push(ruleText);
	}

	return lines.join("\n");
}

type BodyAtom = { kind: "token"; tok: AbnfToken } | { kind: "hardBreak" };

function isContinuationNewline(
	bodyTokens: AbnfToken[],
	newlineIndex: number,
): boolean {
	const next = bodyTokens[newlineIndex + 1];
	return (
		next !== undefined &&
		next.kind === AbnfTokenKind.Whitespace &&
		next.column === 0
	);
}

function buildBodyAtoms(
	bodyTokens: AbnfToken[],
	config: AbnfFormatterConfig,
): BodyAtom[] {
	const atoms: BodyAtom[] = [];

	for (let i = 0; i < bodyTokens.length; i++) {
		const tok = bodyTokens[i];
		if (tok === undefined) {
			continue;
		}

		if (tok.kind === AbnfTokenKind.Whitespace) {
			continue;
		}

		if (tok.kind === AbnfTokenKind.Newline) {
			if (
				config.preserveContinuationLineBreaks &&
				isContinuationNewline(bodyTokens, i)
			) {
				atoms.push({ kind: "hardBreak" });
			}
			continue;
		}

		if (tok.kind === AbnfTokenKind.Comment) {
			atoms.push({ kind: "token", tok });
			// ABNF comments end the line; if more tokens follow, they must start on a continuation line.
			atoms.push({ kind: "hardBreak" });
			continue;
		}

		atoms.push({ kind: "token", tok });
	}

	while (atoms.length > 0 && atoms[atoms.length - 1]?.kind === "hardBreak") {
		atoms.pop();
	}

	return atoms;
}

function containsHardBreak(atoms: BodyAtom[]): boolean {
	return atoms.some((a) => a.kind === "hardBreak");
}

function containsComment(atoms: BodyAtom[]): boolean {
	return atoms.some(
		(a) => a.kind === "token" && a.tok.kind === AbnfTokenKind.Comment,
	);
}

function updateDepth(depth: number, tok: AbnfToken): number {
	if (
		tok.kind === AbnfTokenKind.ParenOpen ||
		tok.kind === AbnfTokenKind.BracketOpen
	) {
		return depth + 1;
	}
	if (
		tok.kind === AbnfTokenKind.ParenClose ||
		tok.kind === AbnfTokenKind.BracketClose
	) {
		return depth - 1;
	}
	return depth;
}

function estimateInlineBodyLength(atoms: BodyAtom[]): number {
	let prev: AbnfToken | null = null;
	let len = 0;

	for (const atom of atoms) {
		if (atom.kind === "hardBreak") {
			return Number.POSITIVE_INFINITY;
		}
		const tok = atom.tok;
		if (tok.kind === AbnfTokenKind.Comment) {
			return Number.POSITIVE_INFINITY;
		}
		if (prev && needsSpaceBetween(prev, tok)) {
			len += 1;
		}
		len += tok.text.length;
		prev = tok;
	}

	return len;
}

function hasTopLevelAlternation(atoms: BodyAtom[]): boolean {
	let depth = 0;
	for (const atom of atoms) {
		if (atom.kind === "hardBreak") {
			continue;
		}
		const tok = atom.tok;
		if (tok.kind === AbnfTokenKind.Alternation && depth === 0) {
			return true;
		}
		depth = updateDepth(depth, tok);
	}
	return false;
}

function computeEffectiveBreakAlternatives(
	atoms: BodyAtom[],
	config: AbnfFormatterConfig,
	definitionPrefixLength: number,
): boolean {
	if (!hasTopLevelAlternation(atoms)) {
		return false;
	}
	if (config.breakAlternatives === "always") {
		return true;
	}
	if (config.breakAlternatives === "never") {
		return false;
	}

	const maxLen = config.maxLineLength > 0 ? config.maxLineLength : 0;
	if (maxLen <= 0) {
		return true;
	}

	if (containsHardBreak(atoms) || containsComment(atoms)) {
		return true;
	}

	const estimated = estimateInlineBodyLength(atoms);
	return definitionPrefixLength + estimated > maxLen;
}

function splitAlternatives(
	atoms: BodyAtom[],
	multilineAlternatives: boolean,
): BodyAtom[][] {
	if (!multilineAlternatives) {
		return [atoms];
	}

	const alternatives: BodyAtom[][] = [];
	let current: BodyAtom[] = [];
	let depth = 0;

	for (const atom of atoms) {
		if (atom.kind === "hardBreak") {
			current.push(atom);
			continue;
		}

		const tok = atom.tok;
		if (tok.kind === AbnfTokenKind.Alternation && depth === 0) {
			alternatives.push(current);
			current = [];
			continue;
		}

		current.push(atom);
		depth = updateDepth(depth, tok);
	}

	alternatives.push(current);
	return alternatives;
}

function splitHardBreakLines(atoms: BodyAtom[]): AbnfToken[][] {
	const lines: AbnfToken[][] = [];
	let current: AbnfToken[] = [];

	for (const atom of atoms) {
		if (atom.kind === "hardBreak") {
			if (current.length > 0) {
				lines.push(current);
				current = [];
			}
			continue;
		}
		current.push(atom.tok);
	}

	if (current.length > 0) {
		lines.push(current);
	}

	return lines;
}

function buildDefinitionPrefix(
	rule: RuleBlock,
	nameWidth: number,
	config: AbnfFormatterConfig,
): string {
	const paddedName = config.alignEquals
		? rule.name.padEnd(nameWidth)
		: rule.name;
	return `${paddedName} ${rule.operator} `;
}

function computeRuleIndents(
	definitionPrefix: string,
	config: AbnfFormatterConfig,
): { bodyIndent: string; altContinuationIndent: string } {
	const continuationIndent = " ".repeat(
		Math.max(0, Math.floor(config.continuationIndent)),
	);

	const bodyIndent =
		config.alternativeIndent === "align"
			? " ".repeat(definitionPrefix.length)
			: continuationIndent;

	const altContinuationIndent =
		config.alternativeIndent === "align"
			? " ".repeat(bodyIndent.length + 2)
			: continuationIndent;

	return { bodyIndent, altContinuationIndent };
}

function computeLinePrefixes(
	definitionPrefix: string,
	bodyIndent: string,
	altContinuationIndent: string,
	altIndex: number,
	lineIndex: number,
): { firstPrefix: string; wrapPrefix: string } {
	const isFirstAlt = altIndex === 0;
	const isFirstLineInAlt = lineIndex === 0;

	const firstPrefix = isFirstLineInAlt
		? isFirstAlt
			? definitionPrefix
			: `${bodyIndent}/ `
		: isFirstAlt
			? bodyIndent
			: altContinuationIndent;

	const wrapPrefix = isFirstLineInAlt
		? isFirstAlt
			? bodyIndent
			: altContinuationIndent
		: firstPrefix;

	return { firstPrefix, wrapPrefix };
}

function formatAlternativeLines(
	logicalLines: AbnfToken[][],
	config: AbnfFormatterConfig,
	definitionPrefix: string,
	bodyIndent: string,
	altContinuationIndent: string,
	altIndex: number,
): string[] {
	const out: string[] = [];

	for (let lineIndex = 0; lineIndex < logicalLines.length; lineIndex++) {
		const lineTokens = logicalLines[lineIndex] ?? [];
		if (lineTokens.length === 0) {
			continue;
		}

		const { firstPrefix, wrapPrefix } = computeLinePrefixes(
			definitionPrefix,
			bodyIndent,
			altContinuationIndent,
			altIndex,
			lineIndex,
		);

		out.push(
			...renderTokensWrapped(lineTokens, config, firstPrefix, wrapPrefix),
		);
	}

	return out;
}

function formatRuleBodyLines(
	atoms: BodyAtom[],
	config: AbnfFormatterConfig,
	definitionPrefix: string,
	bodyIndent: string,
	altContinuationIndent: string,
): string[] {
	const multilineAlternatives = computeEffectiveBreakAlternatives(
		atoms,
		config,
		definitionPrefix.length,
	);
	const alternatives = splitAlternatives(atoms, multilineAlternatives);

	const outLines: string[] = [];

	for (let altIndex = 0; altIndex < alternatives.length; altIndex++) {
		const altAtoms = alternatives[altIndex];
		if (altAtoms === undefined) {
			continue;
		}

		const logicalLines = splitHardBreakLines(altAtoms);
		if (logicalLines.length === 0) {
			continue;
		}

		outLines.push(
			...formatAlternativeLines(
				logicalLines,
				config,
				definitionPrefix,
				bodyIndent,
				altContinuationIndent,
				altIndex,
			),
		);
	}

	return outLines;
}

function formatRule(
	rule: RuleBlock,
	nameWidth: number,
	config: AbnfFormatterConfig,
): string {
	const definitionPrefix = buildDefinitionPrefix(rule, nameWidth, config);

	const atoms = buildBodyAtoms(rule.bodyTokens, config);
	if (atoms.length === 0) {
		return definitionPrefix.trimEnd();
	}

	const { bodyIndent, altContinuationIndent } = computeRuleIndents(
		definitionPrefix,
		config,
	);

	return formatRuleBodyLines(
		atoms,
		config,
		definitionPrefix,
		bodyIndent,
		altContinuationIndent,
	).join("\n");
}

interface TokenRender {
	tok: AbnfToken;
	breakBefore: boolean;
}

function isRepetitionPrefix(tok: AbnfToken, prev: AbnfToken | null): boolean {
	if (prev === null) {
		return false;
	}
	if (
		(prev.kind === AbnfTokenKind.Asterisk ||
			prev.kind === AbnfTokenKind.Integer) &&
		(tok.kind === AbnfTokenKind.Rulename ||
			tok.kind === AbnfTokenKind.String ||
			tok.kind === AbnfTokenKind.CaseSensitiveString ||
			tok.kind === AbnfTokenKind.CaseInsensitiveString ||
			tok.kind === AbnfTokenKind.NumericValue ||
			tok.kind === AbnfTokenKind.ProseValue ||
			tok.kind === AbnfTokenKind.ParenOpen ||
			tok.kind === AbnfTokenKind.BracketOpen)
	) {
		return true;
	}
	if (
		prev.kind === AbnfTokenKind.Integer &&
		tok.kind === AbnfTokenKind.Asterisk
	) {
		return true;
	}
	if (
		prev.kind === AbnfTokenKind.Asterisk &&
		tok.kind === AbnfTokenKind.Integer
	) {
		return true;
	}
	return false;
}

function needsSpaceBetween(prev: AbnfToken, tok: AbnfToken): boolean {
	if (
		tok.kind === AbnfTokenKind.ParenClose ||
		tok.kind === AbnfTokenKind.BracketClose
	) {
		return false;
	}
	if (
		prev.kind === AbnfTokenKind.ParenOpen ||
		prev.kind === AbnfTokenKind.BracketOpen
	) {
		return false;
	}
	if (prev.kind === AbnfTokenKind.Alternation) {
		return true;
	}
	if (tok.kind === AbnfTokenKind.Alternation) {
		return true;
	}
	if (isRepetitionPrefix(tok, prev)) {
		return false;
	}
	return true;
}

function renderTokens(
	tokens: TokenRender[],
	config: AbnfFormatterConfig,
): string {
	let out = "";
	let prev: AbnfToken | null = null;

	for (const { tok, breakBefore } of tokens) {
		if (!tok) {
			continue;
		}

		if (tok.kind === AbnfTokenKind.Comment) {
			const spaces = " ".repeat(
				Math.max(0, Math.floor(config.spaceBeforeInlineComment)),
			);
			out += `${spaces}${tok.text}`;
			break;
		}

		if (prev && breakBefore) {
			out += " ";
		}

		out += tok.text;
		prev = tok;
	}

	return out;
}

function buildTokenRenders(tokens: AbnfToken[]): TokenRender[] {
	const renders: TokenRender[] = [];
	let prev: AbnfToken | null = null;

	for (const tok of tokens) {
		if (tok.kind === AbnfTokenKind.Comment) {
			renders.push({ tok, breakBefore: false });
			prev = tok;
			continue;
		}
		const breakBefore = prev ? needsSpaceBetween(prev, tok) : false;
		renders.push({ tok, breakBefore });
		prev = tok;
	}

	return renders;
}

function findLastBreakIndex(tokens: TokenRender[]): number | null {
	for (let i = tokens.length - 1; i >= 1; i--) {
		if (tokens[i]?.breakBefore) {
			return i;
		}
	}
	return null;
}

function renderTokensWrapped(
	tokens: AbnfToken[],
	config: AbnfFormatterConfig,
	firstPrefix: string,
	wrapPrefix: string,
): string[] {
	const maxLen =
		config.maxLineLength > 0 ? Math.floor(config.maxLineLength) : 0;
	const renders = buildTokenRenders(tokens);

	if (maxLen <= 0) {
		return [`${firstPrefix}${renderTokens(renders, config)}`];
	}

	const lines: string[] = [];
	let currentTokens: TokenRender[] = [];
	let currentPrefix = firstPrefix;

	for (const render of renders) {
		currentTokens.push(render);

		while (true) {
			const rendered = renderTokens(currentTokens, config);
			if (currentPrefix.length + rendered.length <= maxLen) {
				break;
			}

			const breakIndex = findLastBreakIndex(currentTokens);
			if (breakIndex === null) {
				break;
			}

			const left = currentTokens.slice(0, breakIndex);
			const right = currentTokens.slice(breakIndex);

			if (left.length === 0) {
				break;
			}

			lines.push(`${currentPrefix}${renderTokens(left, config)}`);
			currentTokens = right;
			currentPrefix = wrapPrefix;
		}
	}

	if (currentTokens.length > 0) {
		lines.push(`${currentPrefix}${renderTokens(currentTokens, config)}`);
	}

	return lines;
}
