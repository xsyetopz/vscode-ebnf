import {
	type CancellationToken,
	Location,
	type Position,
	type ReferenceContext,
	type ReferenceProvider,
	type TextDocument,
	type Uri,
} from "vscode";
import type { GrammarWorkspace } from "../workspace.ts";
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

		const currentUri = doc.uri.toString();
		const locations: Location[] = collectLocationsFromFile(
			lookup.symbolTable,
			lookup.word,
			doc.uri,
			context.includeDeclaration,
		);

		for (const file of this.#grammarWorkspace.getAllFiles(lookup.dialect)) {
			if (file.uri.toString() === currentUri) {
				continue;
			}
			const fileLocations = collectLocationsFromFile(
				file.symbolTable,
				lookup.word,
				file.uri,
				context.includeDeclaration,
			);
			locations.push(...fileLocations);
		}

		return locations.length > 0 ? locations : undefined;
	}
}

type SymbolTable = ReturnType<GrammarWorkspace["get"]>["symbolTable"];

function collectLocationsFromFile(
	symbolTable: SymbolTable,
	word: string,
	uri: Uri,
	includeDeclaration: boolean,
): Location[] {
	const locations: Location[] = [];

	if (includeDeclaration) {
		const defs = symbolTable.definitions.get(word);
		if (defs) {
			for (const rule of defs) {
				locations.push(new Location(uri, rule.nameRange));
			}
		}
	}

	const refs = symbolTable.references.get(word);
	if (refs) {
		for (const ref of refs) {
			locations.push(new Location(uri, ref.range));
		}
	}

	return locations;
}
