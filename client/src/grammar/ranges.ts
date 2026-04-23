import { Range } from "vscode";

/**
 * Single source line with its document offset.
 */
export interface LineInfo {
	text: string;
	line: number;
	offset: number;
}

const LINE_SPLIT_RE = /\r\n|\n|\r/;

/**
 * Creates a VS Code range from one line and two columns.
 */
export function makeSingleLineRange(
	line: number,
	start: number,
	end: number,
): Range {
	return new Range(line, start, line, end);
}

/**
 * Converts absolute document offsets into a VS Code range.
 */
export function rangeFromOffsets(
	text: string,
	start: number,
	end: number,
): Range {
	let line = 0;
	let lineStart = 0;
	let i = 0;
	while (i < start) {
		if (text.charAt(i) === "\n") {
			line++;
			lineStart = i + 1;
		}
		i++;
	}

	let endLine = line;
	let endLineStart = lineStart;
	while (i < end) {
		if (text.charAt(i) === "\n") {
			endLine++;
			endLineStart = i + 1;
		}
		i++;
	}

	return new Range(line, start - lineStart, endLine, end - endLineStart);
}

/**
 * Splits text into lines while preserving starting offsets.
 */
export function splitLinesWithOffsets(text: string): LineInfo[] {
	const lines: LineInfo[] = [];
	let offset = 0;
	const parts = text.split(LINE_SPLIT_RE);
	for (let i = 0; i < parts.length; i++) {
		const line = parts[i] ?? "";
		lines.push({ text: line, line: i, offset });
		offset += line.length;
		const next = text.charAt(offset);
		switch (next) {
			case "\r":
				offset += text.charAt(offset + 1) === "\n" ? 2 : 1;
				break;
			case "\n":
				offset += 1;
				break;
			default:
				break;
		}
	}
	return lines;
}
