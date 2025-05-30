import { useEditor, useToasts } from '@tldraw/tldraw'
import { useCallback, useState, useEffect } from 'react'
import { generateCode } from '../lib/generateCode'
// import { CodeEditorShape } from '../CodeEditorShape/CodeEditorShape'
import { TLShapeId, Editor } from '@tldraw/tldraw'
import { VscGitPullRequest } from "react-icons/vsc";
import { GoGitPullRequestDraft, GoCommit, GoRepoPush } from "react-icons/go";


export function GenerateCodeButton({ interpretation, editor, codeShapeId, onStoreLog }: { interpretation: string, editor: Editor, codeShapeId: TLShapeId, onStoreLog: (log: any) => void }) {
	// const editor = useEditor()
	const { addToast } = useToasts()
	const [isGenerating, setIsGenerating] = useState<boolean>(false);
	const [currentIcon, setCurrentIcon] = useState<JSX.Element>(<VscGitPullRequest />);

	const icons = [
	  <GoGitPullRequestDraft key="pull-request" />,
	  <GoCommit key="commit" />,
	  <GoRepoPush key="repo-push" />
	];

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isGenerating) {
            interval = setInterval(() => {
                const randomIndex = Math.floor(Math.random() * icons.length);
                setCurrentIcon(icons[randomIndex]);
            }, Math.random() * 3000 + 1000); // Random interval between 1-3 seconds
        } else {
            setCurrentIcon(<VscGitPullRequest />);
        }
        return () => clearInterval(interval);
    }, [isGenerating]);

	const handleClick = useCallback(async () => {
		try {
			// First try to get API key from localStorage (user input), then fall back to environment variable
			const userApiKey = localStorage.getItem('makeitreal_key')
			const apiKey = userApiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY
			if (!apiKey) throw Error('Make sure the input includes your API Key!')

			const onStart = () => setIsGenerating(true);
			const onFinish = (original_code: string, code_edit: string) => {
				// console.log('Original Code:', original_code)
				// console.log('Code Edit:', code_edit)
				setIsGenerating(false)
			}
			
			await generateCode(interpretation, editor, apiKey, codeShapeId, onStart, onFinish, onStoreLog)
		} catch (e) {
			console.error(e)
			addToast({
				icon: 'cross-2',
				title: 'Something went wrong',
				description: (e as Error).message.slice(0, 100),
			})
		} finally {
			setIsGenerating(false)
		}
	}, [editor, codeShapeId, addToast])

	return (
		<button className="makeRealButton" onClick={handleClick}>
			{currentIcon}
			<span style={{ marginLeft: '0.2rem' }} />
			{isGenerating ? 'Commiting Changes...' : 'Commit'}
		</button>
	)
}
