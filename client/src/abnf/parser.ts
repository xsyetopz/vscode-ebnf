import { type Diagnostic, DiagnosticSeverity, Range } from "vscode";
import type {
	GrammarDocument,
	IdentifierReference,
	Rule,
	SymbolTable,
} from "../types.ts";
import { tokenize } from "./tokenizer.ts";
import type { AbnfExpression, AbnfToken } from "./types.ts";
import { AbnfTokenKind } from "./types.ts";

/**
 * Expression AST side table keyed by parsed ABNF rules.
 */
export const ruleExpressions = new WeakMap<Rule, AbnfExpression>();

const DIAGNOSTIC_SOURCE = "abnf";

function tokenRange(token: AbnfToken): Range {
	return new Range(
		token.line,
		token.column,
		token.line,
		token.column + token.text.length,
	);
}

function skipWhitespace(
	tokens: AbnfToken[],
	start: number,
	len: number,
): number {
	let pos = start;
	while (pos < len && tokens[pos]?.kind === AbnfTokenKind.Whitespace) {
		pos++;
	}
	return pos;
}

function collectPrecedingComment(
	tokens: AbnfToken[],
	startSearch: number,
): string | undefined {
	let j = startSearch - 1;
	while (j >= 0 && tokens[j]?.kind === AbnfTokenKind.Newline) {
		j--;
	}
	if (j >= 0 && tokens[j]?.kind === AbnfTokenKind.Comment) {
		return tokens[j]?.text.slice(1).trim();
	}
	return undefined;
}

function collectRuleBodyTokens(
	tokens: AbnfToken[],
	startIndex: number,
	len: number,
): { bodyTokens: AbnfToken[]; nextIndex: number } {
	const bodyTokens: AbnfToken[] = [];
	let i = startIndex;

	while (i < len) {
		const curr = tokens[i];
		if (curr === undefined) {
			break;
		}

		if (curr.kind === AbnfTokenKind.Newline) {
			const j = i + 1;
			const nextNonNl = tokens[j];
			if (nextNonNl && nextNonNl.kind === AbnfTokenKind.Whitespace) {
				bodyTokens.push(curr);
				i++;
				continue;
			}
			if (nextNonNl && isRuleStart(tokens, j)) {
				i++;
				break;
			}
			bodyTokens.push(curr);
			i++;
			continue;
		}

		bodyTokens.push(curr);
		i++;
	}

	return { bodyTokens, nextIndex: i };
}

function buildRuleFromTokens(
	ruleNameToken: AbnfToken,
	bodyTokens: AbnfToken[],
	isIncremental: boolean,
	precedingComment: string | undefined,
	diagnostics: Diagnostic[],
): Rule {
	const definitionParts: string[] = [];
	for (const bt of bodyTokens) {
		if (
			bt.kind !== AbnfTokenKind.Comment &&
			bt.kind !== AbnfTokenKind.Newline
		) {
			definitionParts.push(bt.text);
		}
	}
	const definitionText = definitionParts.join("").trim().replace(/\s+/g, " ");

	const hasContent = bodyTokens.some(
		(bt) =>
			bt.kind !== AbnfTokenKind.Whitespace &&
			bt.kind !== AbnfTokenKind.Newline &&
			bt.kind !== AbnfTokenKind.Comment,
	);
	if (!hasContent) {
		diagnostics.push({
			message: `Rule "${ruleNameToken.text}" has an empty body`,
			range: tokenRange(ruleNameToken),
			severity: DiagnosticSeverity.Warning,
			source: DIAGNOSTIC_SOURCE,
		});
	}

	const expressionParser = new ExpressionParser(bodyTokens);
	const expression = expressionParser.parse();
	diagnostics.push(...expressionParser.diagnostics);
	const references = expressionParser.references;

	const nameRange = tokenRange(ruleNameToken);
	const lastBodyToken =
		bodyTokens.length > 0 ? bodyTokens[bodyTokens.length - 1] : undefined;
	const definitionEnd = lastBodyToken
		? new Range(
				lastBodyToken.line,
				lastBodyToken.column,
				lastBodyToken.line,
				lastBodyToken.column + lastBodyToken.text.length,
			).end
		: nameRange.end;
	const definitionRange = new Range(nameRange.start, definitionEnd);

	const rule: Rule = {
		name: ruleNameToken.text,
		nameRange,
		definitionRange,
		definitionText,
		isIncremental,
		precedingComment,
		references,
	};

	ruleExpressions.set(rule, expression);
	return rule;
}

class ExpressionParser {
	readonly diagnostics: Diagnostic[] = [];
	readonly references: IdentifierReference[] = [];
	readonly #tokens: AbnfToken[];
	#pos: number;

	constructor(tokens: AbnfToken[]) {
		this.#tokens = tokens;
		this.#pos = 0;
	}

	parse(): AbnfExpression {
		return this.#parseAlternation();
	}

	#peek(): AbnfToken | undefined {
		while (this.#pos < this.#tokens.length) {
			const t = this.#tokens[this.#pos];
			if (t === undefined) {
				break;
			}
			if (
				t.kind === AbnfTokenKind.Whitespace ||
				t.kind === AbnfTokenKind.Newline ||
				t.kind === AbnfTokenKind.Comment
			) {
				this.#pos++;
				continue;
			}
			return t;
		}
		return undefined;
	}

	#peekRaw(): AbnfToken | undefined {
		return this.#pos < this.#tokens.length
			? this.#tokens[this.#pos]
			: undefined;
	}

	#consume(): AbnfToken | undefined {
		const t = this.#peek();
		if (t) {
			this.#pos++;
		}
		return t;
	}

	#parseAlternation(): AbnfExpression {
		const first = this.#parseConcatenation();
		const alternatives: AbnfExpression[] = [first];

		while (true) {
			const next = this.#peek();
			if (!next || next.kind !== AbnfTokenKind.Alternation) {
				break;
			}
			this.#consume();
			alternatives.push(this.#parseConcatenation());
		}

		if (alternatives.length === 1) {
			return alternatives[0] as AbnfExpression;
		}
		return { kind: "alternation", alternatives };
	}

	#skipTriviaTracked(): { hadWhitespace: boolean; savedPos: number } {
		const savedPos = this.#pos;
		let hadWhitespace = false;

		while (this.#pos < this.#tokens.length) {
			const raw = this.#tokens[this.#pos];
			if (raw === undefined) {
				break;
			}
			if (
				raw.kind === AbnfTokenKind.Whitespace ||
				raw.kind === AbnfTokenKind.Newline ||
				raw.kind === AbnfTokenKind.Comment
			) {
				hadWhitespace = true;
				this.#pos++;
			} else {
				break;
			}
		}

		return { hadWhitespace, savedPos };
	}

	#parseConcatenation(): AbnfExpression {
		const elements: AbnfExpression[] = [];

		while (true) {
			const { hadWhitespace, savedPos } = this.#skipTriviaTracked();

			const next = this.#peekRaw();
			if (!(next && this.#isElementStart(next))) {
				this.#pos = savedPos;
				break;
			}

			// Require whitespace between elements (after the first)
			if (elements.length > 0 && !hadWhitespace) {
				break;
			}

			const elem = this.#parseRepetition();
			elements.push(elem);
		}

		if (elements.length === 1) {
			return elements[0] as AbnfExpression;
		}
		if (elements.length === 0) {
			// Produce an empty concatenation - caller handles empty body diagnostics
			return { kind: "concatenation", elements: [] };
		}
		return { kind: "concatenation", elements };
	}

	#isElementStart(token: AbnfToken): boolean {
		switch (token.kind) {
			case AbnfTokenKind.Rulename:
			case AbnfTokenKind.ParenOpen:
			case AbnfTokenKind.BracketOpen:
			case AbnfTokenKind.String:
			case AbnfTokenKind.CaseSensitiveString:
			case AbnfTokenKind.CaseInsensitiveString:
			case AbnfTokenKind.NumericValue:
			case AbnfTokenKind.ProseValue:
			case AbnfTokenKind.Integer:
			case AbnfTokenKind.Asterisk:
				return true;
			default:
				return false;
		}
	}

	#parseRepetition(): AbnfExpression {
		const next = this.#peek();
		if (!next) {
			return { kind: "concatenation", elements: [] };
		}

		if (next.kind === AbnfTokenKind.Integer) {
			this.#consume();
			const n = Number.parseInt(next.text, 10);

			const afterInt = this.#peek();
			if (afterInt && afterInt.kind === AbnfTokenKind.Asterisk) {
				this.#consume();
				const afterStar = this.#peek();
				let max: number | null = null;
				if (afterStar && afterStar.kind === AbnfTokenKind.Integer) {
					this.#consume();
					max = Number.parseInt(afterStar.text, 10);
				}
				const element = this.#parseElement();
				return { kind: "repetition", min: n, max, element };
			}

			// Exact repetition: no asterisk
			const element = this.#parseElement();
			return { kind: "repetition", min: n, max: n, element };
		}

		if (next.kind === AbnfTokenKind.Asterisk) {
			this.#consume();
			const afterStar = this.#peek();
			let max: number | null = null;
			if (afterStar && afterStar.kind === AbnfTokenKind.Integer) {
				this.#consume();
				max = Number.parseInt(afterStar.text, 10);
			}
			const element = this.#parseElement();
			return { kind: "repetition", min: 0, max, element };
		}

		return this.#parseElement();
	}

	#parseGroup(openToken: AbnfToken): AbnfExpression {
		const inner = this.#parseAlternation();
		const closing = this.#peek();
		if (!closing || closing.kind !== AbnfTokenKind.ParenClose) {
			this.diagnostics.push({
				message: `Unterminated group "(" - missing ")"`,
				range: tokenRange(openToken),
				severity: DiagnosticSeverity.Error,
				source: DIAGNOSTIC_SOURCE,
			});
		} else {
			this.#consume();
		}
		return { kind: "group", expression: inner };
	}

	#parseOptional(openToken: AbnfToken): AbnfExpression {
		const inner = this.#parseAlternation();
		const closing = this.#peek();
		if (!closing || closing.kind !== AbnfTokenKind.BracketClose) {
			this.diagnostics.push({
				message: `Unterminated optional "[" - missing "]"`,
				range: tokenRange(openToken),
				severity: DiagnosticSeverity.Error,
				source: DIAGNOSTIC_SOURCE,
			});
		} else {
			this.#consume();
		}
		return { kind: "optional", expression: inner };
	}

	#parseElement(): AbnfExpression {
		const token = this.#peek();
		if (!token) {
			return { kind: "concatenation", elements: [] };
		}

		switch (token.kind) {
			case AbnfTokenKind.ParenOpen:
				this.#consume();
				return this.#parseGroup(token);

			case AbnfTokenKind.BracketOpen:
				this.#consume();
				return this.#parseOptional(token);

			case AbnfTokenKind.Rulename: {
				this.#consume();
				const range = tokenRange(token);
				const ref: IdentifierReference = { name: token.text, range };
				this.references.push(ref);
				return { kind: "rulename", name: token.text, range };
			}

			case AbnfTokenKind.String:
				this.#consume();
				return {
					kind: "string",
					value: token.text.slice(1, -1),
					caseSensitive: false,
				};

			case AbnfTokenKind.CaseInsensitiveString:
				this.#consume();
				return {
					kind: "string",
					value: token.text.slice(3, -1),
					caseSensitive: false,
				};

			case AbnfTokenKind.CaseSensitiveString:
				this.#consume();
				return {
					kind: "string",
					value: token.text.slice(3, -1),
					caseSensitive: true,
				};

			case AbnfTokenKind.NumericValue: {
				this.#consume();
				const base = token.text[1]?.toLowerCase() as "d" | "x" | "b";
				return { kind: "numeric", base, text: token.text.slice(2) };
			}

			case AbnfTokenKind.ProseValue:
				this.#consume();
				return { kind: "prose", text: token.text.slice(1, -1) };

			default:
				// Unknown token - consume and produce empty
				this.#consume();
				return { kind: "concatenation", elements: [] };
		}
	}
}

// ── Rule boundary detection ──────────────────────────────────────────────────

/**
 * Returns true if, starting at `idx`, we see:
 *   Rulename (optional-whitespace) (DefinedAs | IncrementalAs)
 */
function isRuleStart(tokens: AbnfToken[], idx: number): boolean {
	const t = tokens[idx];
	if (!t || t.kind !== AbnfTokenKind.Rulename) {
		return false;
	}
	let j = idx + 1;
	while (j < tokens.length && tokens[j]?.kind === AbnfTokenKind.Whitespace) {
		j++;
	}
	const after = tokens[j];
	return (
		after !== undefined &&
		(after.kind === AbnfTokenKind.DefinedAs ||
			after.kind === AbnfTokenKind.IncrementalAs)
	);
}

// ── Main parser ──────────────────────────────────────────────────────────────

function isTrivia(kind: AbnfTokenKind): boolean {
	return (
		kind === AbnfTokenKind.Whitespace ||
		kind === AbnfTokenKind.Newline ||
		kind === AbnfTokenKind.Comment
	);
}

function isRuleDefinitionStart(token: AbnfToken, tokens: AbnfToken[]): boolean {
	return (
		token.kind === AbnfTokenKind.Rulename &&
		token.column === 0 &&
		isRuleStart(tokens, tokens.indexOf(token))
	);
}

function parseRuleAt(
	tokens: AbnfToken[],
	i: number,
	len: number,
	diagnostics: Diagnostic[],
): { rule: Rule | null; nextIndex: number } {
	const ruleNameToken = tokens[i];
	if (ruleNameToken === undefined) {
		return { rule: null, nextIndex: i + 1 };
	}

	const precedingComment = collectPrecedingComment(tokens, i);

	let pos = i + 1; // consume rulename
	pos = skipWhitespace(tokens, pos, len);

	const assignToken = tokens[pos];
	if (
		!assignToken ||
		(assignToken.kind !== AbnfTokenKind.DefinedAs &&
			assignToken.kind !== AbnfTokenKind.IncrementalAs)
	) {
		diagnostics.push({
			message: `Expected "=" or "=/" after rule name "${ruleNameToken.text}"`,
			range: tokenRange(ruleNameToken),
			severity: DiagnosticSeverity.Error,
			source: DIAGNOSTIC_SOURCE,
		});
		return { rule: null, nextIndex: pos };
	}

	const isIncremental = assignToken.kind === AbnfTokenKind.IncrementalAs;
	pos++; // consume = or =/

	const { bodyTokens, nextIndex } = collectRuleBodyTokens(tokens, pos, len);

	const rule = buildRuleFromTokens(
		ruleNameToken,
		bodyTokens,
		isIncremental,
		precedingComment,
		diagnostics,
	);
	return { rule, nextIndex };
}

/**
 * Parses RFC ABNF text into the shared grammar document model.
 */
export function parseAbnf(text: string): GrammarDocument {
	const tokens = tokenize(text);
	const rules: Rule[] = [];
	const diagnostics: Diagnostic[] = [];

	let i = 0;
	const len = tokens.length;

	// Skip leading trivia
	while (
		i < len &&
		(tokens[i]?.kind === AbnfTokenKind.Whitespace ||
			tokens[i]?.kind === AbnfTokenKind.Newline)
	) {
		i++;
	}

	while (i < len) {
		const token = tokens[i];
		if (token === undefined) {
			break;
		}

		if (isTrivia(token.kind) || !isRuleDefinitionStart(token, tokens)) {
			i++;
			continue;
		}

		const result = parseRuleAt(tokens, i, len, diagnostics);
		if (result.rule) {
			rules.push(result.rule);
		}
		i = result.nextIndex;
	}

	return { rules, diagnostics };
}

// ── Symbol table ─────────────────────────────────────────────────────────────

/**
 * Builds definition and reference indexes for a parsed ABNF document.
 */
export function buildAbnfSymbolTable(doc: GrammarDocument): SymbolTable {
	const definitions = new Map<string, Rule[]>();
	const references = new Map<string, IdentifierReference[]>();

	for (const rule of doc.rules) {
		const key = rule.name.toLowerCase();
		const existing = definitions.get(key);
		if (existing) {
			existing.push(rule);
		} else {
			definitions.set(key, [rule]);
		}

		for (const ref of rule.references) {
			const refKey = ref.name.toLowerCase();
			const existingRefs = references.get(refKey);
			if (existingRefs) {
				existingRefs.push(ref);
			} else {
				references.set(refKey, [ref]);
			}
		}
	}

	return { definitions, references };
}
