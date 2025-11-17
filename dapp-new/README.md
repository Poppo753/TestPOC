# 🌊 Jethos Protocol - Modular DApp

## 📁 Project Structure (Atomic Design Pattern)

```
dapp-new/
├── index.html              # Main HTML entry point
├── main.js                 # Application bootstrapper
├── style.css              # Custom styles (optional, using Tailwind)
│
└── src/
    ├── atoms/             # Basic building blocks
    │   ├── Button.js      # Reusable button component
    │   ├── Input.js       # Form input with validation
    │   ├── Badge.js       # Status badges
    │   └── Icon.js        # SVG icon library
    │
    ├── molecules/         # Combinations of atoms
    │   ├── Card.js        # Card container with variants
    │   ├── FormGroup.js   # Form with inputs & buttons
    │   ├── StatDisplay.js # Stat card with icon & trend
    │   └── Alert.js       # Toast notifications
    │
    ├── organisms/         # Complex UI sections
    │   ├── WalletConnect.js   # Wallet connection flow
    │   ├── StatsGrid.js       # Dashboard stats display
    │   ├── DepositForm.js     # Deposit functionality
    │   └── WithdrawForm.js    # Withdraw functionality
    │
    ├── templates/         # Page layouts
    │   ├── DashboardTemplate.js  # Main dashboard layout
    │   └── GridLayout.js         # Flexible grid system
    │
    ├── utils/             # Helper functions
    │   ├── web3.js        # Web3/Ethers.js integration
    │   └── formatting.js  # Number & address formatting
    │
    └── config/            # Configuration
        ├── contracts.js   # Contract addresses & ABIs
        └── constants.js   # UI constants & messages
```

## 🎨 Design System

### Atomic Design Hierarchy

1. **Atoms** - Individual UI elements
   - Button, Input, Badge, Icon
   - Cannot be broken down further
   - Highly reusable

2. **Molecules** - Groups of atoms
   - Card, FormGroup, StatDisplay, Alert
   - Single responsibility
   - Still generic and reusable

3. **Organisms** - Complete UI sections
   - WalletConnect, StatsGrid, Forms
   - Business logic starts here
   - Feature-specific

4. **Templates** - Page layouts
   - DashboardTemplate, GridLayout
   - Composition of organisms
   - Layout structure

## 🚀 Key Features

### ✅ Modular Architecture
- Each component is self-contained
- Easy to add/remove/modify features
- Components can be reused across pages

### ✅ Grid System
The `Card` component supports flexible grid positioning:

```javascript
new Card({
  colSpan: 2,  // spans 2 columns
  rowSpan: 3,  // spans 3 rows
  // ... other config
});
```

Grid layouts use CSS Grid with 12-column system:
- Mobile: 1 column
- Tablet: 2-6 columns
- Desktop: 12 columns

### ✅ Component Configuration
All components accept config objects:

```javascript
new Button({
  label: 'Connect',
  variant: 'primary',    // primary, secondary, outline, ghost, danger
  size: 'lg',            // sm, md, lg
  fullWidth: true,
  loading: false,
  icon: '🦊',
  onClick: () => {...}
});
```

### ✅ State Management
- Web3Manager singleton for blockchain state
- Component-level state for UI
- Subscribe pattern for reactive updates

### ✅ Styling
- **Tailwind CSS** for utility-first styling
- **Dark mode** ready
- **Responsive** mobile-first design
- **Custom animations** for smooth UX

## 📦 How to Use

### Basic Setup

1. **Open `index.html`** in a browser (or use a local server)
2. The app auto-initializes on page load
3. Connect MetaMask to start using

### Adding a New Page/View

1. Create a new template in `src/templates/`
2. Import and mount it in `main.js`
3. Use existing organisms or create new ones

Example:
```javascript
// src/templates/SwapView.js
import { Card } from '../molecules/Card.js';

export class SwapView {
  render() {
    // Your swap UI here
  }
  
  mount(target) {
    target.appendChild(this.render());
  }
}
```

### Creating Custom Card Layouts

Using the GridLayout system:

```javascript
import { GridLayout } from './templates/GridLayout.js';
import { Card } from './molecules/Card.js';

const layout = new GridLayout({ columns: 12, gap: 6 });

// Big card (2 wide, 3 tall)
layout.addItem(
  new Card({ title: 'Big', content: '...' }),
  { colSpan: 2, rowSpan: 3 }
);

// Small cards
layout.addItem(
  new Card({ title: 'Small 1', content: '...' }),
  { colSpan: 1, rowSpan: 2 }
);

layout.addItem(
  new Card({ title: 'Small 2', content: '...' }),
  { colSpan: 1, rowSpan: 1 }
);

document.body.appendChild(layout.render());
```

## 🎯 Future Enhancements

### Easy to Add:
- ✅ Swap interface (new organism)
- ✅ Portfolio view (new template)
- ✅ Transaction history (new organism)
- ✅ Charts & analytics (new molecules)
- ✅ Multi-token support (extend config)
- ✅ Governance voting (new page)
- ✅ Notifications system (extend toast)

### Example: Adding Swap Feature

1. Create `src/organisms/SwapForm.js`
2. Import in `DashboardTemplate.js`
3. Add to grid layout
4. Done! No changes to existing code

## 🛠️ Technologies

- **Vanilla JavaScript** - No framework overhead
- **ES6 Modules** - Clean imports/exports
- **Tailwind CSS** - Rapid styling
- **Ethers.js v6** - Web3 integration
- **CSS Grid** - Flexible layouts

## 📝 Notes

- All components return HTMLElements
- Use `.render()` to create DOM elements
- Use `.update()` to re-render (if implemented)
- Components are stateful but independent
- Grid system auto-handles responsive breakpoints

## 🎨 Color Palette

- Primary: Purple (`#9333ea`)
- Secondary: Indigo (`#4f46e5`)
- Accent: Blue (`#3b82f6`)
- Success: Green (`#10b981`)
- Warning: Yellow (`#f59e0b`)
- Error: Red (`#ef4444`)

## 📱 Responsive Breakpoints

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

---

**Made with ❤️ for modular, scalable DeFi interfaces**
