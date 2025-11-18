import { ConnectionArrow } from '../atoms/ConnectionArrow.js';

/**
 * DependencyGraph Component
 * Organism for managing and rendering function dependency connections
 */
export class DependencyGraph {
    constructor({ dependencies, getColorForFunction, modulesGrid }) {
        this.dependencies = dependencies || [];
        this.getColorForFunction = getColorForFunction || (() => '#60a5fa');
        this.modulesGrid = modulesGrid;
        this.arrows = [];
        this.isActive = false;
    }

    /**
     * Find function element by name, or module header if function is in collapsed module
     */
    findFunctionElement(functionName) {
        // Try to find by data attribute first
        const byData = document.querySelector(`[data-function-name="${functionName}"]`);
        if (byData) return byData;

        // Fallback: search in function cards
        const cards = document.querySelectorAll('.function-card');
        for (const card of cards) {
            const nameElement = card.querySelector('.function-name');
            if (nameElement && nameElement.textContent.trim() === functionName) {
                return card;
            }
        }

        return null;
    }

    /**
     * Find target element (function if expanded, module header if collapsed)
     */
    findTargetElement(functionName, moduleName) {
        // First check if the target module is expanded
        const moduleCard = this.modulesGrid?.getModuleCardByName(moduleName);
        
        if (moduleCard && moduleCard.isExpanded) {
            // Module is expanded, find the specific function
            return this.findFunctionElement(functionName);
        } else if (moduleCard) {
            // Module is collapsed, target the module header
            return moduleCard.getHeaderElement();
        }
        
        // Fallback to function search
        return this.findFunctionElement(functionName);
    }

    /**
     * Parse full function name (Module.function)
     */
    parseFunctionName(fullName) {
        const parts = fullName.split('.');
        return {
            module: parts[0],
            function: parts.length > 1 ? parts[1] : parts[0]
        };
    }

    /**
     * Show dependencies for a specific function
     */
    showDependencies(functionName) {
        this.clearAll();

        // Find the source element
        const sourceElement = this.findFunctionElement(functionName);
        if (!sourceElement) {
            console.warn(`DependencyGraph: Source element not found for ${functionName}`);
            return;
        }

        // Highlight source
        sourceElement.classList.add('ring-4', 'ring-blue-500', 'ring-opacity-50');

        // Find dependencies for this function
        const deps = this.dependencies.find(d => {
            const parsed = this.parseFunctionName(d.from);
            return parsed.function === functionName || d.from.includes(functionName);
        });

        if (!deps || !deps.to || deps.to.length === 0) {
            console.log(`DependencyGraph: No dependencies found for ${functionName}`);
            return;
        }

        // Create arrows to each dependency
        deps.to.forEach((targetFullName, index) => {
            const parsed = this.parseFunctionName(targetFullName);
            const targetElement = this.findTargetElement(parsed.function, parsed.module);

            if (targetElement) {
                // Highlight target
                targetElement.classList.add('ring-2', 'ring-green-500', 'ring-opacity-50');

                // Determine color
                const color = this.getColorForFunction(parsed.function);

                // Create arrow with delay for animation effect
                setTimeout(() => {
                    const arrow = new ConnectionArrow({
                        fromElement: sourceElement,
                        toElement: targetElement,
                        color: color,
                        animated: true
                    });

                    const arrowElement = arrow.render();
                    if (arrowElement) {
                        document.body.appendChild(arrowElement);
                        this.arrows.push({ 
                            arrow, 
                            arrowElement, 
                            sourceElement, 
                            targetElement,
                            targetModule: parsed.module,
                            targetFunction: parsed.function
                        });
                        
                        // Initial update to ensure correct positioning
                        requestAnimationFrame(() => arrow.update());
                    }
                }, index * 100);
            } else {
                console.warn(`DependencyGraph: Target element not found for ${parsed.function}`);
            }
        });

        this.isActive = true;

        // Update arrows on scroll/resize
        this.setupEventListeners();
    }

    /**
     * Show all dependencies in the system
     */
    showAllDependencies() {
        this.clearAll();

        this.dependencies.forEach((dep, depIndex) => {
            const parsedFrom = this.parseFunctionName(dep.from);
            const sourceElement = this.findFunctionElement(parsedFrom.function);

            if (!sourceElement) return;

            dep.to.forEach((targetFullName, targetIndex) => {
                const parsedTo = this.parseFunctionName(targetFullName);
                const targetElement = this.findFunctionElement(parsedTo.function);

                if (targetElement) {
                    const color = this.getColorForFunction(parsedTo.function);

                    setTimeout(() => {
                        const arrow = new ConnectionArrow({
                            fromElement: sourceElement,
                            toElement: targetElement,
                            color: color,
                            animated: false
                        });

                        const arrowElement = arrow.render();
                        if (arrowElement) {
                            document.body.appendChild(arrowElement);
                            this.arrows.push({ arrow, arrowElement, sourceElement, targetElement });
                        }
                    }, (depIndex * dep.to.length + targetIndex) * 50);
                }
            });
        });

        this.isActive = true;
        this.setupEventListeners();
    }

    /**
     * Clear all arrows and highlights
     */
    clearAll() {
        // Remove arrows
        this.arrows.forEach(({ arrowElement, sourceElement, targetElement }) => {
            if (arrowElement && arrowElement.parentNode) {
                arrowElement.parentNode.removeChild(arrowElement);
            }
            // Remove highlights
            if (sourceElement) {
                sourceElement.classList.remove('ring-4', 'ring-blue-500', 'ring-opacity-50');
            }
            if (targetElement) {
                targetElement.classList.remove('ring-2', 'ring-green-500', 'ring-opacity-50');
            }
        });

        this.arrows = [];
        this.isActive = false;
        this.removeEventListeners();
    }

    /**
     * Update arrow positions and targets (for when modules expand/collapse)
     */
    updatePositions() {
        requestAnimationFrame(() => {
            this.arrows.forEach(({ arrow, targetModule, targetFunction }) => {
                // Re-find target in case module expanded/collapsed
                if (targetModule && targetFunction) {
                    const newTarget = this.findTargetElement(targetFunction, targetModule);
                    if (newTarget && newTarget !== arrow.toElement) {
                        // Target changed (module expanded/collapsed)
                        arrow.toElement = newTarget;
                    }
                }
                arrow.update();
            });
        });
    }

    /**
     * Refresh arrows when a module is toggled
     */
    refreshArrows() {
        this.arrows.forEach(({ arrow, targetElement, targetModule, targetFunction }) => {
            // Remove old highlight
            if (targetElement) {
                targetElement.classList.remove('ring-2', 'ring-green-500', 'ring-opacity-50');
            }
            
            // Find new target
            const newTarget = this.findTargetElement(targetFunction, targetModule);
            if (newTarget) {
                newTarget.classList.add('ring-2', 'ring-green-500', 'ring-opacity-50');
                arrow.toElement = newTarget;
                arrow.update();
            }
        });
    }

    /**
     * Setup event listeners for dynamic updates
     */
    setupEventListeners() {
        this.boundUpdatePositions = this.updatePositions.bind(this);
        
        // Scroll updates (for main window and any scrollable containers)
        window.addEventListener('scroll', this.boundUpdatePositions, true);
        window.addEventListener('resize', this.boundUpdatePositions);
        
        // Listen to scroll inside function containers
        const functionContainers = document.querySelectorAll('.functions-container');
        functionContainers.forEach(container => {
            container.addEventListener('scroll', this.boundUpdatePositions, true);
        });
        
        // Continuous updates for smooth tracking
        this.updateInterval = setInterval(this.boundUpdatePositions, 100);
    }

    /**
     * Remove event listeners
     */
    removeEventListeners() {
        if (this.boundUpdatePositions) {
            window.removeEventListener('scroll', this.boundUpdatePositions, true);
            window.removeEventListener('resize', this.boundUpdatePositions);
            
            const mainElement = document.querySelector('main');
            if (mainElement) {
                mainElement.removeEventListener('scroll', this.boundUpdatePositions, true);
            }
        }
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Toggle dependency view
     */
    toggle() {
        if (this.isActive) {
            this.clearAll();
        } else {
            this.showAllDependencies();
        }
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        this.clearAll();
    }
}
