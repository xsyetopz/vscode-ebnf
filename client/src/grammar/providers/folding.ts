import {
	type CancellationToken,
	FoldingRange,
	type FoldingRangeProvider,
	type TextDocument,
} from "vscode";
import type { GrammarWorkspace } from "../workspace.ts";

/**
 * VS Code folding provider for multi-line grammar rules.
 */
export class GrammarFoldingRangeProvider implements FoldingRangeProvider {
	readonly #grammarWorkspace: GrammarWorkspace;

	constructor(grammarWorkspace: GrammarWorkspace) {
		this.#grammarWorkspace = grammarWorkspace;
	}

	provideFoldingRanges(
		doc: TextDocument,
		_context: unknown,
		_token: CancellationToken,
	): FoldingRange[] {
		const { document } = this.#grammarWorkspace.get(doc);
		const ranges: FoldingRange[] = [];

		for (const rule of document.rules) {
			const startLine = rule.definitionRange.start.line;
			const endLine = rule.definitionRange.end.line;
			if (endLine > startLine) {
				ranges.push(new FoldingRange(startLine, endLine));
			}
		}

		return ranges;
	}
}
