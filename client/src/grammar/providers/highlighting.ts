import {
	type CancellationToken,
	DocumentHighlight,
	DocumentHighlightKind,
	type DocumentHighlightProvider,
	type Position,
	type TextDocument,
} from "vscode";
import type { GrammarWorkspace } from "../workspace.ts";
import { getWordLookup } from "./word-at-position.ts";

/**
 * VS Code document highlight provider for grammar symbol occurrences.
 */
export class GrammarDocumentHighlightProvider
	implements DocumentHighlightProvider
{
	readonly #grammarWorkspace: GrammarWorkspace;

	constructor(grammarWorkspace: GrammarWorkspace) {
		this.#grammarWorkspace = grammarWorkspace;
	}

	provideDocumentHighlights(
		doc: TextDocument,
		position: Position,
		_token: CancellationToken,
	): DocumentHighlight[] | undefined {
		const lookup = getWordLookup(doc, position, this.#grammarWorkspace);
		if (!lookup) {
			return undefined;
		}

		const highlights: DocumentHighlight[] = [];

		const defs = lookup.symbolTable.definitions.get(lookup.word);
		if (defs) {
			for (const rule of defs) {
				highlights.push(
					new DocumentHighlight(rule.nameRange, DocumentHighlightKind.Write),
				);
			}
		}

		const refs = lookup.symbolTable.references.get(lookup.word);
		if (refs) {
			for (const ref of refs) {
				highlights.push(
					new DocumentHighlight(ref.range, DocumentHighlightKind.Read),
				);
			}
		}

		return highlights.length > 0 ? highlights : undefined;
	}
}
