import {
	type CancellationToken,
	Hover,
	type HoverProvider,
	MarkdownString,
	type Position,
	type TextDocument,
} from "vscode";
import type { GrammarWorkspace } from "../workspace.ts";
import { getWordLookup } from "./word-at-position.ts";

/**
 * VS Code hover provider for grammar rule definitions.
 */
export class GrammarHoverProvider implements HoverProvider {
	readonly #grammarWorkspace: GrammarWorkspace;

	constructor(grammarWorkspace: GrammarWorkspace) {
		this.#grammarWorkspace = grammarWorkspace;
	}

	provideHover(
		doc: TextDocument,
		position: Position,
		_token: CancellationToken,
	): Hover | undefined {
		const lookup = getWordLookup(doc, position, this.#grammarWorkspace);
		if (!lookup) {
			return undefined;
		}

		const definitions = lookup.symbolTable.definitions.get(lookup.word);
		const operator = lookup.dialect === "abnf" ? "=" : "::=";
		if (!definitions || definitions.length === 0) {
			return undefined;
		}

		const parts: string[] = [];

		for (const rule of definitions) {
			parts.push(
				`\`\`\`${lookup.dialect}\n${rule.name} ${operator} ${rule.definitionText}\n\`\`\``,
			);
			if (rule.precedingComment) {
				parts.push(rule.precedingComment);
			}
		}

		const md = new MarkdownString(parts.join("\n\n---\n\n"));
		return new Hover(md, lookup.wordRange);
	}
}
