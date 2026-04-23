import {
	type CancellationToken,
	type DocumentFormattingEditProvider,
	type FormattingOptions,
	Range,
	type TextDocument,
	TextEdit,
	workspace,
} from "vscode";
import {
	type AbnfAlternativeIndent,
	type AbnfBreakAlternatives,
	type AbnfFormatterConfig,
	formatAbnfDocument,
} from "../abnf-format.ts";
import {
	formatProductionGrammarDocument,
	type GenericGrammarFormatterConfig,
} from "./format.ts";
import { grammarDialectFromLanguageId } from "./grammar.ts";

/**
 * VS Code document formatter for ABNF and production grammar dialects.
 */
export class GrammarFormattingProvider
	implements DocumentFormattingEditProvider
{
	provideDocumentFormattingEdits(
		document: TextDocument,
		_options: FormattingOptions,
		_token: CancellationToken,
	): TextEdit[] {
		const text = document.getText();
		if (text.trim().length === 0) {
			return [];
		}
		const config = readFormattingConfig();
		const dialect = grammarDialectFromLanguageId(document.languageId);
		const result =
			dialect === "abnf"
				? formatAbnfDocument(text, config)
				: formatProductionGrammarDocument(text, dialect, config);
		const fullRange = new Range(
			document.positionAt(0),
			document.positionAt(text.length),
		);
		return [TextEdit.replace(fullRange, result)];
	}
}

function readConfig<T>(key: string, fallback: T): T {
	return (
		workspace.getConfiguration("bnf").get<T>(key) ??
		workspace.getConfiguration("abnf").get<T>(key, fallback)
	);
}

function readFormattingConfig(): AbnfFormatterConfig &
	GenericGrammarFormatterConfig {
	return {
		alignEquals: readConfig<boolean>("formatting.alignEquals", true),
		continuationIndent: readConfig<number>("formatting.continuationIndent", 4),
		alternativeIndent: readConfig<AbnfAlternativeIndent>(
			"formatting.alternativeIndent",
			"align",
		),
		insertFinalNewline: readConfig<boolean>(
			"formatting.insertFinalNewline",
			true,
		),
		blankLinesBetweenRules: readConfig<number>(
			"formatting.blankLinesBetweenRules",
			1,
		),
		breakAlternatives: readConfig<AbnfBreakAlternatives>(
			"formatting.breakAlternatives",
			"always",
		),
		maxLineLength: readConfig<number>("formatting.maxLineLength", 80),
		preserveContinuationLineBreaks: readConfig<boolean>(
			"formatting.preserveContinuationLineBreaks",
			false,
		),
		spaceBeforeInlineComment: readConfig<number>(
			"formatting.spaceBeforeInlineComment",
			2,
		),
		alignProductionNumbers: readConfig<boolean>(
			"formatting.alignProductionNumbers",
			true,
		),
		preserveCommentSpacing: readConfig<boolean>(
			"formatting.preserveCommentSpacing",
			true,
		),
		trimTrailingBlankLines: readConfig<boolean>(
			"formatting.trimTrailingBlankLines",
			true,
		),
	};
}
