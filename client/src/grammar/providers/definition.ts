import type {
	CancellationToken,
	DefinitionProvider,
	Location,
	Position,
	TextDocument,
} from "vscode";
import { CORE_RULES } from "../../abnf/core-rules.ts";
import { coreRuleDefinitionLocation } from "../core-rules-document.ts";
import type { GrammarWorkspace } from "../workspace.ts";
import { collectWorkspaceDefinitionLocations } from "./symbol-locations.ts";
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

		const definitions = collectWorkspaceDefinitionLocations(
			this.#grammarWorkspace,
			lookup.word,
			lookup.dialect,
			doc.uri.toString(),
			lookup.symbolTable,
			doc.uri,
		);
		if (definitions.length > 0) {
			return definitions;
		}
		if (lookup.dialect !== "abnf" || !CORE_RULES.has(lookup.word)) {
			return undefined;
		}
		const location = coreRuleDefinitionLocation(lookup.word);
		return location ? [location] : undefined;
	}
}
