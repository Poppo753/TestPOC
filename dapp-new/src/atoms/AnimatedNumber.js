// ============================================
// ATOM: Animated Number Component
// Smoothly animates number changes
// ============================================

export class AnimatedNumber {
  constructor(config = {}) {
    this.value = parseFloat(config.value) || 0;
    this.decimals = config.decimals ?? 6;
    this.suffix = config.suffix || '';
    this.duration = config.duration || 800; // ms
    this.className = config.className || '';
    
    this.currentValue = this.value;
    this.element = null;
    this.animationFrame = null;
  }

  /**
   * Animate from current value to new target value
   */
  animateTo(newValue) {
    const target = parseFloat(newValue) || 0;
    const start = this.currentValue;
    const change = target - start;
    const startTime = performance.now();

    // Cancel any existing animation
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / this.duration, 1);
      
      // Easing function (ease-out-cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      
      this.currentValue = start + (change * eased);
      
      if (this.element) {
        this.element.textContent = this.formatValue(this.currentValue);
      }

      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(animate);
      } else {
        this.currentValue = target;
        if (this.element) {
          this.element.textContent = this.formatValue(target);
        }
      }
    };

    this.animationFrame = requestAnimationFrame(animate);
  }

  /**
   * Format the number with proper decimals and suffix
   */
  formatValue(value) {
    const formatted = value.toFixed(this.decimals);
    return this.suffix ? `${formatted} ${this.suffix}` : formatted;
  }

  /**
   * Update the value (will animate if rendered)
   */
  setValue(newValue) {
    const target = parseFloat(newValue) || 0;
    
    if (this.element) {
      // Already rendered, animate the change
      this.animateTo(target);
    } else {
      // Not yet rendered, just update the value
      this.value = target;
      this.currentValue = target;
    }
  }

  render() {
    this.element = document.createElement('span');
    this.element.className = this.className;
    this.element.textContent = this.formatValue(this.currentValue);
    
    // Add transition for color changes
    this.element.style.transition = 'color 0.3s ease';
    
    return this.element;
  }

  /**
   * Cleanup when component is destroyed
   */
  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.element = null;
  }
}
