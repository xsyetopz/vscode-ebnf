import type {
	CancellationToken,
	DocumentHighlight,
	DocumentHighlightProvider,
	Position,
	TextDocument,
} from "vscode";
import type { GrammarWorkspace } from "../workspace.ts";
import { collectDocumentHighlights } from "./symbol-locations.ts";
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
		const highlights = collectDocumentHighlights(
			lookup.symbolTable,
			lookup.word,
		);
		return highlights.length > 0 ? highlights : undefined;
	}
}
