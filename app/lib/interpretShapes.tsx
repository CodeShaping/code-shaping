import { Editor, getSvgAsImage, Box, TLShape, TLShapeId} from '@tldraw/tldraw'
import { getSelectionAsText } from './getSelectionAsText'
import { getInterpretationFromAI } from '../services/getInterpretationFromAI'

import { blobToBase64 } from './blobToBase64'
import { CodeEditorShape } from '../components/Shapes/CodeEditorShape';

export interface Sketch {
	shape: string;
	location: number[];
	annotated_text?: string;
	intended_edit?: string;
	matched_selected_shapes?: TLShapeId[];
}

export interface InterpretationResult {
	source: {
		code: string;
		startLine: number;
		endLine: number;
	};
	action: string;
	target: {
		code: string;
		startLine: number;
		endLine: number;
	};
}

export async function interpretShapes(editor: Editor, apiKey: string, codeShapeId: TLShapeId): Promise<InterpretationResult> {
	editor.resetZoom()

	const selectedShapes = editor.getCurrentPageShapes() as TLShape[]
	const codeEditorShape = selectedShapes.find((shape) => shape.id === codeShapeId) as CodeEditorShape

	const box = editor.getSelectionPageBounds() as Box;

	const svgString = await editor.getSvgString(selectedShapes, {
		scale: 1,
		background: true,
		bounds: box,
		padding: 50,
	})

	if (!svgString) {
		throw Error(`Could not get the SVG.`)
	}

	const grid = { color: '#fc0000', size: 50, labels: true }

	const blob = await getSvgAsImage(editor, svgString.svg, {
		height: window.innerHeight || 1080,
		width: window.innerWidth || 1920,
		type: 'png',
		quality: 1,
	})
	const dataUrl = await blobToBase64(blob!)

	try {
		const json = await getInterpretationFromAI({
			image: dataUrl,
			apiKey,
			text: getSelectionAsText(editor),
			grid,
			codeEditorShape,
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
		const parsedContent = JSON.parse(message);

		editor.updateShape<CodeEditorShape>({
			id: codeShapeId,
			type: 'code-editor-shape',
			isLocked: false,
			props: {
				...codeEditorShape.props,
				interpretations: parsedContent || [],
			},
		});

		return parsedContent

	} catch (e) {
		console.error(e)
		throw e
	} finally {
		editor.updateShape<CodeEditorShape>({
			id: codeShapeId,
			type: 'code-editor-shape',
			isLocked: true,
		})
		editor.setEditingShape(null)
	}
}