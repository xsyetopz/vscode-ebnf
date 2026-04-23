import type { Position, Range, TextDocument } from "vscode";
import type { SymbolTable } from "../../types.ts";
import { type GrammarDialect, normalizeSymbolName } from "../grammar.ts";
import type { GrammarWorkspace } from "../workspace.ts";

/**
 * Resolved grammar word and symbol context at a document position.
 */
export interface WordLookup {
	word: string;
	wordRange: Range;
	symbolTable: SymbolTable;
	dialect: GrammarDialect;
}

/**
 * Fallback single-word identifier pattern for grammar lookups.
 */
export const IDENTIFIER_PATTERN = /[a-zA-Z][a-zA-Z0-9-]*/;

const EBNF_CHAR_CLASS_RE = /\[(?:\^)?[^\]\r\n]*\]/g;
const EBNF_CHAR_CODE_RE = /#x[0-9A-Fa-f]+/g;

/**
 * Finds the grammar symbol under a VS Code document position.
 */
export function getWordLookup(
	doc: TextDocument,
	position: Position,
	grammarWorkspace: GrammarWorkspace,
): WordLookup | undefined {
	const spacedResult = findSpacedIdentifierRange(
		doc,
		position,
		grammarWorkspace,
	);
	if (spacedResult) {
		spacedResult.word = normalizeSymbolName(
			spacedResult.word,
			spacedResult.dialect,
		);
		return spacedResult;
	}

	if (isEbnfCharacterSyntax(doc, position)) {
		return undefined;
	}

	const wordRange = doc.getWordRangeAtPosition(position, IDENTIFIER_PATTERN);
	if (!wordRange) {
		return undefined;
	}

	const { dialect, symbolTable } = grammarWorkspace.get(doc);
	const word = normalizeSymbolName(doc.getText(wordRange), dialect);
	return { word, wordRange, symbolTable, dialect };
}

function positionInRange(pos: Position, range: Range): boolean {
	if (pos.line < range.start.line || pos.line > range.end.line) {
		return false;
	}
	if (pos.line === range.start.line && pos.character < range.start.character) {
		return false;
	}
	if (pos.line === range.end.line && pos.character > range.end.character) {
		return false;
	}
	return true;
}

function findSpacedIdentifierRange(
	doc: TextDocument,
	position: Position,
	grammarWorkspace: GrammarWorkspace,
):
	| {
			word: string;
			wordRange: Range;
			symbolTable: SymbolTable;
			dialect: GrammarDialect;
	  }
	| undefined {
	const {
		dialect,
		document: grammarDoc,
		symbolTable,
	} = grammarWorkspace.get(doc);

	for (const rule of grammarDoc.rules) {
		if (positionInRange(position, rule.nameRange)) {
			return {
				word: rule.name,
				wordRange: rule.nameRange,
				symbolTable,
				dialect,
			};
		}
		for (const ref of rule.references) {
			if (positionInRange(position, ref.range)) {
				return {
					word: ref.name,
					wordRange: ref.range,
					symbolTable,
					dialect,
				};
			}
		}
	}

	return undefined;
}

function isEbnfCharacterSyntax(doc: TextDocument, position: Position): boolean {
	if (doc.languageId !== "ebnf") {
		return false;
	}
	const line = doc.lineAt(position.line).text;
	return (
		containsPosition(line, position.character, EBNF_CHAR_CLASS_RE) ||
		containsPosition(line, position.character, EBNF_CHAR_CODE_RE)
	);
}

function containsPosition(
	line: string,
	character: number,
	pattern: RegExp,
): boolean {
	for (const match of line.matchAll(pattern)) {
		const start = match.index ?? 0;
		const end = start + (match[0] ?? "").length;
		if (character >= start && character <= end) {
			return true;
		}
	}
	return false;
}
