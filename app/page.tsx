'use client'

import dynamic from 'next/dynamic'
import '@tldraw/tldraw/tldraw.css'
import { CodeEditorShapeUtil } from './components/Shapes/CodeEditorShape'

import { useState, useEffect, useRef, useCallback, use } from 'react'
import {
	stopEventPropagation,
	useEditor, Editor, TLShape, TLShapeId, createShapeId, track, TLEventInfo, TLUiOverrides, TLPointerEventInfo,
	TLDrawShape, useValue, TLClickEventInfo, Vec, intersectLineSegmentPolygon,
	TLComponents
} from '@tldraw/tldraw'
import { CodeEditorShape } from './components/Shapes/CodeEditorShape'
// import { userStudyTasks, type Task } from './lib/tasks'
import { interpretShapes, InterpretationResult } from './lib/interpretShapes'
import { ExecuteCodeButton } from './components/ExecuteCodeButton'
import { GenerateCodeButton } from './components/GenerateCodeButton'
import DollarRecognizer, { Point } from './services/strokeRecognizer'
import ActionRecognition from './components/ActionRecognition'

const Tldraw = dynamic(async () => (await import('@tldraw/tldraw')).Tldraw, {
	ssr: false,
})
const recognizer = new DollarRecognizer();

function BubbleMenu() {
	const editor = useEditor()

	const handleDuplicate = () => {
		const selectedShapes = editor.getSelectedShapes()
		const selectionRotation = editor.getSelectionRotation() ?? 0
		const rotatedPageBounds = editor.getSelectionRotatedPageBounds()!
		const selectionPageBounds = editor.getSelectionPageBounds()!
		if (!(rotatedPageBounds && selectionPageBounds)) return

		const PADDING = 32

		// Find an intersection with the page bounds
		const center = Vec.Rot(rotatedPageBounds.center, selectionRotation)
		const int = intersectLineSegmentPolygon(
			center,
			Vec.Add(center, new Vec(100000, 0).rot(selectionRotation + 90)),
			rotatedPageBounds
				.clone()
				.expandBy(PADDING)
				.corners.map((c) => c.rot(selectionRotation))
		)
		if (!int?.[0]) return

		const delta = Vec.Sub(int[0], center)
		const dist = delta.len()
		const dir = delta.norm()

		// Get the offset for the duplicated shapes
		const offset = dir.mul(dist * 2)


		editor.duplicateShapes(selectedShapes, offset)
	}

	const handleDelete = () => {
		const selectedShapes = editor.getSelectedShapes()
		editor.deleteShapes(selectedShapes)
	}

	return (
		<div className="flex">
			<button
				onClick={handleDuplicate}
				className="px-4 py-2 bg-blue-500 text-white rounded-l-md focus:outline-none hover:bg-blue-600"
			>
				Duplicate
			</button>
			<button
				onClick={handleDelete}
				className="px-4 py-2 bg-red-500 text-white rounded-r-md focus:outline-none hover:bg-red-600"
			>
				Delete
			</button>
		</div>
	)
}



const components: TLComponents = {
	ContextMenu: null,
	ActionsMenu: null,
	HelpMenu: null,
	ZoomMenu: null,
	MainMenu: null,
	Minimap: null,
	StylePanel: null,
	PageMenu: null,
	NavigationPanel: null,
	Toolbar: null,
	KeyboardShortcutsDialog: null,
	QuickActions: null,
	HelperButtons: null,
	DebugPanel: null,
	DebugMenu: null,
	SharePanel: null,
	MenuPanel: null,
	TopPanel: null,
	CursorChatBubble: null,
	InFrontOfTheCanvas: () => {
		const editor = useEditor()

		const info = useValue(
			'selection bounds',
			() => {
				const screenBounds = editor.getViewportScreenBounds()
				const rotation = editor.getSelectionRotation()
				const rotatedScreenBounds = editor.getSelectionRotatedScreenBounds()
				if (!rotatedScreenBounds) return
				return {
					x: rotatedScreenBounds.x - screenBounds.x,
					y: rotatedScreenBounds.y - screenBounds.y,
					width: rotatedScreenBounds.width,
					height: rotatedScreenBounds.height,
					rotation: rotation,
				}
			},
			[editor]
		)

		if (!info) return null

		return (
			<div
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					transformOrigin: 'top left',
					transform: `translate(${info.x + info.width - 120}px, ${info.y - 30}px)`,
					pointerEvents: 'all',
				}}
				onPointerDown={stopEventPropagation}
			>
				<BubbleMenu />
			</div>
		)
	},
}

const shapeUtils = [CodeEditorShapeUtil]
function InsideOfContext({
	newShapeId,
	onManualCodeChange,
	onMultiTouchStart,
}: { newShapeId: TLShapeId, onManualCodeChange: (code: string, editor: Editor) => void, onMultiTouchStart: (length: number) => void }) {
	const editor = useEditor()

	useEffect(() => {
		editor.zoomToFit()
		editor.zoomIn()
		editor.resetZoom()
		editor.setCamera({
			x: 0,
			y: 0,
			z: 1,
		})
		const initialCameraPosition = editor.getCamera()

		const handlePanning = (event: TouchEvent) => {
			event.stopPropagation();
			event.preventDefault();
			onMultiTouchStart(event.touches.length)
			if (event.target && (event.target as HTMLElement).className === 'cm-line') {
				event.stopPropagation();
				event.preventDefault();
				return
			}

			if (event.target && (event.target as HTMLButtonElement).name === 'accept') {
				const currentCode = (editor.getShape(newShapeId) as CodeEditorShape).props

				editor.updateShape<CodeEditorShape>({
					id: newShapeId,
					type: 'code-editor-shape',
					isLocked: true,
					props: {
						prevCode: currentCode.code,
						code: currentCode.code + ' ',
					},
				})

				onManualCodeChange(currentCode.code, editor)

			} else if (event.target && (event.target as HTMLButtonElement).name === 'reject') {
				const currentCode = (editor.getShape(newShapeId) as CodeEditorShape).props

				editor.updateShape<CodeEditorShape>({
					id: newShapeId,
					type: 'code-editor-shape',
					isLocked: true,
					props: {
						prevCode: currentCode.prevCode,
						code: currentCode.prevCode,
					},
				})

				onManualCodeChange(currentCode.prevCode, editor)
			}

			const currentCameraPosition = editor.getCamera();
			const newY = currentCameraPosition.y;

			editor.setCamera({
				x: initialCameraPosition.x,
				y: newY,
				z: 1,
			})

		};
		const handleResize = () => {
			editor.updateShape<CodeEditorShape>({
				id: newShapeId,
				type: 'code-editor-shape',
				props: {
					w: window.innerWidth,
					h: window.innerHeight,
				},
			})
		}

		const handleTouchEnd = async (event: TouchEvent) => {
			if (event.touches.length > 1) {
				if (event.target && (event.target as HTMLElement).className === 'cm-line') {
					return
				}
				event.preventDefault();
				return
			}

			const currentCameraPosition = editor.getCamera();
			const newY = currentCameraPosition.y;

			editor.setCamera({
				x: initialCameraPosition.x,
				y: newY,
				z: 1,
			})
		}


		editor.createShape<CodeEditorShape>({
			id: newShapeId,
			type: 'code-editor-shape',
			isLocked: true,
			x: 0,
			y: 0,
			props: {
				prevCode: '',
				code: '',
				w: (window.innerWidth) * 1.5,
				h: (window.innerHeight),
			},
		})

		// when user panning
		window.addEventListener('touchstart', handlePanning)
		window.addEventListener('touchmove', handlePanning)
		window.addEventListener('touchend', handleTouchEnd)

		window.addEventListener('resize', handleResize)
		return () => {
			const shapes = editor.getCurrentPageShapes() as TLShape[]
			shapes.forEach((shape) => {
				editor.updateShape({
					...shape,
					isLocked: false,
				})
			})
			editor.deleteShapes([...shapes.map((shape) => shape.id)])
			window.removeEventListener('resize', handleResize)
			window.removeEventListener('touchstart', handlePanning)
			window.removeEventListener('touchmove', handlePanning)
			window.removeEventListener('touchend', handleTouchEnd)
		}
	}, [])

	return null
}

export default function App() {
	const newShapeId = useRef<TLShapeId>(createShapeId());
	const [currentCodeShapeId, setCurrentCodeShapeId] = useState<TLShapeId | null>(null);

	const [events, setEvents] = useState<any[]>([])
	const [isInterpreting, setIsInterpreting] = useState<boolean>(false);
	const recognitionDebounceTimer = useRef<NodeJS.Timeout | null>(null);
	const interpretationDebounceTimer = useRef<NodeJS.Timeout | null>(null);
	const lastEventType = useRef<string | null>(null);

	const [recogHistory, setRecogHistory] = useState<Map<string, any>>(new Map());

	const editorRef = useRef<Editor | null>(null);

	const lastMarkID = useRef<number>(0);
	const multiTouchLength = useRef<number>(1);

	const [interpretationResult, setInterpretationResult] = useState<InterpretationResult | null>(null);


	const handleEvent = useCallback(async (data: TLEventInfo, editor: Editor) => {
		setEvents((events) => {
			const newEvents = events.slice(0, 100)
			if (
				newEvents[newEvents.length - 1] &&
				newEvents[newEvents.length - 1].type === 'pointer' &&
				data.type === 'pointer' &&
				data.target === 'canvas'
			) {
				newEvents[newEvents.length - 1] = data
			} else {
				newEvents.unshift(data)
			}
			return newEvents
		})
		if (editor.getInstanceState().isPenMode) {
			editor.updateInstanceState({ isPenMode: false })
		}

		// Handle scrolling
		if (data.type === 'wheel') {
			if (Math.abs(data.delta.x) !== 0) {
				editor.setCamera({
					x: 0,
					y: editor.getCamera().y,
					z: editor.getCamera().z,
				});
			}
		}

		let toolJustSwitched = false;
		// handle pointer move without pen or pen
		if (data.type === 'pointer' && data.name === 'pointer_down' && data.isPen) {
			if (editor.getCurrentToolId() !== 'draw') {
				editor.setCurrentTool('draw');
				toolJustSwitched = true;
			}
		} 
		else if (data.type === 'pointer' && data.name === 'pointer_down' && !data.isPen) {
			const tool = editor.getCurrentToolId();
			if (tool !== 'select') {
				editor.setCurrentTool('select');
				toolJustSwitched = true;
			}
			if (tool === 'draw') {
				editor.undo();
			}
		} 

		if (toolJustSwitched) {
			setTimeout(() => {
				editor.dispatch({
					...data
				});
				toolJustSwitched = false;
			}, 0);
		}

		if (data.type === 'pointer') {
			const isPen = (data as TLPointerEventInfo).isPen;
			if (data.name === 'pointer_down') {
				lastEventType.current = 'pointer_down';
				if (!isPen) {
					editor.setEditingShape(null);
				}
			} else if (data.name === 'pointer_move' && isPen) {
				lastEventType.current = 'pointer_move';
			} else if (data.name === 'pointer_up' && isPen) {
				if (lastEventType.current === 'pointer_move') {
					if (recognitionDebounceTimer.current) clearTimeout(recognitionDebounceTimer.current);
					if (interpretationDebounceTimer.current) clearTimeout(interpretationDebounceTimer.current);

					recognitionDebounceTimer.current = setTimeout(async () => {
						const allShapes = editor.getCurrentPageShapes()
						const lastShape = allShapes[allShapes.length - 1]
						if (!lastShape || lastShape.type !== 'draw' || !lastShape.props || !(lastShape as TLDrawShape).props.segments.length) return;

						const result = recognizer.Recognize((lastShape as TLDrawShape).props.segments[0].points.map((p) => new Point(p.x, p.y)))

						if (result.Name === 'x' && result.Score > 0.85) {
							// reject changes
							const currentCode = (editor.getShape(newShapeId.current) as CodeEditorShape).props
							if (currentCode.code !== currentCode.prevCode) {

								lastMarkID.current += 1
								editor.mark(`change-${lastMarkID.current}`)

								editor.updateShape<CodeEditorShape>({
									id: newShapeId.current,
									type: 'code-editor-shape',
									isLocked: false,
									props: {
										prevCode: currentCode.prevCode,
										code: currentCode.prevCode,
									},
								})

								editor.updateShape<CodeEditorShape>({
									id: newShapeId.current,
									type: 'code-editor-shape',
									isLocked: true
								})


								handleManualCodeChange(currentCode.prevCode, editor)
								editor.deleteShapes([lastShape.id])
							}
						} else if (result.Name === 'check' && result.Score > 0.85) {
							// accept changes
							const currentCode = (editor.getShape(newShapeId.current) as CodeEditorShape).props
							if (currentCode.code !== currentCode.prevCode) {
								lastMarkID.current = lastMarkID.current + 1
								editor.mark(`change-${lastMarkID.current}`)

								editor.updateShape<CodeEditorShape>({
									id: newShapeId.current,
									type: 'code-editor-shape',
									isLocked: false,
									props: {
										prevCode: currentCode.code,
										code: currentCode.code,
									},
								})

								editor.updateShape<CodeEditorShape>({
									id: newShapeId.current,
									type: 'code-editor-shape',
									isLocked: false,
									props: {
										prevCode: currentCode.code,
										code: currentCode.code + ' ',
									},
								})

								editor.updateShape<CodeEditorShape>({
									id: newShapeId.current,
									type: 'code-editor-shape',
									isLocked: true
								})

								handleManualCodeChange(currentCode.code, editor)

								const allShapes = editor.getCurrentPageShapes()
								const drawShapes = allShapes.filter((shape) => shape.type === 'draw')
								editor.deleteShapes(drawShapes.map((shape) => shape.id))
							}
						} else {
							// If not recognized as check or x, set up interpretation timer
							interpretationDebounceTimer.current = setTimeout(async () => {
								const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
								if (!apiKey) throw Error('Make sure the input includes your API Key!');
								setIsInterpreting(true);
								try {
									const result = await interpretShapes(editor, apiKey, newShapeId.current);
									if (result) {
										setInterpretationResult(result);
										// TODO: add recognition and possible changes
										editor.updateShape<CodeEditorShape>({
											id: newShapeId.current,
											type: 'code-editor-shape',
											props: {
												...editor.getShape<CodeEditorShape>(newShapeId.current)?.props,
												interpretations: result,
											},
										});
									}
								} catch (error) {
									console.error('Interpretation failed:', error);
								} finally {
									setIsInterpreting(false);
								}
							}, 1200); // 1200ms debounce for interpretation
						}
					}, 100); // 100ms debounce for recognition
				}
				lastEventType.current = null;
			}
		}
	}, []);


	const handleMultiTouch = (length: number) => {
		multiTouchLength.current = length;
	}

	const handleManualCodeChange = async (code: string, editor: Editor) => {
		const allShapes = editor.getCurrentPageShapes();
		const shapesWithRecognizedShape = allShapes.filter((shape) =>
			shape.meta.shape && (shape.meta.shape as string).length > 0 &&
			shape.meta.contained_shapes &&
			(shape.meta.contained_shapes as string[]).length > 0);

		const currentRecogHistory = recogHistory || new Map<string, any>();
		shapesWithRecognizedShape.forEach((shape) => {
			if (!currentRecogHistory.has(shape.id)) {
				currentRecogHistory.set(shape.id, shape.meta);
			}
			else {
				const existingMeta = currentRecogHistory.get(shape.id);
				currentRecogHistory.set(shape.id, { ...existingMeta, ...shape.meta });
			}
		});

		setRecogHistory(new Map(currentRecogHistory));
	}

	useEffect(() => {
		if (newShapeId.current) setCurrentCodeShapeId(newShapeId.current);
	}, [newShapeId.current]);

	return (
		<div className='app-container'>
			<div className="editor"
				onPointerDown={stopEventPropagation}
				onPointerMove={stopEventPropagation}
			>
				<Tldraw
					persistenceKey="make-real"
					shapeUtils={shapeUtils}
					components={components}
					overrides={{
						actions: (_editor, actions, _helpers) => {
							const newActions = {
								...actions,
							}
							return newActions
						},
					}}
					onMount={(editor: Editor) => {
						editorRef.current = editor;
						editor.on('event', (event) => handleEvent(event, editor));
						editor.getCurrentTool().onDoubleClick = (info: TLClickEventInfo) => {
							editor.cancelDoubleClick();
							if (multiTouchLength.current === 2) {
								editor.undo();
							} else if (multiTouchLength.current === 3) {
								editor.redo();
							}
							return;
						}

						editor.getInitialMetaForShape = (_shape) => {
							return {
								updatedBy: editor.user.getId(),
								updatedAt: Date.now(),
							}
						}
						editor.sideEffects.registerBeforeChangeHandler('shape', (_prev, next, source) => {
							if (source !== 'user') return next

							return {
								...next,
								meta: {
									...next.meta,
									updatedBy: editor.user.getId(),
									updatedAt: Date.now(),
								},
							}
						})

						return () => {
							editor.off('event', (event) => handleEvent(event, editor));
						}
					}}
				>
					<InsideOfContext {...{ newShapeId: newShapeId.current, onManualCodeChange: handleManualCodeChange, onMultiTouchStart: handleMultiTouch }} />
					<div className="editor-actions">
						<div className="interpretation-result">
							{isInterpreting && (<div className="loader"></div>)}
							{interpretationResult && (
								<ActionRecognition text={interpretationResult!.action} />
							)}
						</div>
						<GenerateCodeButton interpretation={interpretationResult ? interpretationResult.action : ''} editor={editorRef.current as Editor} codeShapeId={newShapeId.current} />
						<ExecuteCodeButton editor={editorRef.current as Editor} codeShapeId={currentCodeShapeId!} />
					</div>
				</Tldraw>
			</div>
		</div>
	)
}