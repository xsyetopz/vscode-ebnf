import {
	type DiagnosticCollection,
	type DocumentSelector,
	languages,
} from "vscode";
import { GrammarCodeActionProvider } from "../code-actions.ts";
import { GrammarCompletionProvider } from "../completion.ts";
import { GrammarFormattingProvider } from "../formatting-provider.ts";
import {
	GRAMMAR_SEMANTIC_TOKENS_LEGEND,
	GrammarSemanticTokensProvider,
} from "../semantic-tokens.ts";
import type { GrammarWorkspace } from "../workspace.ts";
import { GrammarDefinitionProvider } from "./definition.ts";
import { GrammarFoldingRangeProvider } from "./folding.ts";
import { GrammarDocumentHighlightProvider } from "./highlighting.ts";
import { GrammarHoverProvider } from "./hover.ts";
import { GrammarInlayHintsProvider } from "./inlay-hints.ts";
import { GrammarReferenceProvider } from "./references.ts";
import { GrammarRenameProvider } from "./rename.ts";
import { GrammarDocumentSymbolProvider } from "./symbols.ts";
import { GrammarWorkspaceSymbolProvider } from "./workspace-symbols.ts";

/**
 * Registers all grammar language providers for the extension.
 */
export function registerGrammarProviders(
	selector: DocumentSelector,
	workspace: GrammarWorkspace,
	diagnosticCollection: DiagnosticCollection,
) {
	return [
		languages.registerDocumentSymbolProvider(
			selector,
			new GrammarDocumentSymbolProvider(workspace),
		),
		languages.registerDefinitionProvider(
			selector,
			new GrammarDefinitionProvider(workspace),
		),
		languages.registerReferenceProvider(
			selector,
			new GrammarReferenceProvider(workspace),
		),
		languages.registerHoverProvider(
			selector,
			new GrammarHoverProvider(workspace),
		),
		languages.registerRenameProvider(
			selector,
			new GrammarRenameProvider(workspace),
		),
		languages.registerDocumentHighlightProvider(
			selector,
			new GrammarDocumentHighlightProvider(workspace),
		),
		languages.registerFoldingRangeProvider(
			selector,
			new GrammarFoldingRangeProvider(workspace),
		),
		languages.registerInlayHintsProvider(
			selector,
			new GrammarInlayHintsProvider(workspace),
		),
		languages.registerDocumentSemanticTokensProvider(
			selector,
			new GrammarSemanticTokensProvider(workspace),
			GRAMMAR_SEMANTIC_TOKENS_LEGEND,
		),
		languages.registerCompletionItemProvider(
			selector,
			new GrammarCompletionProvider(workspace),
			"<",
			"%",
			"#",
			'"',
			"'",
		),
		languages.registerCodeActionsProvider(
			selector,
			new GrammarCodeActionProvider(),
			GrammarCodeActionProvider.metadata,
		),
		languages.registerDocumentFormattingEditProvider(
			selector,
			new GrammarFormattingProvider(),
		),
		languages.registerWorkspaceSymbolProvider(
			new GrammarWorkspaceSymbolProvider(workspace),
		),
		diagnosticCollection,
	];
}
