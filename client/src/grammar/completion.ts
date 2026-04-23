import {
	type CancellationToken,
	CompletionItem,
	CompletionItemKind,
	type CompletionItemProvider,
	type Position,
	SnippetString,
	type TextDocument,
} from "vscode";
import { CORE_RULES } from "../abnf/core-rules.ts";
import { getGrammarDialectDescriptor, normalizeSymbolName } from "./grammar.ts";
import type { GrammarWorkspace } from "./workspace.ts";

/**
 * VS Code completion provider for grammar rule names.
 */
export class GrammarCompletionProvider implements CompletionItemProvider {
	readonly #manager: GrammarWorkspace;

	constructor(manager: GrammarWorkspace) {
		this.#manager = manager;
	}

	provideCompletionItems(
		doc: TextDocument,
		_position: Position,
		_token: CancellationToken,
	): CompletionItem[] {
		const result = this.#manager.get(doc);
		return [
			...ruleCompletions(result, this.#manager),
			...coreRuleCompletions(result.dialect),
			...dialectSnippetCompletions(result.dialect),
		];
	}
}

type ManagerResult = ReturnType<GrammarWorkspace["get"]>;

function ruleCompletions(
	result: ManagerResult,
	workspace: GrammarWorkspace,
): CompletionItem[] {
	const { assignmentOperator: operator } = getGrammarDialectDescriptor(
		result.dialect,
	);
	const seen = new Set<string>();
	const items: CompletionItem[] = [];
	for (const rules of result.symbolTable.definitions.values()) {
		addRuleCompletion(items, seen, rules[0], result.dialect, operator, false);
	}
	for (const file of workspace.getAllFiles(result.dialect)) {
		for (const rule of file.rules) {
			addRuleCompletion(items, seen, rule, result.dialect, operator, true);
		}
	}
	return items;
}

function addRuleCompletion(
	items: CompletionItem[],
	seen: Set<string>,
	rule: ManagerResult["document"]["rules"][number] | undefined,
	dialect: ManagerResult["dialect"],
	operator: string,
	workspaceRule: boolean,
): void {
	if (!rule || rule.isCoreRule) {
		return;
	}
	const key = normalizeSymbolName(rule.name, dialect);
	if (seen.has(key)) {
		return;
	}
	seen.add(key);
	const item = new CompletionItem(rule.name, CompletionItemKind.Function);
	item.detail = `${rule.name} ${operator} ${rule.definitionText}`;
	if (rule.precedingComment) {
		item.documentation = rule.precedingComment;
	}
	if (workspaceRule) {
		item.detail = `${item.detail} (workspace)`;
	}
	items.push(item);
}

function coreRuleCompletions(
	dialect: ManagerResult["dialect"],
): CompletionItem[] {
	if (dialect !== "abnf") {
		return [];
	}
	return Array.from(CORE_RULES.values(), (rule) => {
		const item = new CompletionItem(rule.name, CompletionItemKind.Constant);
		item.detail = `${rule.name} = ${rule.definitionText}`;
		item.documentation = "Core rule (RFC 5234 Appendix B)";
		return item;
	});
}

function placeholder(value: string): string {
	return `\${${value}}`;
}

function snippet(label: string, body: string, detail: string): CompletionItem {
	const item = new CompletionItem(label, CompletionItemKind.Snippet);
	item.insertText = new SnippetString(body);
	item.detail = detail;
	return item;
}

function dialectSnippetCompletions(
	dialect: ManagerResult["dialect"],
): CompletionItem[] {
	switch (dialect) {
		case "abnf":
			return [
				snippet(
					"%x hex value",
					`%x${placeholder("1:20")}`,
					"ABNF hex terminal",
				),
				snippet(
					"%d decimal value",
					`%d${placeholder("1:32")}`,
					"ABNF decimal terminal",
				),
				snippet(
					"%b binary value",
					`%b${placeholder("1:01000001")}`,
					"ABNF binary terminal",
				),
				snippet(
					"case-sensitive string",
					`%s"${placeholder("1:text")}"`,
					"RFC 7405 string",
				),
				snippet(
					"case-insensitive string",
					`%i"${placeholder("1:text")}"`,
					"RFC 7405 string",
				),
				snippet(
					"repetition",
					`${placeholder("1:min")}*${placeholder("2:max")}(${placeholder("3:element")})`,
					"ABNF repetition",
				),
			];
		case "ebnf":
			return [
				snippet(
					"production",
					`[${placeholder("1:1")}] ${placeholder("2:name")} ::= ${placeholder("3:expression")}`,
					"W3C XML EBNF production",
				),
				snippet(
					"character code",
					`#x${placeholder("1:20")}`,
					"W3C XML EBNF character",
				),
				snippet(
					"character range",
					`[#x${placeholder("1:20")}-#x${placeholder("2:7E")}]`,
					"W3C XML EBNF character class",
				),
			];
		case "rbnf":
			return [
				snippet(
					"RBNF rule",
					`<${placeholder("1:rule name")}> ::= ${placeholder("2:expression")}`,
					"RFC 5511 rule",
				),
				snippet(
					"RBNF repeat",
					`*(${placeholder("1:element")})`,
					"RFC 5511 zero-or-more repetition",
				),
				snippet(
					"RBNF one-or-more",
					`1*(${placeholder("1:element")})`,
					"RFC 5511 one-or-more repetition",
				),
			];
		case "bnf":
			return [
				snippet(
					"BNF rule",
					`<${placeholder("1:rule-name")}> ::= ${placeholder("2:expression")}`,
					"BNF production",
				),
				snippet(
					"BNF reference",
					`<${placeholder("1:rule-name")}>`,
					"BNF nonterminal reference",
				),
			];
		default:
			return [];
	}
}
