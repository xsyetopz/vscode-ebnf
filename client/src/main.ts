import type { ExtensionContext } from "vscode";
import {
	activateGrammarExtension,
	deactivateGrammarExtension,
} from "./extension.ts";

/**
 * VS Code activation entrypoint.
 */
export function activate(context: ExtensionContext): Promise<void> {
	return activateGrammarExtension(context);
}

/**
 * VS Code deactivation entrypoint.
 */
export function deactivate(): void {
	deactivateGrammarExtension();
}
