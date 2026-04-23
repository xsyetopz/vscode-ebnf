import type { Diagnostic, Range } from "vscode";

/**
 * Reference to a grammar identifier in a source range.
 */
export interface IdentifierReference {
	name: string;
	range: Range;
}

/**
 * Parsed grammar rule with definition and reference metadata.
 */
export interface Rule {
	name: string;
	nameRange: Range;
	definitionRange: Range;
	definitionText: string;
	precedingComment?: string | undefined;
	references: IdentifierReference[];
	isIncremental?: boolean;
	isCoreRule?: boolean;
}

/**
 * Parsed grammar document with rules and diagnostics.
 */
export interface GrammarDocument {
	rules: Rule[];
	diagnostics: Diagnostic[];
}

/**
 * Definition and reference indexes for parsed grammar rules.
 */
export interface SymbolTable {
	definitions: Map<string, Rule[]>;
	references: Map<string, IdentifierReference[]>;
}
