import { mock } from "bun:test";

const configurationValues = new Map<string, unknown>();
const LEADING_SLASHES_RE = /^\/+/;

/**
 * Sets one VS Code configuration value for tests.
 */
export function setConfigurationValue(key: string, value: unknown): void {
	configurationValues.set(key, value);
}

/**
 * Clears test configuration overrides.
 */
export function resetConfigurationValues(): void {
	configurationValues.clear();
}

/**
 * Minimal VS Code Position test double.
 */
export class PositionMock {
	line: number;
	character: number;
	constructor(line: number, character: number) {
		this.line = line;
		this.character = character;
	}
}

/**
 * Minimal VS Code Range test double.
 */
export class RangeMock {
	start: PositionMock;
	end: PositionMock;
	constructor(
		startLine: number | PositionMock,
		startCharacter: number | PositionMock,
		endLine?: number,
		endCharacter?: number,
	) {
		if (
			startLine instanceof PositionMock &&
			startCharacter instanceof PositionMock
		) {
			this.start = startLine;
			this.end = startCharacter;
		} else {
			this.start = new PositionMock(
				startLine as number,
				startCharacter as number,
			);
			this.end = new PositionMock(
				endLine ?? (startLine as number),
				endCharacter ?? (startCharacter as number),
			);
		}
	}

	intersection(other: RangeMock): RangeMock | undefined {
		const start =
			this.start.line > other.start.line ||
			(this.start.line === other.start.line &&
				this.start.character >= other.start.character)
				? this.start
				: other.start;
		const end =
			this.end.line < other.end.line ||
			(this.end.line === other.end.line &&
				this.end.character <= other.end.character)
				? this.end
				: other.end;
		if (
			start.line > end.line ||
			(start.line === end.line && start.character > end.character)
		) {
			return undefined;
		}
		return new RangeMock(start, end);
	}
}

/**
 * Minimal VS Code markdown string test double.
 */
export class MarkdownStringMock {
	value: string;

	constructor(value = "") {
		this.value = value;
	}
}

/**
 * Minimal VS Code hover test double.
 */
export class HoverMock {
	contents: unknown;
	range: unknown;

	constructor(contents: unknown, range?: unknown) {
		this.contents = contents;
		this.range = range;
	}
}

/**
 * Minimal VS Code inlay hint test double.
 */
export class InlayHintMock {
	position: unknown;
	label: unknown;
	kind: unknown;
	paddingLeft: boolean | undefined;

	constructor(position: unknown, label: unknown, kind?: unknown) {
		this.position = position;
		this.label = label;
		this.kind = kind;
		this.paddingLeft = undefined;
	}
}

/**
 * Minimal VS Code snippet string test double.
 */
export class SnippetStringMock {
	value: string;

	constructor(value = "") {
		this.value = value;
	}
}

/**
 * Minimal VS Code completion item test double.
 */
export class CompletionItemMock {
	label: string;
	kind: unknown;
	detail: string | undefined;
	documentation: unknown;
	insertText: unknown;

	constructor(label: string, kind?: unknown) {
		this.label = label;
		this.kind = kind;
		this.detail = undefined;
		this.documentation = undefined;
		this.insertText = undefined;
	}
}

/**
 * Minimal VS Code location test double.
 */
export class LocationMock {
	uri: unknown;
	range: unknown;

	constructor(uri: unknown, range: unknown) {
		this.uri = uri;
		this.range = range;
	}
}

/**
 * Minimal VS Code Uri test double.
 */
export class UriMock {
	scheme: string;
	path: string;

	constructor(scheme: string, path: string) {
		this.scheme = scheme;
		this.path = path;
	}

	static parse(value: string): UriMock {
		const [scheme, ...rest] = value.split(":");
		return new UriMock(
			scheme ?? "",
			rest.join(":").replace(LEADING_SLASHES_RE, "/"),
		);
	}

	toString(): string {
		return `${this.scheme}:${this.path}`;
	}
}

/**
 * Minimal VS Code document highlight test double.
 */
export class DocumentHighlightMock {
	range: unknown;
	kind: unknown;

	constructor(range: unknown, kind?: unknown) {
		this.range = range;
		this.kind = kind;
	}
}

/**
 * Minimal VS Code workspace edit test double.
 */
export class WorkspaceEditMock {
	readonly inserts: Array<{ uri: unknown; position: unknown; text: string }> =
		[];
	readonly replacements: Array<{ uri: unknown; range: unknown; text: string }> =
		[];

	insert(uri: unknown, position: unknown, text: string): void {
		this.inserts.push({ uri, position, text });
	}

	replace(uri: unknown, range: unknown, text: string): void {
		this.replacements.push({ uri, range, text });
	}
}

/**
 * Minimal VS Code code action test double.
 */
export class CodeActionMock {
	title: string;
	kind: unknown;
	edit: unknown;
	diagnostics: unknown;
	isPreferred: boolean | undefined;

	constructor(title: string, kind?: unknown) {
		this.title = title;
		this.kind = kind;
		this.edit = undefined;
		this.diagnostics = undefined;
		this.isPreferred = undefined;
	}
}

/**
 * Minimal VS Code semantic token legend test double.
 */
export class SemanticTokensLegendMock {
	tokenTypes: readonly string[];
	tokenModifiers: readonly string[];

	constructor(
		tokenTypes: readonly string[],
		tokenModifiers: readonly string[],
	) {
		this.tokenTypes = tokenTypes;
		this.tokenModifiers = tokenModifiers;
	}
}

/**
 * Minimal VS Code semantic token builder test double.
 */
export class SemanticTokensBuilderMock {
	readonly entries: Array<{
		range: unknown;
		tokenType: string;
		tokenModifiers: readonly string[];
	}> = [];

	push(
		range: unknown,
		tokenType: string,
		tokenModifiers: readonly string[] = [],
	): void {
		this.entries.push({ range, tokenType, tokenModifiers });
	}

	build() {
		return { data: this.entries };
	}
}

mock.module("vscode", () => ({
	CodeAction: CodeActionMock,
	CodeActionKind: { QuickFix: "quickfix" },
	CompletionItem: CompletionItemMock,
	CompletionItemKind: {
		Constant: 1,
		Function: 2,
		Snippet: 3,
	},
	DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
	DocumentHighlight: DocumentHighlightMock,
	DocumentHighlightKind: { Text: 0, Read: 1, Write: 2 },
	Hover: HoverMock,
	InlayHint: InlayHintMock,
	InlayHintKind: { Type: 1, Parameter: 2 },
	Location: LocationMock,
	MarkdownString: MarkdownStringMock,
	Position: PositionMock,
	Range: RangeMock,
	Uri: UriMock,
	SemanticTokensBuilder: SemanticTokensBuilderMock,
	SemanticTokensLegend: SemanticTokensLegendMock,
	SnippetString: SnippetStringMock,
	WorkspaceEdit: WorkspaceEditMock,
	workspace: {
		getConfiguration: (section = "") => ({
			get: <T>(key: string, fallback?: T) =>
				(configurationValues.get(
					section.length > 0 ? `${section}.${key}` : key,
				) as T | undefined) ?? fallback,
		}),
	},
}));
