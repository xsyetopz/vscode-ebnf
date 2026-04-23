import {
	type CancellationToken,
	CodeAction,
	type CodeActionContext,
	CodeActionKind,
	type CodeActionProvider,
	Position,
	type Range,
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
			const match = diagnostic.message.match(UNDEFINED_RULE_RE);
			return match ? [createRuleAction(doc, diagnostic, match[1] ?? "")] : [];
		});
		return actions.length > 0 ? actions : undefined;
	}
}

const UNDEFINED_RULE_RE = /"([^"]+)" is not defined/;

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
