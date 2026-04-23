import {
	type ExtensionContext,
	languages,
	type TextDocument,
	type TextDocumentContentProvider,
	workspace,
} from "vscode";
import {
	BNF_CORE_RULES_SCHEME,
	renderCoreRulesDocument,
} from "./grammar/core-rules-document.ts";
import { updateGrammarDiagnostics } from "./grammar/diagnostics.ts";
import { isGrammarLanguage, languageIdsSelector } from "./grammar/grammar.ts";
import { registerGrammarProviders } from "./grammar/providers/index.ts";
import { GrammarWorkspace } from "./grammar/workspace.ts";

const SELECTOR = languageIdsSelector();

/**
 * Activates the BNF extension runtime and registers VS Code integrations.
 */
export async function activateGrammarExtension(
	context: ExtensionContext,
): Promise<void> {
	const grammarWorkspace = new GrammarWorkspace();
	await grammarWorkspace.initialize();
	const diagnosticCollection = languages.createDiagnosticCollection("bnf");

	context.subscriptions.push(
		grammarWorkspace,
		workspace.registerTextDocumentContentProvider(
			BNF_CORE_RULES_SCHEME,
			CORE_RULES_DOCUMENT_PROVIDER,
		),
		...registerGrammarProviders(
			SELECTOR,
			grammarWorkspace,
			diagnosticCollection,
		),
	);

	function updateDocumentDiagnostics(doc: TextDocument): void {
		if (isGrammarLanguage(doc.languageId)) {
			updateGrammarDiagnostics(doc, grammarWorkspace, diagnosticCollection);
		}
	}

	context.subscriptions.push(
		workspace.onDidOpenTextDocument((doc) => {
			updateDocumentDiagnostics(doc);
		}),
		workspace.onDidChangeTextDocument((event) => {
			grammarWorkspace.scheduleReparse(
				event.document,
				updateDocumentDiagnostics,
			);
		}),
		workspace.onDidCloseTextDocument((doc) => {
			const uri = doc.uri.toString();
			grammarWorkspace.removeDocument(uri);
			diagnosticCollection.delete(doc.uri);
		}),
	);

	for (const doc of workspace.textDocuments) {
		updateDocumentDiagnostics(doc);
	}
}

/**
 * Disposes extension-level resources owned outside the VS Code subscription list.
 */
export function deactivateGrammarExtension(): void {
	// VS Code disposes extension subscriptions.
}

const CORE_RULES_DOCUMENT_PROVIDER: TextDocumentContentProvider = {
	provideTextDocumentContent: () => renderCoreRulesDocument(),
};
