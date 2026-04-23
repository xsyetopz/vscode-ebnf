import { buildAbnfSymbolTable } from "../abnf/parser.ts";
import type {
	GrammarDocument,
	IdentifierReference,
	Rule,
	SymbolTable,
} from "../types.ts";
import type { GrammarDialect } from "./dialects.ts";

/**
 * Normalizes rule names for dialect-specific lookup keys.
 */
export function normalizeSymbolName(
	name: string,
	_dialect: GrammarDialect,
): string {
	return name.toLowerCase();
}

/**
 * Builds definition and reference indexes for any supported grammar dialect.
 */
export function buildGrammarSymbolTable(
	doc: GrammarDocument,
	dialect: GrammarDialect,
): SymbolTable {
	if (dialect === "abnf") {
		return buildAbnfSymbolTable(doc);
	}
	const definitions = new Map<string, Rule[]>();
	const references = new Map<string, IdentifierReference[]>();
	for (const rule of doc.rules) {
		const key = normalizeSymbolName(rule.name, dialect);
		definitions.set(key, [...(definitions.get(key) ?? []), rule]);
		for (const ref of rule.references) {
			const refKey = normalizeSymbolName(ref.name, dialect);
			references.set(refKey, [...(references.get(refKey) ?? []), ref]);
		}
	}
	return { definitions, references };
}
