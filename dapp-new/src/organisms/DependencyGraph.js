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
        this.mode = 'outgoing'; // 'outgoing' or 'incoming'
        
        // Build reverse dependency map for incoming dependencies
        this.buildIncomingMap();
    }

    /**
     * Build reverse dependency map (who calls this function)
     */
    buildIncomingMap() {
        this.incomingDependencies = new Map();
        
        this.dependencies.forEach(dep => {
            const fromParsed = this.parseFunctionName(dep.from);
            
            dep.to.forEach(targetFullName => {
                const toParsed = this.parseFunctionName(targetFullName);
                const targetKey = toParsed.function;
                
                if (!this.incomingDependencies.has(targetKey)) {
                    this.incomingDependencies.set(targetKey, []);
                }
                
                this.incomingDependencies.get(targetKey).push({
                    from: dep.from,
                    module: fromParsed.module,
                    function: fromParsed.function
                });
            });
        });
        
        console.log('📊 Incoming dependencies map built:', this.incomingDependencies.size, 'functions');
    }

    /**
     * Set dependency mode
     */
    setMode(mode) {
        this.mode = mode;
        console.log(`🔄 Dependency mode: ${mode}`);
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
     * Find function element by name within a specific module
     */
    findFunctionElementWithModule(functionName, moduleName) {
        console.log(`🔍 Finding function "${functionName}" in module "${moduleName}"`);
        
        // First check if the source module is expanded
        const moduleCard = this.modulesGrid?.getModuleCardByName(moduleName);
        console.log(`📦 Module card found:`, moduleCard ? `YES (expanded: ${moduleCard.isExpanded})` : 'NO');
        
        if (moduleCard && moduleCard.isExpanded) {
            // Module is expanded, find the specific function within that module
            const moduleElement = moduleCard.cardElement;
            console.log(`📋 Module element:`, moduleElement ? 'YES' : 'NO');
            
            if (moduleElement) {
                // Search for function cards - they are inside functionsInner which is inside functionsContainer
                const functionsContainer = moduleElement.querySelector('.functions-container');
                console.log(`📦 Functions container:`, functionsContainer ? 'YES' : 'NO');
                
                // The function cards are actually one level deeper
                let searchRoot = functionsContainer;
                if (functionsContainer) {
                    // Try to find the inner div with the actual cards
                    const innerDiv = functionsContainer.querySelector('div');
                    if (innerDiv) {
                        searchRoot = innerDiv;
                        console.log(`📦 Found inner functions div`);
                        console.log(`📦 Inner div classes:`, innerDiv.className);
                        console.log(`📦 Inner div children:`, innerDiv.children.length);
                        console.log(`📦 Inner div innerHTML length:`, innerDiv.innerHTML.length);
                        
                        // Log first child to see structure
                        if (innerDiv.children.length > 0) {
                            const firstChild = innerDiv.children[0];
                            console.log(`📦 First child tag:`, firstChild.tagName);
                            console.log(`📦 First child classes:`, firstChild.className);
                            console.log(`📦 First child has .function-card:`, firstChild.classList.contains('function-card'));
                            console.log(`📦 First child outerHTML:`, firstChild.outerHTML.substring(0, 200));
                        }
                    }
                }
                
                const cards = searchRoot ? searchRoot.querySelectorAll('.function-card') : [];
                console.log(`🔢 Function cards found:`, cards.length);
                
                // Try also searching from moduleElement directly
                const cardsFromModule = moduleElement.querySelectorAll('.function-card');
                console.log(`🔢 Function cards from module root:`, cardsFromModule.length);
                
                if (cards.length > 0) {
                    console.log(`📝 First 3 function names:`, 
                        Array.from(cards).slice(0, 3).map(c => 
                            c.querySelector('.function-name')?.textContent.trim()
                        )
                    );
                } else if (cardsFromModule.length > 0) {
                    console.log(`✅ Using cards from module root instead`);
                    // Use the cards found from module root
                    for (const card of cardsFromModule) {
                        const nameElement = card.querySelector('.function-name');
                        const cardFuncName = nameElement?.textContent.trim().replace('()', ''); // Remove () from display name
                        if (cardFuncName === functionName) {
                            console.log(`✅ Found function card: ${cardFuncName}`);
                            return card;
                        }
                    }
                }
                
                for (const card of cards) {
                    const nameElement = card.querySelector('.function-name');
                    const cardFuncName = nameElement?.textContent.trim().replace('()', ''); // Remove () from display name
                    if (cardFuncName === functionName) {
                        console.log(`✅ Found function card: ${cardFuncName}`);
                        return card;
                    }
                }
                console.warn(`⚠️ Function "${functionName}" not found in module "${moduleName}"`);
            }
        } else if (moduleCard) {
            // Module is collapsed, return the module header
            console.log(`📌 Module collapsed, returning header`);
            return moduleCard.getHeaderElement();
        }
        
        // Fallback to generic search
        console.warn(`⚠️ Falling back to generic search for "${functionName}"`);
        return this.findFunctionElement(functionName);
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

        if (this.mode === 'outgoing') {
            this.showOutgoingDependencies(functionName);
        } else {
            this.showIncomingDependencies(functionName);
        }

        this.isActive = true;
        this.setupEventListeners();
    }

    /**
     * Show dependencies for a specific function with module context
     */
    showDependenciesWithModule(functionName, moduleName) {
        this.clearAll();

        if (this.mode === 'outgoing') {
            this.showOutgoingDependenciesWithModule(functionName, moduleName);
        } else {
            this.showIncomingDependencies(functionName);
        }

        this.isActive = true;
        this.setupEventListeners();
    }

    /**
     * Show outgoing dependencies (what this function calls)
     */
    showOutgoingDependencies(functionName) {
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
            // Match using full module.function format or just function name for backward compatibility
            return d.from === functionName || d.from.endsWith(`.${functionName}`);
        });

        if (!deps || !deps.to || deps.to.length === 0) {
            console.log(`DependencyGraph: No outgoing dependencies found for ${functionName}`);
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
    }

    /**
     * Show outgoing dependencies with module context (what this function calls)
     */
    showOutgoingDependenciesWithModule(functionName, moduleName) {
        // Find the source element using module context
        const sourceElement = this.findFunctionElementWithModule(functionName, moduleName);
        if (!sourceElement) {
            console.warn(`DependencyGraph: Source element not found for ${moduleName}.${functionName}`);
            return;
        }

        // Highlight source
        sourceElement.classList.add('ring-4', 'ring-blue-500', 'ring-opacity-50');

        // Build full function name for matching
        const fullFunctionName = `${moduleName}.${functionName}`;
        console.log(`🔍 Looking for dependencies: ${fullFunctionName}`);

        // Find dependencies for this function using full name
        const deps = this.dependencies.find(d => d.from === fullFunctionName);

        if (!deps || !deps.to || deps.to.length === 0) {
            console.log(`DependencyGraph: No outgoing dependencies found for ${fullFunctionName}`);
            return;
        }

        console.log(`✅ Found ${deps.to.length} dependencies:`, deps.to);

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
                console.warn(`DependencyGraph: Target element not found for ${targetFullName}`);
            }
        });
    }

    /**
     * Show incoming dependencies (what calls this function)
     */
    showIncomingDependencies(functionName) {
        // Find the target element (this function)
        const targetElement = this.findFunctionElement(functionName);
        if (!targetElement) {
            console.warn(`DependencyGraph: Target element not found for ${functionName}`);
            return;
        }

        // Highlight target (this function being called)
        targetElement.classList.add('ring-4', 'ring-purple-500', 'ring-opacity-50');

        // Find who calls this function
        const incomingDeps = this.incomingDependencies.get(functionName);

        if (!incomingDeps || incomingDeps.length === 0) {
            console.log(`DependencyGraph: No incoming dependencies found for ${functionName}`);
            return;
        }

        // Create arrows from each caller TO this function
        incomingDeps.forEach((caller, index) => {
            const sourceElement = this.findTargetElement(caller.function, caller.module);

            if (sourceElement) {
                console.log(`🔗 Creating incoming arrow: ${caller.function} → ${functionName}`);
                console.log('  Source:', sourceElement);
                console.log('  Target:', targetElement);
                
                // Highlight source (caller)
                sourceElement.classList.add('ring-2', 'ring-orange-500', 'ring-opacity-50');

                // Determine color
                const color = this.getColorForFunction(functionName); // Color of target function
                console.log('  Color:', color);

                // Create arrow FROM caller TO this function (same direction as outgoing)
                setTimeout(() => {
                    const arrow = new ConnectionArrow({
                        fromElement: sourceElement,  // Caller
                        toElement: targetElement,     // This function
                        color: color,
                        animated: true
                    });

                    const arrowElement = arrow.render();
                    console.log('  Arrow element created:', arrowElement);
                    
                    if (arrowElement) {
                        document.body.appendChild(arrowElement);
                        this.arrows.push({ 
                            arrow, 
                            arrowElement, 
                            sourceElement, 
                            targetElement,
                            targetModule: caller.module,
                            targetFunction: caller.function
                        });
                        
                        // Initial update to ensure correct positioning
                        requestAnimationFrame(() => arrow.update());
                    }
                }, index * 100);
            } else {
                console.warn(`DependencyGraph: Source element not found for ${caller.function}`);
            }
        });
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
