'use client'

import dynamic from 'next/dynamic'
import '@tldraw/tldraw/tldraw.css'
import { ShareButtonGroup } from './components/ShareButtonGroup'
import { RiskyButCoolAPIKeyInput } from './components/RiskyButCoolAPIKeyInput'

import { PreviewShapeUtil } from './PreviewShape/PreviewShape'
import { CodeEditorShapeUtil } from './CodeEditorShape/CodeEditorShape'
// import { CustomGroupShapeUtil } from './GroupShape/GroupShape'

import { useState, useEffect, useRef, useCallback, use } from 'react'
import {
	TLUiComponents,
	stopEventPropagation,
	useEditor, Editor, TLShape, TLShapeId, createShapeId, track, TLEventInfo, TLUiOverrides, TLPointerEventInfo,
	TLDrawShape, useValue, TLClickEventInfo, Vec, intersectLineSegmentPolygon,
	TLComponents
} from '@tldraw/tldraw'
// import { useSyncDemo } from '@tldraw/sync'
// import { useEditor } from 'tldraw'
import { CodeEditorShape } from './CodeEditorShape/CodeEditorShape'
import { userStudyTasks, type Task } from './lib/tasks'
// import { addCollection } from './lib/firebase'
import { interpretShapes, InterpretationResult } from './lib/interpretShapes'
import { generateCode } from './lib/generateCode'

// ICONS
import { FaCodePullRequest } from "react-icons/fa6";
import { FiDelete, FiEdit, FiArrowUp, FiArrowDown, FiArrowLeft, FiArrowRight, FiCircle, FiTriangle, FiMinus, FiX, FiImage, FiBarChart2, FiCode, FiCheck } from 'react-icons/fi';
import { VscInsert } from "react-icons/vsc";
import { IoText } from "react-icons/io5";
import { PiRectangleDashed, PiBracketsCurlyBold, PiWaveSineBold } from "react-icons/pi";
import { FaUnderline } from "react-icons/fa";
import { BiHighlight } from "react-icons/bi";


// import { LockCodeEditorButton } from "./components/LockCodeEditorButton";
import { ExecuteCodeButton } from './components/ExecuteCodeButton'
import { GenerateCodeButton } from './components/GenerateCodeButton'
import { type ControlBrusheType, availableBrushes } from './components/ControlBrushes';

import DollarRecognizer, { Point } from './lib/strokeRecognizer'
const recognizer = new DollarRecognizer();

import ActionRecognition from './components/ActionRecognition'
import FileManager from './components/FileManager'


// touch event
// import Hammer from 'hammerjs';
// const importHammerJs = () => import("hammerjs");

const Tldraw = dynamic(async () => (await import('@tldraw/tldraw')).Tldraw, {
	ssr: false,
})

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
	currentTask,
	onManualCodeChange,
	onMultiTouchStart,
}: { newShapeId: TLShapeId, currentTask: Task | null, onManualCodeChange: (code: string, editor: Editor) => void, onMultiTouchStart: (length: number) => void }) {
	const editor = useEditor()

	useEffect(() => {
		const activePointers = new Map<number, Touch>()
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
			// event.preventDefault();
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
			let newY = currentCameraPosition.y;

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
			let newY = currentCameraPosition.y;

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
				prevCode: currentTask?.starterCode,
				code: currentTask?.starterCode,
				w: (window.innerWidth) * 1.5,
				h: (window.innerHeight) * 2,
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

	useEffect(() => {
		if (currentTask) {
			console.log('currentTask', currentTask)
			editor.updateShape<CodeEditorShape>({
				id: newShapeId,
				type: 'code-editor-shape',
				isLocked: false,
				props: {
					prevCode: currentTask.starterCode,
					code: currentTask.starterCode,
				},
			})
		}
	}, [currentTask, editor, newShapeId])

	return null
}


// export const MetaUiHelper = track(function MetaUiHelper({ onStoreLog, codeShapeId }: { onStoreLog: (log: any) => void, codeShapeId: TLShapeId }) {
// 	const editor = useEditor();

// 	let currentShapes = editor.getCurrentPageShapes() as TLShape[];
// 	// currentShapes = currentShapes.filter((shape) => shape.type === 'group');
// 	currentShapes = currentShapes.filter((shape) => shape.meta.shape && (shape.meta.shape as string).length > 0);

// 	const onlySelectedShape = editor.getOnlySelectedShape() as TLShape | null;
// 	const onlyHoveredShape = editor.getHoveredShape() as TLShape | null;
// 	// if (!onlySelectedShape) {
// 	// 	editor.setSelectedShapes(currentShapes);
// 	// }

// 	const [isEditing, setIsEditing] = useState(false);
// 	const [editText, setEditText] = useState('');
// 	const [isGenerating, setIsGenerating] = useState(false);
// 	const [isExpanded, setIsExpanded] = useState(false);
// 	if (!onlySelectedShape || !onlyHoveredShape) return null;

// 	// const handleUngroupShapes = () => {
// 	// 	// console.log('ungroup shape', onlySelectedShape.id);
// 	// 	// editor.ungroupShapes([onlySelectedShape.id || onlyHoveredShape.id]);
// 	// 	// remove meta
// 	// 	editor.updateShape({ ...onlySelectedShape, meta: {} });
// 	// };

// 	const handleRemoveShapes = () => {
// 		onStoreLog({ type: 'remove-shape', data: onlySelectedShape.meta.shape });
// 		editor.deleteShapes([onlySelectedShape.id || onlyHoveredShape.id]);
// 	};

// 	const handleEditClick = () => {
// 		setIsEditing(true);
// 		setEditText(onlySelectedShape.meta.intended_edit as string || onlyHoveredShape.meta.intended_edit as string || '');
// 	};

// 	const handleEditCancel = () => {
// 		setIsEditing(false);
// 		setEditText(onlySelectedShape.meta.intended_edit as string || onlyHoveredShape.meta.intended_edit as string || '');
// 	};

// 	const handleEditConfirm = () => {
// 		if (onlySelectedShape) {
// 			editor.updateShape({ ...onlySelectedShape, meta: { ...onlySelectedShape.meta, intended_edit: editText } });
// 		}
// 		if (onlyHoveredShape) {
// 			editor.updateShape({ ...onlyHoveredShape, meta: { ...onlyHoveredShape.meta, intended_edit: editText } });
// 		}
// 		onStoreLog({ type: 'edit-interpretation', data: editText });
// 		setIsEditing(false);
// 	};

// 	// const handleRegenerateCode = async (groupId: TLShapeId) => {
// 	// 	const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
// 	// 	if (!apiKey) throw Error('Make sure the input includes your API Key!');
// 	// 	const onStart = () => setIsGenerating(true);
// 	// 	const onFinish = (original_code: string, code_edit: string) => {
// 	// 		setIsGenerating(false);
// 	// 		toggleExpand(groupId);
// 	// 		// update onlySelectedShape with the new meta
// 	// 		editor.updateShape({ ...onlySelectedShape, meta: { ...onlySelectedShape.meta, original_code, code_edit } });
// 	// 		onStoreLog({ type: 'commit-change', data: code_edit });
// 	// 	}
// 	// 	setIsGenerating(true);
// 	// 	await generateCode(editor, apiKey, codeShapeId as TLShapeId, onStart, onFinish, onStoreLog, groupId);
// 	// }

// 	const shapeToIcon = (shape: string) => {
// 		// might be multiple shapes (e.g. 'circle+arrow+text')
// 		const shapes = shape.split('+');
// 		const icons: { [key: string]: JSX.Element } = {
// 			circle: <FiCircle />,
// 			ellipse: <FiCircle />,
// 			curve: <PiWaveSineBold />,
// 			curly_brackets: <PiBracketsCurlyBold />,
// 			curly_line: <BiHighlight />,
// 			arrow: <FiArrowRight />,
// 			arrow_right: <FiArrowRight />,
// 			text: <IoText />,
// 			rectangle: <PiRectangleDashed />,
// 			triangle: <FiTriangle />,
// 			line: <FiMinus />,
// 			underline: <FaUnderline />,
// 			cross: <FiX />,
// 			cross_out: <FiX />,
// 			arrow_up: <FiArrowUp />,
// 			arrow_down: <FiArrowDown />,
// 			arrow_left: <FiArrowLeft />,
// 			insert: <VscInsert />,
// 			image: <FiImage />,
// 			plot: <FiBarChart2 />,
// 			visualization: <FiBarChart2 />,
// 			code: <FiCode />,
// 		};

// 		return shapes.map((s, index) => {
// 			const icon = icons[s];
// 			return (
// 				<span key={index}>
// 					{icon || s}
// 				</span>
// 			);
// 		});
// 	};

// 	const toggleExpand = (shapeId: string) => {
// 		editor.setSelectedShapes([shapeId as TLShapeId]);
// 		if (onlySelectedShape.id === shapeId) {
// 			setIsExpanded(!isExpanded);
// 		}
// 	}

// 	return (
// 		<div>
// 			{currentShapes.map((shape, index) => (
// 				<div
// 					id="meta-ui-helper"
// 					key={index}
// 					style={{
// 						left: shape.x + 10,
// 						top: shape.y,
// 					}}>
// 					{!isExpanded && (<span id="shape" onClick={() => toggleExpand(shape.id)}>
// 						{shapeToIcon(shape.meta.shape as string).map((icon, index) => (
// 							<span key={index}>{icon}</span>
// 						))}
// 					</span>)}
// 					{isExpanded && (shape.id === onlySelectedShape.id || shape.id === onlyHoveredShape.id) && (
// 						<div className="tooltip">
// 							<div className="header">
// 								<span id="shape" onClick={() => toggleExpand(shape.id)}>
// 									{shapeToIcon(shape.meta.shape as string).map((icon, index) => (
// 										<span key={index}>{icon}</span>
// 									))}
// 								</span>
// 								<div>
// 									{/* <button onClick={handleUngroupShapes}><PiRectangleDashed /></button> */}
// 									<button onClick={handleRemoveShapes}><FiDelete /></button>
// 									{/* <button onClick={() => handleRegenerateCode(shape.id)}><FaCodePullRequest /></button> */}
// 								</div>
// 							</div>
// 							<div className="content">
// 								<p>
// 									{shape.meta.annotated_text && <span id="text">Recognized Text: {shape.meta.annotated_text as string}</span>}
// 									{isEditing ? (
// 										<span id="edit">
// 											<input type="text" style={{ width: `${editText.length * 6}px` }} value={editText} onChange={(e) => setEditText(e.target.value)} />
// 											<button onClick={handleEditConfirm}><FiCheck /></button>
// 											<button onClick={handleEditCancel}><FiX /></button>
// 										</span>
// 									) : (
// 										<span id="edit">
// 											{shape.meta.intended_edit as string} <button onClick={handleEditClick}><FiEdit /></button>
// 										</span>
// 									)}
// 								</p>
// 							</div>
// 						</div>
// 					)}
// 				</div>
// 			))}
// 		</div>
// 	);
// })

export type LogType = 'edit' | 'exit-edit' | 'compile' | 'compiled-result' | 'compiled-error'
	| 'generate-param' | 'generate-code' | 'generate-error' | 'switch-task' | 'end-interpretation' | 'brush' |
	'commit-change' | 'remove-shape' | 'edit-interpretation' | 'start-interpretation' | 'accept-changes' | 'reject-changes'
export interface LogEvent {
	type: LogType
	userId: string
	taskId: string
	timestamp: number
	data?: any
	createdAt?: any
}

interface RecognitionHistory {
	updatedBy: string;
	updatedAt: number;
	shape: string;
	annotated_text?: string;
	location?: number[];
	intended_edit?: string;
	contained_shapes: string[];
	original_code?: string;
	code_edit?: string;
}

interface RecognitionHistoriesProps {
	histories: Map<string, RecognitionHistory>;
}

const RecognitionHistories: React.FC<RecognitionHistoriesProps> = ({ histories }) => {
	return (
		<div className="recognition-histories">
			<h2>Recognition Histories</h2>
			<table>
				<thead>
					<tr>
						<th>Shape</th>
						<th>Annotated Text</th>
						<th>Intended Edit</th>
						<th>Updated At</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{Array.from(histories.entries()).map(([id, history]) => (
						<tr key={id}>
							<td>{history.shape}</td>
							<td>{history.annotated_text}</td>
							<td>{history.intended_edit}</td>
							<td>{new Date(history.updatedAt).toLocaleString()}</td>
							<td>
								<button>Edit</button>
								<button>Delete</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};


export default function App() {
	const [currentTask, setCurrentTask] = useState<Task | null>(null);
	const taskId = useRef<string | null>(null);
	const userId = useRef<string | null>(null);
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
	// let clickCount = useRef<number>(0);
	// let clickTimeout = useRef<NodeJS.Timeout | null>(null);
	const multiTouchLength = useRef<number>(1);

	const [interpretationResult, setInterpretationResult] = useState<InterpretationResult | null>(null);

	// double click/triple_click, click, false
	// pointer_move/down/up, pointer, false/true
	// long_press, pointer, false
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
		} else if (data.type === 'pointer' && data.name === 'pointer_down' && !data.isPen) {
			const tool = editor.getCurrentToolId();
			if (tool !== 'select') {
				editor.setCurrentTool('select');
				toolJustSwitched = true;
			}
			if (tool === 'draw') {
				editor.undo();
			}
		} else if (data.type === 'pointer' && data.name === 'long_press' && !data.isPen) {
			console.log('long press', data)

			editor.updateShape<CodeEditorShape>({
				id: newShapeId.current,
				type: 'code-editor-shape',
				isLocked: true,
			})

			editor.setEditingShape(newShapeId.current);
			editor.setSelectedShapes([newShapeId.current]);
			return
		}
		// editor.setCurrentTool('draw');

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
						// console.log('recognized: ', result.Name, result.Score)


						// TODO: use cycle (write, commit, change) to determine?
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
							console.log('recognized Check: ', result.Name, result.Score)
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
								// First try to get API key from localStorage (user input), then fall back to environment variable
								const userApiKey = localStorage.getItem('makeitreal_key')
								const apiKey = userApiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
								if (!apiKey) throw Error('Make sure the input includes your API Key!');
								setIsInterpreting(true);
								try {
									const result = await interpretShapes(editor, apiKey, newShapeId.current, handleStoreLog);
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
							}, 1500); // 1500ms debounce for interpretation
						}
					}, 200); // 100ms debounce for recognition
				}
				lastEventType.current = null;
			}
		}
	}, []);


	// Parse URL for userId once on component mount
	useEffect(() => {
		// const url = new URL(window.location.href);
		// const urlParams = new URLSearchParams(window.location.search);
		// const userIdFromUrl = urlParams.get('userId');
		// if (userIdFromUrl) {
		// 	userId.current = userIdFromUrl;
		// }

		// const taskIdFromUrl = urlParams.get('taskId');

		// if (taskIdFromUrl) {
		// 	const task = userStudyTasks.find(task => task.id === taskIdFromUrl);
		// 	if (task) {
		// 		handleTaskChange(task);
		// 		handleStoreLog({ type: 'task-change', data: taskIdFromUrl });
		// 	}
		// }
		userId.current = 'anonymous';
		taskId.current = '4-2';
		handleTaskChange(userStudyTasks.find(task => task.id === taskId.current) as Task);

		window.oncontextmenu = function (event) {
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
	}, []);


	const handleTaskChange = (task: Task) => {
		taskId.current = task.id;
		setCurrentTask(task);
	};

	const handleMultiTouch = (length: number) => {
		multiTouchLength.current = length;
	}

	const handleManualCodeChange = async (code: string, editor: Editor) => {
		// update recogHistory with the new code
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

	const handleStoreLog = async (log: any) => {
		const logEvent: LogEvent = {
			type: log.type,
			userId: userId.current || 'anonymous',
			taskId: taskId.current || '3-1',
			data: log.data || null,
			timestamp: Date.now(),
		};
		return;

		// await addCollection(`${userId.current}_${taskId.current}`, logEvent);
	};

	const handleSelectBrush = (brush: ControlBrusheType) => {
		editorRef.current?.setCurrentTool('draw', { color: 'red' });
		console.log(editorRef.current?.getCurrentTool())
		// const availableBrushes = [
		// 	{ type: 'reference', description: 'Reference', icon: <IoLinkOutline />, color: 'rgb(66, 99, 235)', dataId: 'style.color.blue' },
		// 	{ type: 'delete', description: 'Delete', icon: <FaDeleteLeft />, color: 'rgb(247, 103, 7)', dataId: 'style.color.orange' },
		// 	{ type: 'add', description: 'Add', icon: <IoAddCircle />, color: 'rgb(77, 171, 247)', dataId: 'style.color.light-blue' },
		// 	{ type: 'replace', description: 'Replace', icon: <VscReplace />, color: 'rgb(255, 192, 120)', dataId: 'style.color.yellow' },
		// ];
		const button = document.querySelector(`button[data-testid="${availableBrushes.find(b => b.type === brush)?.dataId}"]`) as HTMLButtonElement;
		if (button) {
			button.click();
		} else {
			console.log('Button not found');
		}
	}

	// use effect handle shape ID
	useEffect(() => {
		if (newShapeId.current) setCurrentCodeShapeId(newShapeId.current);
	}, [newShapeId.current]);

	const handleNewEditor = (task: Task) => {
		// remove current code editor and create new one
		const editor = editorRef.current;
		if (!editor) return;
		const shapes = editor.getCurrentPageShapes() as TLShape[]
		shapes.forEach((shape) => {
			editor.updateShape({
				...shape,
				isLocked: false,
			})
		})
		editor.deleteShapes([...shapes.map((shape) => shape.id)])
		newShapeId.current = createShapeId();
		setCurrentCodeShapeId(newShapeId.current);

		editor.createShape<CodeEditorShape>({
			id: newShapeId.current,
			type: 'code-editor-shape',
			isLocked: false,
			x: 0,
			y: 0,
			props: {
				prevCode: task.starterCode,
				code: task.starterCode,
				w: (window.innerWidth) * 1.5,
				h: (window.innerHeight) * 2,
			},
		})
		handleTaskChange(task);
	}

	// const getNewShapeId = useCallback(() => newShapeId.current, []);


	return (
		<div className='app-container'>
			<div className='file-manager'>
				<FileManager onTaskChange={handleNewEditor} />
			</div>
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
						// let doubleClickTimeout: NodeJS.Timeout | null = null;

						editor.getCurrentTool().onDoubleClick = (info: TLClickEventInfo) => {
							console.log('Double click', multiTouchLength.current)
							editor.cancelDoubleClick();
							if (multiTouchLength.current === 2) {
								console.log('undo2')
								editor.undo();
							} else if (multiTouchLength.current === 3) {
								console.log('redo3')
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
					<InsideOfContext {...{ newShapeId: newShapeId.current, currentTask, onManualCodeChange: handleManualCodeChange, onMultiTouchStart: handleMultiTouch }} />
					{/* <MetaUiHelper onStoreLog={handleStoreLog} codeShapeId={newShapeId.current} /> */}
					<div className="editor-actions">
						<div className="interpretation-result">
							{isInterpreting && (<div className="loader"></div>)}
							{interpretationResult && (
								<ActionRecognition text={interpretationResult!.action} />
							)}
						</div>
						<GenerateCodeButton interpretation={interpretationResult ? interpretationResult.action : ''} editor={editorRef.current as Editor} codeShapeId={newShapeId.current} onStoreLog={handleStoreLog} />
						<ExecuteCodeButton editor={editorRef.current as Editor} codeShapeId={currentCodeShapeId!} onStoreLog={handleStoreLog} />
					</div>
					<RiskyButCoolAPIKeyInput />
					{/* <LockCodeEditorButton codeShapeId={newShapeId} onStoreLog={handleStoreLog} /> */}
				</Tldraw>
			</div>
		</div>
	)
}