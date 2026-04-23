import {
	type CancellationToken,
	type Position,
	type Range,
	type RenameProvider,
	type TextDocument,
	WorkspaceEdit,
} from "vscode";
import type { GrammarWorkspace } from "../workspace.ts";
import { getWordLookup } from "./word-at-position.ts";

/**
 * VS Code rename provider for grammar symbols.
 */
export class GrammarRenameProvider implements RenameProvider {
	readonly #grammarWorkspace: GrammarWorkspace;

	constructor(grammarWorkspace: GrammarWorkspace) {
		this.#grammarWorkspace = grammarWorkspace;
	}

	provideRenameEdits(
		doc: TextDocument,
		position: Position,
		newName: string,
		_token: CancellationToken,
	): WorkspaceEdit | undefined {
		const lookup = getWordLookup(doc, position, this.#grammarWorkspace);
		if (!lookup) {
			return undefined;
		}

		const edit = new WorkspaceEdit();

		const defs = lookup.symbolTable.definitions.get(lookup.word);
		if (defs) {
			for (const rule of defs) {
				edit.replace(doc.uri, rule.nameRange, newName);
			}
		}

		const refs = lookup.symbolTable.references.get(lookup.word);
		if (refs) {
			for (const ref of refs) {
				edit.replace(doc.uri, ref.range, newName);
			}
		}

		return edit;
	}

	prepareRename(
		doc: TextDocument,
		position: Position,
		_token: CancellationToken,
	): { range: Range; placeholder: string } | undefined {
		const lookup = getWordLookup(doc, position, this.#grammarWorkspace);
		if (!lookup) {
			return undefined;
		}
		return { range: lookup.wordRange, placeholder: lookup.word };
	}
}
