import React, { useState } from 'react';

interface ActionRecognitionProps {
    text: string;
}

const ActionRecognition: React.FC<ActionRecognitionProps> = ({ text }) => {
    // const [expandedKeys, setExpandedKeys] = useState<Set<number>>(new Set());

    const parseText = (text: string) => {
        const elements: JSX.Element[] = [];
        let keyCounter = 0;

        const regex = /\[\[(ACTION|CODE|RECOGNITION):(.*?)\]\]/g;
        let lastIndex = 0;
        let match;
        if (!text) return <span></span>;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                elements.push(<span key={keyCounter++}>{text.slice(lastIndex, match.index)}</span>);
            }

            const tagType = match[1];
            const content = match[2];

            const style = getStyleForTag(tagType);
            elements.push(renderTruncatedText(content, keyCounter++, style));

            lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
            elements.push(<span key={keyCounter++}>{text.slice(lastIndex)}</span>);
        }

        return elements;
    };

    const getStyleForTag = (tagType: string): React.CSSProperties => {
        switch (tagType) {
            case 'ACTION':
                return actionStyle;
            case 'CODE':
                return codeStyle;
            case 'RECOGNITION':
                return recognitionStyle;
            default:
                return {};
        }
    };

    const renderTruncatedText = (text: string, key: number, style: React.CSSProperties) => {
        // const isExpanded = expandedKeys.has(key);
        // const handleClick = () => {
        //     const newExpandedKeys = new Set(expandedKeys);
        //     if (isExpanded) {
        //         newExpandedKeys.delete(key);
        //     } else {
        //         newExpandedKeys.add(key);
        //     }
        //     setExpandedKeys(newExpandedKeys);
        // };

        return (
            <span key={key} style={style} title={text}>
                {text.length <= 20 ? text : `${text.slice(0, 30)}...`}
            </span>
        );
    };

    const actionStyle: React.CSSProperties = {
        backgroundColor: 'rgba(145, 194, 215, 0.5)',
        borderRadius: '3px',
        padding: '2px 6px',
        margin: '0 2px',
        fontWeight: 'bold',
    };

    const recognitionStyle: React.CSSProperties = {
        backgroundColor: 'rgba(162, 213, 159, 0.5)',
        borderRadius: '3px',
        padding: '2px 6px',
        margin: '0 2px',
        fontWeight: 'bold',
    };

    const codeStyle: React.CSSProperties = {
        backgroundColor: '#D0C3F7',
        borderRadius: '3px',
        padding: '2px 6px',
        margin: '0 2px',
        fontWeight: 'bold',
        fontFamily: 'monospace',
    };

    return <div>{parseText(text)}</div>;
};

export default ActionRecognition;