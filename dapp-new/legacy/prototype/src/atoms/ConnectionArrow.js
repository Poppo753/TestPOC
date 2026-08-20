/**
 * ConnectionArrow Component
 * Atom component for rendering SVG arrows between function elements
 */
export class ConnectionArrow {
    constructor({ fromElement, toElement, color = '#60a5fa', animated = false }) {
        this.fromElement = fromElement;
        this.toElement = toElement;
        this.color = color;
        this.animated = animated;
    }

    getElementCenter(element) {
        const rect = element.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            rect: rect
        };
    }

    /**
     * Clamp point to be within the visible bounds of a container
     */
    clampToVisibleBounds(point, element) {
        // Find the module card container
        const moduleCard = element.closest('.module-card');
        if (!moduleCard) return point;

        const moduleRect = moduleCard.getBoundingClientRect();
        
        // Check if target is a function inside a scrollable container
        const functionsContainer = element.closest('.functions-container');
        if (functionsContainer) {
            const containerRect = functionsContainer.getBoundingClientRect();
            
            // If element is outside the visible container, clamp to container bounds
            const elementRect = element.getBoundingClientRect();
            
            let clampedY = point.y;
            
            // If element is above visible area, point to top of container
            if (elementRect.top < containerRect.top) {
                clampedY = containerRect.top + 20; // Small offset from top
            }
            // If element is below visible area, point to bottom of container
            else if (elementRect.bottom > containerRect.bottom) {
                clampedY = containerRect.bottom - 20; // Small offset from bottom
            }
            
            // Clamp X to module bounds
            let clampedX = point.x;
            if (point.x < moduleRect.left) {
                clampedX = moduleRect.left + 20;
            } else if (point.x > moduleRect.right) {
                clampedX = moduleRect.right - 20;
            }
            
            return {
                x: clampedX,
                y: clampedY,
                rect: point.rect,
                clamped: clampedY !== point.y || clampedX !== point.x
            };
        }
        
        return point;
    }

    createArrowPath(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Control point per curva bezier
        const controlPointX = from.x + dx / 2;
        const controlPointY = from.y + dy / 2 - distance * 0.2;

        return `M ${from.x} ${from.y} Q ${controlPointX} ${controlPointY}, ${to.x} ${to.y}`;
    }

    createArrowHead(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const angle = Math.atan2(dy, dx);
        
        const arrowSize = 16;
        const x1 = to.x - arrowSize * Math.cos(angle - Math.PI / 6);
        const y1 = to.y - arrowSize * Math.sin(angle - Math.PI / 6);
        const x2 = to.x - arrowSize * Math.cos(angle + Math.PI / 6);
        const y2 = to.y - arrowSize * Math.sin(angle + Math.PI / 6);

        return `M ${to.x} ${to.y} L ${x1} ${y1} M ${to.x} ${to.y} L ${x2} ${y2}`;
    }

    render() {
        if (!this.fromElement || !this.toElement) {
            console.warn('ConnectionArrow: Missing elements');
            return null;
        }

        const from = this.getElementCenter(this.fromElement);
        const to = this.clampToVisibleBounds(
            this.getElementCenter(this.toElement),
            this.toElement
        );

        console.log('🎯 ConnectionArrow render:', {
            from: { x: from.x, y: from.y },
            to: { x: to.x, y: to.y },
            distance: Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2)
        });

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'connection-arrow pointer-events-none');
        svg.style.position = 'fixed';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.zIndex = '30';

        // Curve path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const pathData = this.createArrowPath(from, to);
        console.log('📐 Path data:', pathData);
        path.setAttribute('d', pathData);
        path.setAttribute('stroke', this.color);
        path.setAttribute('stroke-width', '4');
        path.setAttribute('fill', 'none');
        path.setAttribute('opacity', '0.8');
        path.setAttribute('filter', 'drop-shadow(0 0 4px rgba(96, 165, 250, 0.5))');
        
        if (this.animated) {
            path.setAttribute('stroke-dasharray', '8,8');
            const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
            animate.setAttribute('attributeName', 'stroke-dashoffset');
            animate.setAttribute('from', '0');
            animate.setAttribute('to', '16');
            animate.setAttribute('dur', '0.8s');
            animate.setAttribute('repeatCount', 'indefinite');
            path.appendChild(animate);
        }

        // Arrow head
        const arrowHead = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const arrowHeadData = this.createArrowHead(from, to);
        console.log('🔺 ArrowHead data:', arrowHeadData);
        arrowHead.setAttribute('d', arrowHeadData);
        arrowHead.setAttribute('stroke', this.color);
        arrowHead.setAttribute('stroke-width', '4');
        arrowHead.setAttribute('fill', 'none');
        arrowHead.setAttribute('opacity', '0.9');
        arrowHead.setAttribute('stroke-linecap', 'round');

        svg.appendChild(path);
        svg.appendChild(arrowHead);
        
        console.log('✅ SVG children count:', svg.childNodes.length);

        // Store references for updates
        this.element = svg;
        this.pathElement = path;
        this.arrowHeadElement = arrowHead;

        return svg;
    }

    // Update arrow position (useful for scroll/resize)
    update() {
        if (!this.element || !this.fromElement || !this.toElement) return;

        const from = this.getElementCenter(this.fromElement);
        const to = this.clampToVisibleBounds(
            this.getElementCenter(this.toElement),
            this.toElement
        );

        if (this.pathElement) {
            this.pathElement.setAttribute('d', this.createArrowPath(from, to));
        }
        if (this.arrowHeadElement) {
            this.arrowHeadElement.setAttribute('d', this.createArrowHead(from, to));
        }
    }

    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}
