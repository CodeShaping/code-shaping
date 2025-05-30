import React from 'react';
import { IoLinkOutline, IoAddCircle } from "react-icons/io5";
import { FaDeleteLeft } from "react-icons/fa6";
import { VscReplace } from "react-icons/vsc";


export type ControlBrusheType = 'reference' | 'delete' | 'add' | 'replace'
interface ControlBrushesProps {
    onSelectBrush: (brush: ControlBrusheType) => void;
    onStoreLog: (log: any) => void;
}

// maps of brush type, description and icons
export const availableBrushes = [
    { type: 'reference', description: 'Reference', icon: <IoLinkOutline />, color: 'rgb(77, 171, 247)', dataId: 'style.color.light-blue' },
    { type: 'delete', description: 'Delete', icon: <FaDeleteLeft />, color: 'rgb(247, 103, 7)', dataId: 'style.color.orange' },
    { type: 'add', description: 'Add', icon: <IoAddCircle />, color: 'rgb(9, 146, 104)', dataId: 'style.color.green' },
    { type: 'replace', description: 'Replace', icon: <VscReplace />, color: 'rgb(174, 62, 201)', dataId: 'style.color.violet' },
];


export const ControlBrushes: React.FC<ControlBrushesProps> = ({ onSelectBrush, onStoreLog }) => {
    const [selectedBrush, setSelectedBrush] = React.useState<ControlBrusheType | ''>('');

    const handleBrushSelection = (brush: ControlBrusheType) => {
        setSelectedBrush(brush);
        onSelectBrush(brush);
        onStoreLog({ type: 'brush', data: brush });
    }

    return (
        <div className='controlBrushes'>
            {availableBrushes.map(brush => (
                <button key={brush.type}
                    style={{ borderColor: brush.color }}
                    className={`controlBrushButton ${selectedBrush === brush.type ? 'active' : ''}`}
                    onClick={() => handleBrushSelection(brush.type as ControlBrusheType)}>
                    {brush.icon}
                </button>
            ))}
        </div>
    );
};