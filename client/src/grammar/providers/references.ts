import type {
	CancellationToken,
	Location,
	Position,
	ReferenceContext,
	ReferenceProvider,
	TextDocument,
} from "vscode";
import { CORE_RULES } from "../../abnf/core-rules.ts";
import { coreRuleDefinitionLocation } from "../core-rules-document.ts";
import type { GrammarWorkspace } from "../workspace.ts";
import {
	collectWorkspaceDefinitionLocations,
	collectWorkspaceSymbolLocations,
} from "./symbol-locations.ts";
import { getWordLookup } from "./word-at-position.ts";

/**
 * VS Code reference provider for grammar symbols.
 */
export class GrammarReferenceProvider implements ReferenceProvider {
	readonly #grammarWorkspace: GrammarWorkspace;

	constructor(grammarWorkspace: GrammarWorkspace) {
		this.#grammarWorkspace = grammarWorkspace;
	}

	provideReferences(
		doc: TextDocument,
		position: Position,
		context: ReferenceContext,
		_token: CancellationToken,
	): Location[] | undefined {
		const lookup = getWordLookup(doc, position, this.#grammarWorkspace);
		if (!lookup) {
			return undefined;
		}

		const locations = collectWorkspaceSymbolLocations(
			this.#grammarWorkspace,
			lookup.word,
			lookup.dialect,
			doc.uri.toString(),
			lookup.symbolTable,
			doc.uri,
			context.includeDeclaration,
		);
		if (
			context.includeDeclaration &&
			lookup.dialect === "abnf" &&
			CORE_RULES.has(lookup.word)
		) {
			const definitions = collectWorkspaceDefinitionLocations(
				this.#grammarWorkspace,
				lookup.word,
				lookup.dialect,
				doc.uri.toString(),
				lookup.symbolTable,
				doc.uri,
			);
			if (definitions.length === 0) {
				const location = coreRuleDefinitionLocation(lookup.word);
				if (location) {
					locations.unshift(location);
				}
			}
		}
		return locations.length > 0 ? locations : undefined;
	}
}
