import {
	type CancellationToken,
	Location,
	SymbolInformation,
	SymbolKind,
	type WorkspaceSymbolProvider,
} from "vscode";
import type { GrammarWorkspace } from "../workspace.ts";

/**
 * VS Code workspace symbol provider backed by the grammar index.
 */
export class GrammarWorkspaceSymbolProvider implements WorkspaceSymbolProvider {
	readonly #index: GrammarWorkspace;

	constructor(index: GrammarWorkspace) {
		this.#index = index;
	}

	provideWorkspaceSymbols(
		query: string,
		_token: CancellationToken,
	): SymbolInformation[] {
		if (!query) {
			return [];
		}

		return this.#index
			.searchSymbols(query)
			.map(
				(entry) =>
					new SymbolInformation(
						entry.rule.name,
						SymbolKind.Function,
						"",
						new Location(entry.uri, entry.rule.nameRange),
					),
			);
	}
}
