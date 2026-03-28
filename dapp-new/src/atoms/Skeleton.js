// ============================================
// ATOM: Skeleton Loading Component
// Shimmer effect for loading states
// ============================================

export class Skeleton {
  constructor(config = {}) {
    this.width = config.width || '100%';
    this.height = config.height || '20px';
    this.variant = config.variant || 'rectangular'; // rectangular, circular, text
    this.className = config.className || '';
  }

  render() {
    const skeleton = document.createElement('div');
    skeleton.className = `skeleton ${this.variant} ${this.className}`;
    
    // Set dimensions with display: block to ensure visibility
    skeleton.style.display = 'block';
    skeleton.style.width = this.width;
    skeleton.style.height = this.height;
    skeleton.style.minHeight = this.height;

    // Add shimmer animation
    const shimmer = document.createElement('div');
    shimmer.className = 'skeleton-shimmer';
    skeleton.appendChild(shimmer);

    return skeleton;
  }
}

// Export utility function for multiple skeletons
export function renderSkeletons(count, config) {
  const container = document.createElement('div');
  container.className = 'skeleton-container';
  
  for (let i = 0; i < count; i++) {
    const skeleton = new Skeleton(config);
    container.appendChild(skeleton.render());
  }
  
  return container;
}
