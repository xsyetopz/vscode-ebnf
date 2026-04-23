import { mock } from "bun:test";

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
}

mock.module("vscode", () => ({
	DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
	Position: PositionMock,
	Range: RangeMock,
	workspace: {
		getConfiguration: () => ({
			get: <T>(_key: string, fallback?: T) => fallback,
		}),
	},
}));
