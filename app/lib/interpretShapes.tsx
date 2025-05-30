import { Editor, createShapeId, getSvgAsImage, Box, TLShape, TLShapeId, TLTextShape, TLGeoShape, TLGroupShape } from '@tldraw/tldraw'
import { getSelectionAsText } from './getSelectionAsText'
// import { getHtmlFromOpenAI } from './getHtmlFromOpenAI'
import { getCodeFromOpenAI } from './getCodeFromOpenAI'
import { getInterpretationFromAI } from './getInterpretationFromAI'

import { blobToBase64 } from './blobToBase64'
import { addGridToSvg } from './addGridToSvg'
import { addCoordinateToSvg } from './addCoordinateToSvg'
import { PreviewShape } from '../PreviewShape/PreviewShape'
import { CodeEditorShape } from '../CodeEditorShape/CodeEditorShape';

import { downloadDataURLAsFile } from './downloadDataUrlAsFile'
// import groupShapes from './objectDetection';

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

export async function interpretShapes(editor: Editor, apiKey: string, codeShapeId: TLShapeId, handleStoreLog: (log: any) => void): Promise<InterpretationResult> {
	editor.resetZoom()

	let selectedShapes = editor.getCurrentPageShapes() as TLShape[]
	// const codeEditorShape = selectedShapes.find((shape) => shape.type === 'code-editor-shape') as CodeEditorShape
	const codeEditorShape = editor.getCurrentPageShapes().find((shape) => shape.id === codeShapeId) as CodeEditorShape

	console.log('INTERPRET SHAPES\n', selectedShapes, codeEditorShape)

	// let tempSelectedShapes = selectedShapes.filter((shape) => shape.type !== 'code-editor-shape') as TLShape[]
	// const groupContainedShapes = tempSelectedShapes
	// 	.filter((shape) => shape.type === 'group')
	// 	.flatMap((groupShape) => groupShape.meta.contained_shapes) as string[]
	// tempSelectedShapes = tempSelectedShapes.filter((shape) => !groupContainedShapes.includes(shape.id))
	// tempSelectedShapes = tempSelectedShapes.filter((shape) => shape.type !== 'group')
	// if (tempSelectedShapes.filter((shape) => shape.type === 'draw').length === 0) {
	// 	return
	// }

	// selectedShapes = selectedShapes.filter((shape) => shape.type !== 'code-editor-shape')


	const box = editor.getSelectionPageBounds() as Box;

	const svgString = await editor.getSvgString(selectedShapes, {
		scale: 1,
		background: true,
		bounds: box,
		padding: 50,
	})

	// const svgElement = await editor.getSvgElement(selectedShapes, {
	// 	scale: 1,
	// 	background: true,
	// 	bounds: box,
	// 	padding: 50,
	// });

	if (!svgString) {
		throw Error(`Could not get the SVG.`)
	}

	const grid = { color: '#fc0000', size: 50, labels: true }
	// addCoordinateToSvg(svgElement?.svg as SVGSVGElement, grid)


	// const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
	const blob = await getSvgAsImage(editor, svgString.svg, {
		height: window.innerHeight || 1080,
		width: window.innerWidth || 1920,
		type: 'png',
		quality: 1,
		scale: 1,
	})
	const dataUrl = await blobToBase64(blob!)
	// downloadDataURLAsFile(dataUrl, 'tldraw.png')

	// onStoreLog({ type: 'generate-param', data: dataUrl })
	// const fakeRes = {
	// 	interpretations: [
	// 		{
	// 			source: {
	// 				startLine: 1,
	// 				endLine: 3,
	// 			},
	// 			action: "Rename function",
	// 			target: {
	// 				startLine: 8,
	// 				endLine: 10,
	// 			}
	// 		}
	// 	]
	// } as InterpretationResult

	// editor.updateShape<CodeEditorShape>({
	// 	id: codeShapeId,
	// 	type: 'code-editor-shape',
	// 	isLocked: false,
	// 	props: {
	// 		...codeEditorShape.props,
	// 		interpretations: fakeRes.interpretations || [],
	// 	},
	// });

	// return fakeRes;

	try {
		const json = await getInterpretationFromAI({
			image: dataUrl,
			apiKey,
			text: getSelectionAsText(editor),
			grid,
			codeEditorShape,
		});

		handleStoreLog({ type: 'start-interpretation', data: dataUrl })

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
		console.log('message\n', message, '\n\n', parsedContent)
		// let sketches = parsedMessage;
		// // location to all positive values
		// sketches = sketches?.map((sketch: Sketch) => {
		// 	const location = sketch.location
		// 	return {
		// 		...sketch,
		// 		location: [Math.abs(location[0]), Math.abs(location[1]), Math.abs(location[2]), Math.abs(location[3])]
		// 	}
		// })

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


		// tempSelectedShapes = tempSelectedShapes.concat(...selectedShapes.filter((shape) => shape.type === 'group'))
		// console.log('tempSelectedShapes\n', tempSelectedShapes)
		// const groupedShapes = groupShapes(
		// 	sketches,
		// 	[...selectedShapes.filter((shape) => shape.type !== 'code-editor-shape') as TLShape[]],
		// 	editor
		// )
		// console.log('shapeGroups\n', groupedShapes)
		// // remove all metas from the shapes
		// selectedShapes.forEach((shape) => {
		// 	editor.updateShape({
		// 		...shape,
		// 		meta: {}
		// 	})
		// })

		// groupedShapes.forEach((sketch) => {
		// 	const groupID = createShapeId();
		// 	const { shape, annotated_text, location, intended_edit, matched_selected_shapes } = sketch;

		// 	// // BOUNDING BOX
		// 	// editor.createShape<TLGeoShape>({
		// 	// 	id: createShapeId(),
		// 	// 	type: 'geo',
		// 	// 	isLocked: false,
		// 	// 	x: location[0],
		// 	// 	y: location[1],
		// 	// 	props: {
		// 	// 		geo: 'rectangle',
		// 	// 		fill: 'none',
		// 	// 		size: 's',
		// 	// 		color: 'grey',
		// 	// 		w: location[2] - location[0] <= 0 ? 10 : location[2] - location[0],
		// 	// 		h: location[3] - location[1] <= 0 ? 10 : location[3] - location[1],
		// 	// 	}
		// 	// });

		// 	// group all matched shapes
		// 	if (matched_selected_shapes && groupID) {
		// 		const isNavigating = editor.getCurrentToolId() === 'select' || editor.getCurrentToolId() === 'hand'
		// 		if (!isNavigating) {
		// 			editor.setCurrentTool('select')
		// 		}

		// 		// regroup the groupped shapes
		// 		// get the first element ofthe matched_selected_shapes and return in list
		// 		let new_group_shapes = matched_selected_shapes.splice(0, 1) as TLShapeId[]
		// 		matched_selected_shapes.forEach((shapeId, index) => {
		// 			const shape = editor.getShape(shapeId)
		// 			if (shape && shape.type === 'group') {
		// 				const group = shape as TLGroupShape
		// 				editor.ungroupShapes([group.id])
		// 				// new_group_shapes.splice(index, 1)
		// 			}
		// 		})
		// 		// console.log('new_group_shapes\n', new_group_shapes)

		// 		if (new_group_shapes.length > 0) {
		// 			// editor.groupShapes(new_group_shapes, groupID)
		// 			// editor.updateShape<TLGroupShape>({
		// 			// 	id: groupID,
		// 			// 	type: 'group',
		// 			// 	isLocked: false,
		// 			// 	meta: {
		// 			// 		shape: shape,
		// 			// 		annotated_text: annotated_text,
		// 			// 		location: location,
		// 			// 		intended_edit: intended_edit || '',
		// 			// 		contained_shapes: matched_selected_shapes,
		// 			// 	},
		// 			// });
		// 			const closestShape = editor.getShape(new_group_shapes[0])
		// 			if (closestShape) {
		// 				editor.updateShape({
		// 					...closestShape,
		// 					meta: {
		// 						shape: shape,
		// 						annotated_text: annotated_text,
		// 						location: location,
		// 						intended_edit: intended_edit || '',
		// 						contained_shapes: matched_selected_shapes,
		// 					}
		// 				})

		// 				editor.setSelectedShapes([closestShape.id])
		// 				handleStoreLog({ type: 'end-interpretaion', data: intended_edit || '' })
		// 			}
		// 		}

		// 		if (!isNavigating) editor.setCurrentTool('draw')
		// 	}
		// });


	} catch (e) {
		console.error(e)
		// onStoreLog({ type: 'compiled-error', data: (e as Error).message })
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