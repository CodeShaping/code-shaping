import { useEditor, useToasts, type TLShapeId, Editor } from '@tldraw/tldraw'
import { useCallback, useState, useEffect } from 'react'
import { executeCode } from '../lib/executeCode'
import { VscRunAll } from "react-icons/vsc";
import { FaRunning } from "react-icons/fa";


// getNewShapeId
export function ExecuteCodeButton({ editor, codeShapeId, onStoreLog }: { editor: Editor, codeShapeId: TLShapeId, onStoreLog: (log: any) => void }) {
	// const editor = useEditor()
	const { addToast } = useToasts()
	const [isExecuting, setIsExecuting] = useState(false)

	const handleClick = useCallback(async () => {
		setIsExecuting(true);
			console.log('Code SHape ID', codeShapeId)
			let res = await executeCode(editor, codeShapeId)
			// remove html tags
			// res = res.replace(/<[^>]*>?/gm, '')
			
			if (res) {
				setIsExecuting(false);
				// addToast({
				// 	icon: 'check',
				// 	title: 'Code executed successfully',
				// 	description: res,
				// })
				onStoreLog({ type: 'compiled-result', data: res });
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

			onStoreLog({ type: 'compiled-error', data: (e as Error).message });
		}
	}, [editor, addToast])

	return (
		<button className="executeCodeButton" onClick={handleClick}>
			{isExecuting ? (<FaRunning />) : (<VscRunAll />)}
			{isExecuting ? ' Running...' : ' Run Code'}
		</button>
	)
}
