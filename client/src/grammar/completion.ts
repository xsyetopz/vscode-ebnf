import {
	type CancellationToken,
	CompletionItem,
	CompletionItemKind,
	type CompletionItemProvider,
	type Position,
	type TextDocument,
} from "vscode";
import { CORE_RULES } from "../abnf/core-rules.ts";
import { getGrammarDialectDescriptor } from "./grammar.ts";
import type { GrammarWorkspace } from "./workspace.ts";

/**
 * VS Code completion provider for grammar rule names.
 */
export class GrammarCompletionProvider implements CompletionItemProvider {
	readonly #manager: GrammarWorkspace;

	constructor(manager: GrammarWorkspace) {
		this.#manager = manager;
	}

	provideCompletionItems(
		doc: TextDocument,
		_position: Position,
		_token: CancellationToken,
	): CompletionItem[] {
		const { dialect, symbolTable } = this.#manager.get(doc);
		const operator = getGrammarDialectDescriptor(dialect).assignmentOperator;
		const items = Array.from(symbolTable.definitions.values()).flatMap(
			(rules) => {
				const rule = rules[0];
				if (!rule || rule.isCoreRule) {
					return [];
				}
				const item = new CompletionItem(rule.name, CompletionItemKind.Function);
				item.detail = `${rule.name} ${operator} ${rule.definitionText}`;
				if (rule.precedingComment) {
					item.documentation = rule.precedingComment;
				}
				return [item];
			},
		);
		if (dialect !== "abnf") {
			return items;
		}
		for (const [, rule] of CORE_RULES) {
			const item = new CompletionItem(rule.name, CompletionItemKind.Constant);
			item.detail = `${rule.name} = ${rule.definitionText}`;
			item.documentation = "Core rule (RFC 5234 Appendix B)";
			items.push(item);
		}
		return items;
	}
}
