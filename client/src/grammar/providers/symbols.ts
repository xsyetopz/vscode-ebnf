import {
	type CancellationToken,
	DocumentSymbol,
	type DocumentSymbolProvider,
	SymbolKind,
	type TextDocument,
} from "vscode";
import type { GrammarWorkspace } from "../workspace.ts";

/**
 * VS Code document symbol provider for grammar rules.
 */
export class GrammarDocumentSymbolProvider implements DocumentSymbolProvider {
	readonly #grammarWorkspace: GrammarWorkspace;

	constructor(grammarWorkspace: GrammarWorkspace) {
		this.#grammarWorkspace = grammarWorkspace;
	}

	provideDocumentSymbols(
		doc: TextDocument,
		_token: CancellationToken,
	): DocumentSymbol[] {
		const { document } = this.#grammarWorkspace.get(doc);

		return document.rules.map(
			(rule) =>
				new DocumentSymbol(
					rule.name,
					rule.definitionText,
					SymbolKind.Function,
					rule.definitionRange,
					rule.nameRange,
				),
		);
	}
}
