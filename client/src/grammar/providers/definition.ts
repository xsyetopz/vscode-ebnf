import {
	type CancellationToken,
	type DefinitionProvider,
	Location,
	type Position,
	type TextDocument,
} from "vscode";
import type { GrammarWorkspace } from "../workspace.ts";
import { getWordLookup } from "./word-at-position.ts";

/**
 * VS Code definition provider for grammar rule references.
 */
export class GrammarDefinitionProvider implements DefinitionProvider {
	readonly #grammarWorkspace: GrammarWorkspace;

	constructor(grammarWorkspace: GrammarWorkspace) {
		this.#grammarWorkspace = grammarWorkspace;
	}

	provideDefinition(
		doc: TextDocument,
		position: Position,
		_token: CancellationToken,
	): Location[] | undefined {
		const lookup = getWordLookup(doc, position, this.#grammarWorkspace);
		if (!lookup) {
			return undefined;
		}

		const definitions = lookup.symbolTable.definitions.get(lookup.word);
		if (definitions && definitions.length > 0) {
			return definitions.map((rule) => new Location(doc.uri, rule.nameRange));
		}

		const workspaceDefs = this.#grammarWorkspace.findDefinitions(
			lookup.word,
			lookup.dialect,
		);
		if (workspaceDefs.length > 0) {
			return workspaceDefs.map(
				(entry) => new Location(entry.uri, entry.rule.nameRange),
			);
		}

		return undefined;
	}
}
