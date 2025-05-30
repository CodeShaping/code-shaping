import * as React from 'react';
import Box from '@mui/material/Box';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import IconButton from '@mui/material/IconButton';
import { FiMenu } from "react-icons/fi";
import { FaPython } from "react-icons/fa";
import { userStudyTasks, Task } from '../lib/tasks';

interface FileManagerProps {
    onTaskChange: (task: Task) => void;
}

export default function FileManager({ onTaskChange }: FileManagerProps) {
    const [isExpanded, setIsExpanded] = React.useState(true);
    const [expandedFolders, setExpandedFolders] = React.useState<string[]>([
        'Task 1',
        'Task 2',
        'Task 3',
        'Task 4',
        'Task 5',
    ]);

    const handleFileClick = (taskId: string) => {
        const task = userStudyTasks.find(task => task.id === taskId);
        if (task) {
            onTaskChange(task);
        }
    };

    const toggleExpansion = () => {
        setIsExpanded(!isExpanded);
    };

    const handleExpandedItemsChange = (
        event: React.SyntheticEvent,
        itemIds: string[],
    ) => {
        setExpandedFolders(itemIds);
    };

    const groupedTasks = {
        'Task 1': userStudyTasks.filter(task => task.id.startsWith('1')),
        'Task 2': userStudyTasks.filter(task => task.id.startsWith('2')),
        'Task 3': userStudyTasks.filter(task => task.id.startsWith('3')),
        'Task 4': userStudyTasks.filter(task => task.id.startsWith('4')),
        'Task 5': userStudyTasks.filter(task => task.id.startsWith('5')),
    };

    return (
        <Box sx={{ height: 'auto', width: isExpanded ? 250 : 50, transition: 'width 0.3s', backgroundColor: isExpanded ? '#f8f8f8' : '#f8f8f800', borderRadius: 5, padding: isExpanded ? '10px' : '0px' }}>
            <IconButton onClick={toggleExpansion} sx={{ marginBottom: 1 }}>
                <FiMenu />
            </IconButton>
            {isExpanded && (
                <SimpleTreeView expandedItems={expandedFolders} onExpandedItemsChange={handleExpandedItemsChange}>
                    {Object.entries(groupedTasks).map(([folderName, tasks]) => (
                        <TreeItem key={folderName} itemId={folderName} label={folderName}>
                            {tasks.map((task) => (
                                <TreeItem
                                    key={task.id}
                                    itemId={task.id}
                                    label={<><FaPython /> {task.title}</>}
                                    onClick={() => handleFileClick(task.id)}
                                />
                            ))}
                        </TreeItem>
                    ))}
                </SimpleTreeView>
            )}
        </Box>
    );
}