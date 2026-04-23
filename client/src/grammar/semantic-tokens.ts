import {
	type CancellationToken,
	type DocumentSemanticTokensProvider,
	Range,
	SemanticTokensBuilder,
	SemanticTokensLegend,
	type TextDocument,
} from "vscode";
import { CORE_RULE_NAMES } from "../abnf/core-rules.ts";
import { normalizeSymbolName } from "./grammar.ts";
import { type GrammarToken, tokenizeGrammar } from "./tokenizer.ts";
import type { GrammarWorkspace } from "./workspace.ts";

const TOKEN_TYPES = [
	"type",
	"parameter",
	"variable",
	"string",
	"comment",
	"number",
	"operator",
	"regexp",
] as const;

const TOKEN_MODIFIERS = [
	"declaration",
	"definition",
	"readonly",
	"defaultLibrary",
] as const;

/**
 * Semantic token legend used by grammar highlighting.
 */
export const GRAMMAR_SEMANTIC_TOKENS_LEGEND = new SemanticTokensLegend(
	[...TOKEN_TYPES],
	[...TOKEN_MODIFIERS],
);

/**
 * VS Code semantic token provider for grammar definitions and references.
 */
export class GrammarSemanticTokensProvider
	implements DocumentSemanticTokensProvider
{
	readonly #manager: GrammarWorkspace;

	constructor(manager: GrammarWorkspace) {
		this.#manager = manager;
	}

	provideDocumentSemanticTokens(doc: TextDocument, _token: CancellationToken) {
		const { dialect, document, symbolTable } = this.#manager.get(doc);
		const builder = new SemanticTokensBuilder(GRAMMAR_SEMANTIC_TOKENS_LEGEND);
		const pushed: Range[] = [];

		const push = (
			range: Range,
			tokenType: string,
			tokenModifiers: readonly string[] = [],
		): void => {
			if (range.start.line !== range.end.line || overlapsAny(range, pushed)) {
				return;
			}
			builder.push(range, tokenType, tokenModifiers);
			pushed.push(range);
		};

		for (const rule of document.rules) {
			push(rule.nameRange, "type", ["declaration", "definition"]);
			for (const ref of rule.references) {
				const key = normalizeSymbolName(ref.name, dialect);
				if (dialect === "abnf" && CORE_RULE_NAMES.has(key)) {
					push(ref.range, "variable", ["readonly", "defaultLibrary"]);
				} else if (symbolTable.definitions.has(key)) {
					push(ref.range, "parameter");
				} else {
					push(ref.range, "type");
				}
			}
		}

		for (const token of tokenizeGrammar(doc.getText(), dialect)) {
			const semantic = semanticTokenForGrammarToken(token);
			if (semantic) {
				push(tokenRange(token), semantic.type, semantic.modifiers);
			}
		}

		return builder.build();
	}
}

function tokenRange(token: GrammarToken): Range {
	return new Range(
		token.line,
		token.column,
		token.line,
		token.column + token.text.length,
	);
}

function overlaps(a: Range, b: Range): boolean {
	return (
		a.start.line === b.start.line &&
		a.start.character < b.end.character &&
		b.start.character < a.end.character
	);
}

function overlapsAny(range: Range, ranges: Range[]): boolean {
	return ranges.some((candidate) => overlaps(range, candidate));
}

function semanticTokenForGrammarToken(
	token: GrammarToken,
): { type: string; modifiers?: readonly string[] } | undefined {
	switch (token.kind) {
		case "assignment":
		case "alternative":
		case "repeat":
		case "group":
			return { type: "operator" };
		case "literal":
			return { type: "string" };
		case "comment":
			return { type: "comment" };
		case "number":
		case "charCode":
			return { type: "number" };
		case "charClass":
			return { type: "regexp" };
		default:
			return undefined;
	}
}
