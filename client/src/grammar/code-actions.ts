import {
	type CancellationToken,
	CodeAction,
	type CodeActionContext,
	CodeActionKind,
	type CodeActionProvider,
	Position,
	Range,
	type TextDocument,
	WorkspaceEdit,
} from "vscode";
import {
	getGrammarDialectDescriptor,
	grammarDialectFromLanguageId,
} from "./grammar.ts";

/**
 * VS Code quick-fix provider for grammar diagnostics.
 */
export class GrammarCodeActionProvider implements CodeActionProvider {
	static readonly metadata = {
		providedCodeActionKinds: [CodeActionKind.QuickFix],
	};

	provideCodeActions(
		doc: TextDocument,
		_range: Range,
		context: CodeActionContext,
		_token: CancellationToken,
	): CodeAction[] | undefined {
		const actions = context.diagnostics.flatMap((diagnostic) => {
			const undefinedMatch = diagnostic.message.match(UNDEFINED_RULE_RE);
			if (undefinedMatch) {
				return [createRuleAction(doc, diagnostic, undefinedMatch[1] ?? "")];
			}
			if (diagnostic.message.includes("W3C XML EBNF requires '::='")) {
				return [replaceIsoAssignmentAction(doc, diagnostic)];
			}
			return [];
		});
		return actions.length > 0 ? actions : undefined;
	}
}

const UNDEFINED_RULE_RE = /"([^"]+)" is not defined/;
const ISO_ASSIGNMENT_RE = /(^|\s)=/;

function createRuleAction(
	doc: TextDocument,
	diagnostic: CodeActionContext["diagnostics"][number],
	name: string,
): CodeAction {
	const action = new CodeAction(
		`Create rule '${name}'`,
		CodeActionKind.QuickFix,
	);
	const edit = new WorkspaceEdit();
	const lastLine = doc.lineCount - 1;
	const lastLineText = doc.lineAt(lastLine).text;
	const insertPos = new Position(lastLine, lastLineText.length);
	const dialect = grammarDialectFromLanguageId(doc.languageId);
	const operator = getGrammarDialectDescriptor(dialect).assignmentOperator;
	const prefix = lastLineText.length > 0 ? "\n\n" : "\n";
	edit.insert(doc.uri, insertPos, `${prefix}${name} ${operator}\n    `);
	action.edit = edit;
	action.diagnostics = [diagnostic];
	action.isPreferred = true;
	return action;
}

function replaceIsoAssignmentAction(
	doc: TextDocument,
	diagnostic: CodeActionContext["diagnostics"][number],
): CodeAction {
	const action = new CodeAction(
		"Replace '=' with '::='",
		CodeActionKind.QuickFix,
	);
	const edit = new WorkspaceEdit();
	const line = doc.lineAt(diagnostic.range.start.line).text;
	const match = line.match(ISO_ASSIGNMENT_RE);
	const assignmentIndex =
		match?.index === undefined ? -1 : match.index + match[0].length - 1;
	if (assignmentIndex >= 0) {
		edit.replace(
			doc.uri,
			new Range(
				diagnostic.range.start.line,
				assignmentIndex,
				diagnostic.range.start.line,
				assignmentIndex + 1,
			),
			"::=",
		);
	}
	action.edit = edit;
	action.diagnostics = [diagnostic];
	action.isPreferred = true;
	return action;
}
