import { useEditor, type TLShapeId } from '@tldraw/tldraw'
import type { CodeEditorShape } from '../CodeEditorShape/CodeEditorShape'
import React, { useCallback, useEffect, useState } from 'react';


export function LockCodeEditorButton({ codeShapeId, onStoreLog }: { codeShapeId: TLShapeId, onStoreLog: (log: any) => void }) {
    const editor = useEditor();
    const [isLocked, setIsLocked] = useState(true);
    // useEffect(() => {
    //     const shape = editor.getShape(codeShapeId) as CodeEditorShape;
    //     console.log('shape', shape.isLocked);
    //     if (shape) {
    //         setIsLocked(shape.isLocked);
    //     }
    // }, [editor, codeShapeId]);

    const handleClick = useCallback(() => {
        const tempCodeEditor = editor.getShape(codeShapeId) as CodeEditorShape;
        if (!tempCodeEditor) throw Error('Could not find the code editor shape.');

        const newLockStatus = !tempCodeEditor.isLocked;
        editor.updateShape<CodeEditorShape>({
            id: codeShapeId,
            type: 'code-editor-shape',
            isLocked: newLockStatus
        });

        setIsLocked(newLockStatus); 

        if (!newLockStatus) {
            editor.setSelectedShapes([codeShapeId]);
            editor.setEditingShape(codeShapeId);
            onStoreLog({ type: 'edit' });
        } else {
            editor.setEditingShape(null);
            editor.deselect(tempCodeEditor.id);
            onStoreLog({ type: 'exit-edit' });
        }
    }, [codeShapeId, editor, onStoreLog]);

    return (
        <button className={'lockCodeEditorButton'} onClick={handleClick}>
            {isLocked ? 'Code Edit' : 'Editing...'}
        </button>
    );
}