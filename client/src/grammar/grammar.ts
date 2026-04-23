import { parseAbnf } from "../abnf/parser.ts";
import type { GrammarDocument } from "../types.ts";
import {
	GRAMMAR_DIALECTS,
	GRAMMAR_LANGUAGE_IDS,
	type GrammarDialect,
	type GrammarDialectDescriptor,
	getGrammarDialectDescriptor,
	grammarDialectFromLanguageId,
	grammarDialectFromPath,
	isGrammarLanguage,
	languageIdsSelector,
} from "./dialects.ts";
import { parseProductionGrammar } from "./parser.ts";
import {
	buildGrammarSymbolTable,
	normalizeSymbolName,
} from "./symbol-table.ts";

export {
	buildGrammarSymbolTable,
	GRAMMAR_DIALECTS,
	GRAMMAR_LANGUAGE_IDS,
	type GrammarDialect,
	type GrammarDialectDescriptor,
	getGrammarDialectDescriptor,
	grammarDialectFromLanguageId,
	grammarDialectFromPath,
	isGrammarLanguage,
	languageIdsSelector,
	normalizeSymbolName,
};

/**
 * Parses source text using the selected grammar dialect.
 */
export function parseGrammar(
	text: string,
	dialect: GrammarDialect,
): GrammarDocument {
	return dialect === "abnf"
		? parseAbnf(text)
		: parseProductionGrammar(text, dialect);
}
