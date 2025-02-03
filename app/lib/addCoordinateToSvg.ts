export function addCoordinateToSvg(
    svg: SVGSVGElement,
    opts = {} as {
        color?: string;
        size?: number;
        labels?: boolean;
    }
) {
    const { color = '#fc0000', size = 100, labels = true } = opts;

    const [x, y, w, h] = svg
        .getAttribute('viewBox')!
        .split(' ')
        .map((v) => +v);

    const tickLength = 100; // Length of the tick marks

    const grid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    grid.setAttribute('transform', `translate(${x}, ${y})`);
    grid.setAttribute('id', 'grid');
    grid.setAttribute('stroke', color);
    grid.setAttribute('stroke-width', '1');

    if (labels) {
        grid.setAttribute('font', '12px sans-serif');
        grid.setAttribute('fill', color);
        grid.setAttribute('text-anchor', 'middle');
    }

    // Add vertical lines
    for (let i = 0; i <= Math.ceil(w / size); i++) {
        const xPos = i * size;
        const verticalTick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        verticalTick.setAttribute('x1', `${xPos}`);
        verticalTick.setAttribute('y1', `${-tickLength / 2}`);
        verticalTick.setAttribute('x2', `${xPos}`);
        verticalTick.setAttribute('y2', `${h}`);
        verticalTick.setAttribute('stroke-width', '.5');
        verticalTick.setAttribute('stroke-dasharray', '5,5');
        grid.appendChild(verticalTick);

        // Label
        if (labels) {
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', `${xPos}`);
            label.setAttribute('y', `${30}`);
            label.textContent = `${Math.round(x + i * size)}`;

            const endLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            endLabel.setAttribute('x', `${xPos}`);
            endLabel.setAttribute('y', `${h - 5}`);
            endLabel.textContent = `${Math.round(x + i * size)}`;

            grid.appendChild(label);
            grid.appendChild(endLabel);
        }
    }

    // Add horizontal lines
    for (let i = 0; i <= Math.ceil(h / size); i++) {
        const yPos = i * size;
        const horizontalTick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        horizontalTick.setAttribute('x1', `${-tickLength / 2}`);
        horizontalTick.setAttribute('y1', `${yPos}`);
        horizontalTick.setAttribute('x2', `${w}`);
        horizontalTick.setAttribute('y2', `${yPos}`);
        horizontalTick.setAttribute('stroke-width', '.5');
        horizontalTick.setAttribute('stroke-dasharray', '5,5');
        grid.appendChild(horizontalTick);


        // Label
        if (labels) {
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', `${35}`);
            label.setAttribute('y', `${yPos + 6}`);
            label.textContent = `${Math.round(y + i * size)}`;

            const endLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            endLabel.setAttribute('x', `${w - 15}`);
            endLabel.setAttribute('y', `${yPos + 6}`);
            endLabel.textContent = `${Math.round(y + i * size)}`;

            grid.appendChild(label);
            grid.appendChild(endLabel);
        }
    }

    svg.appendChild(grid);
}