import { useToasts, type TLShapeId, Editor } from '@tldraw/tldraw'
import { useCallback, useState } from 'react'
import { executeCode } from '../lib/executeCode'
import { VscRunAll } from "react-icons/vsc";
import { FaRunning } from "react-icons/fa";


export function ExecuteCodeButton({ editor, codeShapeId }: { editor: Editor, codeShapeId: TLShapeId }) {
	const { addToast } = useToasts()
	const [isExecuting, setIsExecuting] = useState(false)

	const handleClick = useCallback(async () => {
		setIsExecuting(true);	
		const res = await executeCode(editor, codeShapeId)
		if (res) {
			setIsExecuting(false);
		}
	try {
		} catch (e) {
			setIsExecuting(false);
			console.error(e)
			addToast({
				icon: 'cross-2',
				title: 'Could not execute code',
				description: (e as Error).message,
			})

		}
	}, [editor, codeShapeId, addToast])

	return (
		<button className="executeCodeButton" onClick={handleClick}>
			{isExecuting ? (<FaRunning />) : (<VscRunAll />)}
			{isExecuting ? ' Running...' : ' Run Code'}
		</button>
	)
}
