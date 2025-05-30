import { Editor, createShapeId, getSvgAsImage, Box, TLShape, TLShapeId, TLTextShape, TLGeoShape, TLGroupShape } from '@tldraw/tldraw'
import { getSelectionAsText } from './getSelectionAsText'
import { getCodeFromOpenAI } from './getCodeFromOpenAI'

import { blobToBase64 } from './blobToBase64'
import { addGridToSvg } from './addGridToSvg'
import { addCoordinateToSvg } from './addCoordinateToSvg'
import { CodeEditorShape } from '../CodeEditorShape/CodeEditorShape'

import { downloadDataURLAsFile } from './downloadDataUrlAsFile'
import * as Diff from 'diff';


export interface Sketch {
	shape: string;
	location: number[];
	annotated_text?: string;
	intended_edits?: string;
	matched_selected_shapes?: TLShapeId[];
}

export async function generateCode(
	interpretation: string,
	editor: Editor,
	apiKey: string,
	codeShapeId: TLShapeId,
	onStart: () => void, onFinish: (original_code: string, code_edit: string) => void, onStoreLog: (log: any) => void,
	groupId?: TLShapeId,
) {
	onStart()
	editor.resetZoom()
	let groupShape: TLGroupShape
	let intended_edit = '' as string
	let selectedShapes = editor.getCurrentPageShapes() as TLShape[]

	if (groupId) {
		// selectedShapes = selectedShapes.filter((shape) => shape.id === groupId || shape.type === 'code-editor-shape')
		groupShape = selectedShapes.find((shape) => shape.id === groupId) as TLGroupShape || editor.getShape(groupId) as TLGroupShape
		intended_edit = groupShape.meta.intended_edit as string
	}
	const box = editor.getSelectionPageBounds() as Box;

	const svgString = await editor.getSvgString(selectedShapes, {
		scale: 1,
		background: true,
		bounds: box,
		padding: 50,
	})

	if (!svgString) {
		return
	}

	const grid = { color: 'red', size: 50, labels: true }
	// addCoordinateToSvg(svg, grid)

	if (!svgString) throw Error(`Could not get the SVG.`)

	const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
	const blob = await getSvgAsImage(editor, svgString.svg, {
		height: window.innerHeight || 1080,
		width: window.innerWidth || 1920,
		type: 'png',
		quality: 1,
		scale: 1,
	})
	const dataUrl = await blobToBase64(blob!)
	// downloadDataURLAsFile(dataUrl, 'tldraw.png')

	onStoreLog({ type: 'generate-param', data: dataUrl })

	const previousCodeEditors = selectedShapes.filter((shape) => {
		return shape.type === 'code-editor-shape'
	}) as CodeEditorShape[]

	let original_code, code_edit;

	try {
		const json = await getCodeFromOpenAI({
			interpretation,
			image: dataUrl,
			apiKey,
			text: getSelectionAsText(editor),
			grid,
			previousCodeEditors,
			intended_edit,
		});

		if (!json) {
			throw Error('Could not contact OpenAI.')
		}

		if (json?.error) {
			throw Error(`${json.error.message?.slice(0, 128)}...`)
		}


		let message = json.choices[0].message.content
		const regex = /```json\n([\s\S]*?)```/;
		const matches = message.match(regex);
		if (matches && matches[1]) {
			message = matches[1];
		}

		if (groupId) {
			try {
				const parsedMessage = JSON.parse(message);
				original_code = parsedMessage.original_code;
				code_edit = parsedMessage.code_edit;
			} catch (error) {
				console.error("Failed to parse JSON, attempting string extraction.", error);
				const originalCodeRegex = /["']?original_code["']?:\s*["']((?:\\.|[^"\\'])*)["']/;
				const codeEditRegex = /["']?code_edit["']?:\s*["']((?:\\.|[^"\\'])*)["']/;
				const originalCodeMatch = message.match(originalCodeRegex);
				const codeEditMatch = message.match(codeEditRegex);
				if (originalCodeMatch && codeEditMatch) {
					original_code = originalCodeMatch[1].replace(/\\n/g, '\n');
					code_edit = codeEditMatch[1].replace(/\\n/g, '\n');
				} else {
					throw new Error('Failed to extract original_code and code_edit from message');
				}
			}

			const allCode = editor.getShape<CodeEditorShape>(codeShapeId)?.props.code;
			if (code_edit.length === 0 && original_code.length === 0) return;
			if (!allCode) {
				throw Error('No code to apply diff to');
			}

			const applyDiff = (allCode: string, originalCode: string, newCodeEdit: string): string => {
				const diff = Diff.diffLines(originalCode, newCodeEdit);
				let currentIndex = 0;
				let newCode = '';
				// console.log(diff);
				const normalizeString = (str: string) => str.replace(/\s+/g, '');

				// Create a normalized version of allCode and a mapping of indices from normalized to original
				const normalizedAllCode = normalizeString(allCode);
				let originalIndexMapping = [] as number[];
				let count = 0;
				for (let i = 0; i < allCode.length; i++) {
					if (!/\s/.test(allCode[i])) { // If not a whitespace character
						originalIndexMapping[count] = i;
						count++;
					}
				}

				diff.forEach(part => {
					const normalizedPartValue = normalizeString(part.value);
					if (part.removed) {
						const indexInNormalized = normalizedAllCode.indexOf(normalizedPartValue, currentIndex);
						if (indexInNormalized !== -1) {
							const originalIndex = originalIndexMapping[indexInNormalized];
							newCode += allCode.substring(currentIndex, originalIndex);
							currentIndex = originalIndex + part.value.length;
						}
					} else if (part.added) {
						newCode += part.value;
					} else {
						const indexInNormalized = normalizedAllCode.indexOf(normalizedPartValue, currentIndex);
						if (indexInNormalized !== -1) {
							const originalIndex = originalIndexMapping[indexInNormalized];
							newCode += allCode.substring(currentIndex, originalIndex + part.value.length);
							currentIndex = originalIndex + part.value.length;
						}
					}
				});

				newCode += allCode.substring(currentIndex);
				return newCode;
			};

			// try direct replace first
			let newCode = allCode.replace(original_code, code_edit);
			if (newCode === allCode) {
				newCode = applyDiff(allCode, original_code, code_edit);
			}

			editor.updateShape<CodeEditorShape>({
				id: codeShapeId,
				type: 'code-editor-shape',
				isLocked: false,
				props: {
					prevCode: allCode,
					code: newCode,
				},
			});
		} else {
			code_edit = message.match(/```(python|javascript)([\s\S]*?)```/)?.[2] || message
			onStoreLog({ type: 'generate-code', data: code_edit })
			const prevCode = editor.getShape<CodeEditorShape>(codeShapeId)?.props.code || ''

			editor.updateShape<CodeEditorShape>({
				id: codeShapeId,
				type: 'code-editor-shape',
				isLocked: false,
				props: {
					prevCode: prevCode,
					code: code_edit,
				},
			})

			editor.updateShape<CodeEditorShape>({
				id: codeShapeId,
				type: 'code-editor-shape',
				isLocked: true
			})
		}

	} catch (e) {
		console.error(e)
		onStoreLog({ type: 'compiled-error', data: (e as Error).message })
		throw e
	} finally {
		onFinish(original_code, code_edit)
	}
}
