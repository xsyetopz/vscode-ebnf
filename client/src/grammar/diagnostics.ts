import {
	type Diagnostic,
	type DiagnosticCollection,
	DiagnosticSeverity,
	type TextDocument,
	workspace,
} from "vscode";
import { CORE_RULE_NAMES } from "../abnf/core-rules.ts";
import { tokenize } from "../abnf/tokenizer.ts";
import { AbnfTokenKind } from "../abnf/types.ts";
import { type GrammarDialect, normalizeSymbolName } from "./grammar.ts";
import type { GrammarWorkspace } from "./workspace.ts";

const DEFAULT_DIAGNOSTIC_SOURCE = "bnf";

type ManagerResult = ReturnType<GrammarWorkspace["get"]>;

function getConfigValue<T>(
	dialect: GrammarDialect,
	key: string,
	fallback: T,
): T {
	const modern = workspace.getConfiguration("bnf");
	const value = modern.get<T>(key);
	if (value !== undefined) {
		return value;
	}
	if (dialect === "abnf") {
		return workspace.getConfiguration("abnf").get<T>(key, fallback);
	}
	return fallback;
}

function collectIncrementalRuleNames(text: string): Set<string> {
	const tokens = tokenize(text);
	const incremental = new Set<string>();

	for (let i = 0; i < tokens.length; i++) {
		const tok = tokens[i];
		if (!tok || tok.kind !== AbnfTokenKind.Rulename || tok.column !== 0) {
			continue;
		}
		let j = i + 1;
		while (j < tokens.length && tokens[j]?.kind === AbnfTokenKind.Whitespace) {
			j++;
		}
		const after = tokens[j];
		if (after !== undefined && after.kind === AbnfTokenKind.IncrementalAs) {
			incremental.add(tok.text.toLowerCase());
		}
	}

	return incremental;
}

function isBuiltinReference(name: string, dialect: GrammarDialect): boolean {
	return dialect === "abnf" && CORE_RULE_NAMES.has(name.toLowerCase());
}

function checkUndefinedReferences(result: ManagerResult): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	for (const rule of result.document.rules) {
		for (const ref of rule.references) {
			const key = normalizeSymbolName(ref.name, result.dialect);
			if (
				!(
					result.symbolTable.definitions.has(key) ||
					isBuiltinReference(ref.name, result.dialect)
				)
			) {
				diagnostics.push({
					message: `"${ref.name}" is not defined as a rule in this file`,
					range: ref.range,
					severity: DiagnosticSeverity.Error,
					source: result.dialect,
				});
			}
		}
	}
	return diagnostics;
}

function checkUnusedRules(result: ManagerResult): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	const firstRuleKey = result.document.rules[0]
		? normalizeSymbolName(result.document.rules[0].name, result.dialect)
		: undefined;

	for (const [name, rules] of result.symbolTable.definitions) {
		if (name === firstRuleKey) {
			continue;
		}
		const hasReferences =
			(result.symbolTable.references.get(name)?.length ?? 0) > 0 ||
			isBuiltinReference(name, result.dialect);
		if (!hasReferences) {
			for (const rule of rules) {
				diagnostics.push({
					message: `Rule '${rule.name}' is defined but never referenced`,
					range: rule.nameRange,
					severity: DiagnosticSeverity.Hint,
					source: result.dialect,
				});
			}
		}
	}
	return diagnostics;
}

function checkDuplicateDefinitions(
	result: ManagerResult,
	text: string,
): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	const incrementalNames =
		result.dialect === "abnf"
			? collectIncrementalRuleNames(text)
			: new Set<string>();

	for (const [name, rules] of result.symbolTable.definitions) {
		if (rules.length <= 1 || incrementalNames.has(name)) {
			continue;
		}
		for (const rule of rules) {
			diagnostics.push({
				message: `Duplicate definition of rule "${rule.name}"`,
				range: rule.nameRange,
				severity: DiagnosticSeverity.Warning,
				source: result.dialect,
			});
		}
	}
	return diagnostics;
}

/**
 * Collects syntax and symbol diagnostics for one grammar document.
 */
export function collectGrammarDiagnostics(
	result: ManagerResult,
	text: string,
	options: { undefinedReferences?: boolean; unusedRules?: boolean } = {},
): Diagnostic[] {
	const diagnostics: Diagnostic[] = [...result.document.diagnostics];
	if (options.undefinedReferences ?? true) {
		diagnostics.push(...checkUndefinedReferences(result));
	}
	if (options.unusedRules ?? true) {
		diagnostics.push(...checkUnusedRules(result));
	}
	diagnostics.push(...checkDuplicateDefinitions(result, text));
	for (const diagnostic of diagnostics) {
		diagnostic.source ??= DEFAULT_DIAGNOSTIC_SOURCE;
	}
	return diagnostics;
}

/**
 * Refreshes the VS Code diagnostics collection for a document.
 */
export function updateGrammarDiagnostics(
	doc: TextDocument,
	workspace: GrammarWorkspace,
	collection: DiagnosticCollection,
): void {
	const result = workspace.get(doc);
	if (!getConfigValue<boolean>(result.dialect, "diagnostics.enable", true)) {
		collection.set(doc.uri, []);
		return;
	}

	collection.set(
		doc.uri,
		collectGrammarDiagnostics(result, doc.getText(), {
			undefinedReferences: getConfigValue<boolean>(
				result.dialect,
				"diagnostics.undefinedReferences",
				true,
			),
			unusedRules: getConfigValue<boolean>(
				result.dialect,
				"diagnostics.unusedRules",
				true,
			),
		}),
	);
}
