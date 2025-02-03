/* eslint-disable react-hooks/rules-of-hooks */
import {
    BaseBoxShapeUtil,
    TLBaseShape,
    SvgExportContext,
    useIsEditing,
} from '@tldraw/tldraw'

import { RecordProps, T } from 'tldraw'

import CodeMirror, { EditorView, ChangeSet, StateEffect, type ReactCodeMirrorRef, Decoration, DecorationSet, gutter, GutterMarker } from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { unifiedMergeView, updateOriginalDoc } from '@codemirror/merge';
import { undo } from "@codemirror/commands";
import { RangeSet, StateField } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

export type CodeEditorShape = TLBaseShape<
    'code-editor-shape',
    {
        w: number
        h: number
        code: string
        prevCode: string
        res: string
        interpretations: {
            source: {
                startLine: number
                endLine: number
            }
            action: string
            target: {
                startLine: number
                endLine: number
            }
        }
        taskFiles?: { [key: string]: string }
    }
>


const BubbleMenu = ({ onCopy, onPaste, onDelete, position }: any) => {
    return (
        <div
            style={{
                position: 'absolute',
                top: position.top,
                left: position.left,
                zIndex: 999,
                padding: '5px',
                border: '1px solid #ccc',
                borderRadius: '5px',
                boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)',
            }}
        >
            <button onClick={onCopy}>Copy</button>
            <button onClick={onPaste}>Paste</button>
            <button onClick={onDelete}>Delete</button>
        </div>
    );
};

const highlightEffect = StateEffect.define<{ from: number; to: number }>({
    map: ({ from, to }, mapping) => ({ from: mapping.mapPos(from), to: mapping.mapPos(to) })
});

const clearHighlightEffect = StateEffect.define<void>({});

const highlightField = StateField.define<DecorationSet>({
    create() {
        return Decoration.none;
    },
    update(highlights, transaction) {
        highlights = highlights.map(transaction.changes);
        for (const effect of transaction.effects) {
            if (effect.is(highlightEffect)) {
                highlights = highlights.update({
                    add: [
                        Decoration.mark({
                            class: 'highlighted-code'
                        }).range(effect.value.from, effect.value.to)
                    ]
                });
            } else if (effect.is(clearHighlightEffect)) {
                highlights = Decoration.none;
            }
        }
        return highlights;
    },
    provide: f => EditorView.decorations.from(f)
});

function applyHighlights(view: EditorView, code: string) {
    const tree = syntaxTree(view.state);
    const effects: StateEffect<unknown>[] = [];

    tree.iterate({
        enter(node) {
            const nodeText = view.state.doc.sliceString(node.from, node.to);
            if (nodeText === code) {
                effects.push(highlightEffect.of({ from: node.from, to: node.to }));
            }
        }
    });

    if (effects.length > 0) {
        view.dispatch({ effects });
        setTimeout(() => {
            view.dispatch({
                effects: [clearHighlightEffect.of()]
            });
        }, 2000); // Remove highlights after 2 seconds
    }
}

const sourceMarker = new class extends GutterMarker {
    toDOM() { return document.createTextNode("←") }
}

const targetMarker = new class extends GutterMarker {
    toDOM() { return document.createTextNode("→") }
}
const clearDecorationsEffect = StateEffect.define<void>({});

const interpretationEffect = StateEffect.define<{ from: number, to: number, action: string, isSource: boolean, on: boolean }>({
    map: (val, mapping) => ({ from: mapping.mapPos(val.from), to: mapping.mapPos(val.to), action: val.action, isSource: val.isSource, on: val.on }),
})

// Define the state field to manage the gutter markers
const interpretationState = StateField.define<RangeSet<GutterMarker>>({
    create() { return RangeSet.empty },
    update(set, tr) {
        set = set.map(tr.changes);
        for (const effect of tr.effects) {
            if (effect.is(interpretationEffect)) {
                const marker = effect.value.isSource ? sourceMarker : targetMarker;
                if (effect.value.on) {
                    for (let line = effect.value.from; line <= effect.value.to; line++) {
                        set = set.update({ add: [marker.range(line)] });
                    }
                } else {
                    set = set.update({ filter: from => !(from >= effect.value.from && from <= effect.value.to) });
                }
            } else if (effect.is(verticalRectEffect)) {
                const lineCount = effect.value.to - effect.value.from + 1;
                const marker = new VerticalRectMarker(effect.value.height);
                for (let line = effect.value.from; line <= effect.value.to; line++) {
                    set = set.update({ add: [marker.range(line)] });
                }
            }
        }
        return set;
    }
});

const interpretationGutter = [
    interpretationState,
    gutter({
        class: "cm-interpretation-gutter",
        markers: v => v.state.field(interpretationState),
        initialSpacer: () => sourceMarker
    }),
    EditorView.baseTheme({
        ".cm-interpretation-gutter .cm-gutterElement": {
            color: '#66A3D2 !important',
            fontWeight: 'bolder !important',
            paddingLeft: "5px",
            cursor: "default"
        },
        ".cm-interpretation-gutter .cm-gutterElement:has(::text('←'))": {
            color: "#66A3D2",
            backgroundColor: "rgba(0, 0, 255, 0.1)"
        },
        ".cm-interpretation-gutter .cm-gutterElement:has(::text('→'))": {
            color: "#66A3D2 !important",
            backgroundColor: "rgba(0, 255, 0, 0.1)"
        }
    })
]

class VerticalRectMarker extends GutterMarker {
    constructor(private height: number) {
        super();
    }

    toDOM(view: EditorView) {
        const div = document.createElement("div");
        div.style.height = `${this.height}px`;
        div.style.width = "4px";
        div.style.backgroundColor = "#C9D9E3";
        div.style.position = "relative";
        div.style.left = "50%";
        div.style.transform = "translateX(-50%)";
        return div;
    }
}

// Define the effect to add or remove the marker
const verticalRectEffect = StateEffect.define<{ from: number, to: number, height: number }>({
    map: (val, mapping) => ({
        from: mapping.mapPos(val.from),
        to: mapping.mapPos(val.to),
        height: val.height,
    })
});


function applyInterpretations(view: EditorView, interpretations: any, clearMarkers = true) {
    const effects = [];

    try {
        if (clearMarkers) {
            effects.push(clearDecorationsEffect.of());
            // put every line on: false
            for (let i = 1; i < view.state.doc.lines; i++) {
                effects.push(
                    interpretationEffect.of({
                        from: view.state.doc.line(i).from,
                        to: view.state.doc.line(i).to,
                        action: interpretations.action,
                        isSource: true,
                        on: false
                    }),
                    interpretationEffect.of({
                        from: view.state.doc.line(i).from,
                        to: view.state.doc.line(i).to,
                        action: interpretations.action,
                        isSource: false,
                        on: false
                    })
                );
            }
        }

        if (interpretations.source.startLine && interpretations.source.endLine) {
            effects.push(
                verticalRectEffect.of({
                    from: view.state.doc.line(interpretations.source.startLine).from,
                    to: view.state.doc.line(interpretations.source.endLine).to,
                    height: (interpretations.target.endLine - interpretations.target.startLine + 1) * 14 // Adjust height based on the number of lines
                }),
            );
        }
        if (interpretations.target.startLine && interpretations.target.endLine) {
            effects.push(
                interpretationEffect.of({
                    from: view.state.doc.line(interpretations.target.startLine).from,
                    to: view.state.doc.line(interpretations.target.endLine).to,
                    action: interpretations.action,
                    isSource: false,
                    on: true
                })
            )
        }

        view.dispatch({ effects });
    } catch (e) {
        console.error(e);
    }
}

export class CodeEditorShapeUtil extends BaseBoxShapeUtil<CodeEditorShape> {
    static override type = 'code-editor-shape' as const

    static override props: RecordProps<CodeEditorShape> = {
        w: T.number,
        h: T.number,
        code: T.string,
        prevCode: T.string,
        res: T.string,
        interpretations: T.any,
        taskFiles: T.any,
    }

    getDefaultProps(): CodeEditorShape['props'] {
        return {
            w: 400,
            h: 300,
            code: ``,
            prevCode: '',
            res: '',
            interpretations: {
                source: {
                    startLine: 0,
                    endLine: 0
                },
                action: '',
                target: {
                    startLine: 0,
                    endLine: 0
                }
            },
            taskFiles: {}
        }
    }

    override canEdit = () => true
    override isAspectRatioLocked = () => false
    override canResize = () => true
    override canBind = () => false
    // override canUnmount = () => false
    override hideSelectionBoundsFg = () => true
    override hideSelectionBoundsBg = () => true
    override canScroll = () => true
    override canSnap = () => true


    override component(shape: CodeEditorShape) {
        const isEditing = useIsEditing(shape.id)
        const startPosition = useRef<number | null>(null)
        const [selectionRange, setSelectionRange] = useState<{ anchor: number, head: number } | null>(null)
        const [menuPosition, setMenuPosition] = useState<{ top: number, left: number } | null>(null)


        const codeMirrorRef = useRef<ReactCodeMirrorRef | null>(null)
        const extensions = [
            python(),
            javascript(),
            unifiedMergeView({
                original: shape.props.prevCode,
                syntaxHighlightDeletions: false,
                mergeControls: false
            }),
            interpretationGutter,
            highlightField
        ]


        useEffect(() => {
            const view = codeMirrorRef.current?.view;
            if (view && shape.props.interpretations) {
                applyInterpretations(view, shape.props.interpretations);

                const codeMatches = shape.props.interpretations.action.match(/\[\[CODE:(.*?)\]\]/);
                if (codeMatches?.[1]) {
                    applyHighlights(view, codeMatches[1]);
                }
            }
        }, [shape.props.interpretations]);

        useEffect(() => {
            if (codeMirrorRef.current) {
                this.editor.updateShape<CodeEditorShape>({
                    id: shape.id,
                    type: 'code-editor-shape',
                    isLocked: false,
                    props: {
                        ...shape.props,
                        h: 800
                    }
                })

                const codeMirrorView = codeMirrorRef.current?.view as EditorView
                if (codeMirrorView) {
                    codeMirrorView?.dispatch({
                        effects: updateOriginalDoc.of({
                            doc: codeMirrorView.state.toText(shape.props.prevCode),
                            changes: ChangeSet.empty(0),
                        }),
                    });

                    const code = shape.props.code;
                    const prevCode = shape.props.prevCode;
                    if (code.length === prevCode.length + 1 && code.endsWith(' ') && code.slice(0, -1) === prevCode) {
                        undo(codeMirrorView);
                    }
                }

                this.editor.updateShape<CodeEditorShape>({
                    id: shape.id,
                    type: 'code-editor-shape',
                    isLocked: true,
                })
            }

        }, [shape.id, shape.props, shape.props.code, shape.props.prevCode])


        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        const handleCopy = () => {
            const view = codeMirrorRef.current?.view;
            if (view && selectionRange) {
                const selectedText = view.state.sliceDoc(selectionRange.anchor, selectionRange.head);
                navigator.clipboard.writeText(selectedText);
                setSelectionRange(null);
            }
        };

        const handlePaste = () => {
            navigator.clipboard.readText().then((clipText) => {
                const view = codeMirrorRef.current?.view;
                if (view && selectionRange) {
                    view.dispatch(view.state.replaceSelection(clipText));
                    setSelectionRange(null);
                }
            });
        };

        const handleDelete = () => {
            const view = codeMirrorRef.current?.view;
            if (view && selectionRange) {
                view.dispatch(view.state.replaceSelection(''));
                setSelectionRange(null);
            }
        };

        const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            return
        };

        return (
            <div
                onDoubleClick={handleDoubleClick}
                style={{
                    touchAction: isTouchDevice ? 'auto' : 'none',
                    pointerEvents: isEditing ? 'auto' : 'none',
                    gridTemplateColumns: '1fr 1fr',
                    alignItems: 'center',
                    position: 'relative',
                    minHeight: `${shape.props.h}px`
                }}
            >
                <div
                    style={{ position: 'relative', zIndex: 1 }}
                >
                    <CodeMirror
                        id={`editor-${shape.id}`}
                        ref={codeMirrorRef}
                        value={shape.props.code}
                        style={{
                            fontSize: '16px',
                            border: '1px solid var(--color-panel-contrast)',
                            borderRadius: 'var(--radius-2)',
                            backgroundColor: 'var(--color-background)',
                            width: `${shape.props.w}px`,
                            height: `${shape.props.h + 10}px`
                        }}
                        extensions={[...extensions, interpretationGutter]}
                        height={`${shape.props.h}px`}
                        editable={true}
                    />
                </div>
                {(
                    <div id="result-view" style={{
                        width: '100%',
                        minHeight: '20vh',
                        maxHeight: '60vh',
                        overflow: 'auto',
                        borderTop: '5px solid #ccc',
                        fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
                        backgroundColor: 'rgb(248 248 248)',
                        color: '#000',
                        padding: '20px',
                        boxSizing: 'border-box',
                        zIndex: 10,
                        whiteSpace: 'pre-wrap'
                    }}
                        contentEditable={false}
                        tabIndex={-1}
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); return; }}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); return; }}
                        onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); return; }}
                    >
                        <div dangerouslySetInnerHTML={{ __html: shape.props.res }}></div>
                    </div>
                )}
                {selectionRange && menuPosition && (
                    <BubbleMenu
                        onCopy={handleCopy}
                        onPaste={handlePaste}
                        onDelete={handleDelete}
                        position={menuPosition}
                    />
                )}
            </div>
        )
    }

    override async toSvg(shape: CodeEditorShape, _ctx: SvgExportContext): Promise<React.ReactElement | null> {
        const screenShot = await html2canvas(document.getElementById(`editor-${shape.id}`) as HTMLElement, { useCORS: true }).then(function (canvas) {
            const data = canvas.toDataURL('image/png');
            return data;
        });

        return (
            <svg width={shape.props.w} height={shape.props.h} xmlns="http://www.w3.org/2000/svg">
                <filter id="grayscale-filter">
                    <feColorMatrix
                        type="matrix"
                        values="0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 1 0"
                    />
                </filter>
                <image
                    href={screenShot}
                    width={shape.props.w}
                    height={shape.props.h}
                    filter="url(#grayscale-filter)"
                />
            </svg>
        );
    }

    override onDoubleClick = (shape: CodeEditorShape) => {
        return;
    }

    override onRotateStart = (shape: CodeEditorShape) => {
        return;
    }

    override onHandleDrag = (shape: CodeEditorShape) => {
        return;
    }

    indicator(shape: CodeEditorShape) {
        return <rect width={shape.props.w} height={shape.props.h} />
    }
}