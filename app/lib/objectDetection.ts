import { TLShape, Editor, Box, TLShapeId } from '@tldraw/tldraw';
import { Sketch } from './interpretShapes';


function calculateOverlap(box1: number[] | Box, box2: number[] | Box): number {
    if (box1 instanceof Box) {
        box1 = [box1.x, box1.y, box1.x + box1.w, box1.y + box1.h];
    }
    if (box2 instanceof Box) {
        box2 = [box2.x, box2.y, box2.x + box2.w, box2.y + box2.h];
    }

    const [x1, y1, x2, y2] = box1;
    const [x3, y3, x4, y4] = box2;

    const overlapX = Math.max(0, Math.min(x2, x4) - Math.max(x1, x3));
    const overlapY = Math.max(0, Math.min(y2, y4) - Math.max(y1, y3));

    const overlapArea = overlapX * overlapY;
    const box1Area = (x2 - x1) * (y2 - y1);
    const box2Area = (x4 - x3) * (y4 - y3);

    return Math.max(overlapArea / box1Area, overlapArea / box2Area);
}

function calculateDistance(box1: number[] | Box, box2: number[] | Box): number {
    if (box1 instanceof Box) {
        box1 = [box1.x, box1.y, box1.x + box1.w, box1.y + box1.h];
    }
    if (box2 instanceof Box) {
        box2 = [box2.x, box2.y, box2.x + box2.w, box2.y + box2.h];
    }
    const centerX1 = (box1[0] + box1[2]) / 2;
    const centerY1 = (box1[1] + box1[3]) / 2;
    const centerX2 = (box2[0] + box2[2]) / 2;
    const centerY2 = (box2[1] + box2[3]) / 2;

    return Math.sqrt(Math.pow(centerX1 - centerX2, 2) + Math.pow(centerY1 - centerY2, 2));
}

export default function groupShapes(sketches: Sketch[], selectedShapes: TLShape[], editor: Editor): Sketch[] {
    const shapeGroups: Sketch[] = sketches.map(sketch => ({
        ...sketch,
        matched_selected_shapes: [],
    }));
    if (selectedShapes.length === 0) return shapeGroups;

    const overlaps: { [key: string]: { [key: string]: number } } = {};
    const distances: { [key: string]: { [key: string]: number } } = {};

    selectedShapes.forEach((shape: TLShape) => {
        const bbox = editor.getShapePageBounds(shape.id) as Box;
        if (!bbox) return;
        const location = [bbox.x, bbox.y, bbox.x + bbox.w, bbox.y + bbox.h];

        shapeGroups.forEach((sketch, sketchIndex) => {
            const overlap = calculateOverlap(location, sketch.location);
            const distance = calculateDistance(location, sketch.location);

            if (!overlaps[sketchIndex]) overlaps[sketchIndex] = {};
            overlaps[sketchIndex][shape.id] = overlap;

            if (!distances[sketchIndex]) distances[sketchIndex] = {};
            distances[sketchIndex][shape.id] = distance;
        });
    });

    if (!Object.keys(overlaps).length) return shapeGroups;

    // Allocate shapes to the sketch with the highest overlap or nearest distance among all shapes
    // every selectedShape can only allocate to one shapeGroup
    selectedShapes.forEach((shape: TLShape) => {
        const maxOverlapSketchIndexStr = Object.keys(overlaps).reduce((maxIndex, sketchIndex) => {
            return overlaps[sketchIndex][shape.id] > overlaps[maxIndex][shape.id] ? sketchIndex : maxIndex;
        }) as string;

        const minDistanceSketchIndexStr = Object.keys(distances)?.reduce((minIndex, sketchIndex) => {
            return distances[sketchIndex][shape.id] < distances[minIndex][shape.id] ? sketchIndex : minIndex;
        }) as string;

        const maxOverlapSketchIndex = parseInt(maxOverlapSketchIndexStr);
        const minDistanceSketchIndex = parseInt(minDistanceSketchIndexStr);

        // use distance to allocate shape if overlap is too small
        // if (overlaps[maxOverlapSketchIndex][shape.id] <= 0) {
        //     shapeGroups[minDistanceSketchIndex]?.matched_selected_shapes ?
        //         shapeGroups[minDistanceSketchIndex].matched_selected_shapes.push(shape.id) :
        //         shapeGroups[minDistanceSketchIndex].matched_selected_shapes = [shape.id];
        // }
        // else if (overlaps[maxOverlapSketchIndex][shape.id] > 0) {
        //     shapeGroups[maxOverlapSketchIndex]?.matched_selected_shapes ?
        //         shapeGroups[maxOverlapSketchIndex].matched_selected_shapes.push(shape.id) :
        //         shapeGroups[maxOverlapSketchIndex].matched_selected_shapes = [shape.id];
        // }
    });

    return shapeGroups;
}