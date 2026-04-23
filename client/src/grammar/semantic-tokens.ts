import {
	type CancellationToken,
	type DocumentSemanticTokensProvider,
	SemanticTokensBuilder,
	SemanticTokensLegend,
	type TextDocument,
} from "vscode";
import { CORE_RULE_NAMES } from "../abnf/core-rules.ts";
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
		for (const rule of document.rules) {
			builder.push(rule.nameRange, "type", ["declaration", "definition"]);
			for (const ref of rule.references) {
				const key = ref.name.toLowerCase();
				if (dialect === "abnf" && CORE_RULE_NAMES.has(key)) {
					builder.push(ref.range, "variable", ["readonly", "defaultLibrary"]);
				} else if (symbolTable.definitions.has(key)) {
					builder.push(ref.range, "parameter", []);
				} else {
					builder.push(ref.range, "type", []);
				}
			}
		}
		return builder.build();
	}
}
