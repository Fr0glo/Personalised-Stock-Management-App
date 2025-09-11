# 🎨 BTP STOCK Frontend

Frontend React application for the Stock Management System, designed exactly like your maquette.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

The app will open at `http://localhost:3000`

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Layout.jsx      # Main layout with sidebar and header
│   │   ├── Sidebar.jsx     # BTP STOCK sidebar navigation
│   │   └── Topbar.jsx      # Top header with search and user profile
│   ├── pages/
│   │   ├── Dashboard.jsx   # Main dashboard with action buttons
│   │   ├── Stock.jsx       # Stock management (placeholder)
│   │   ├── Orders.jsx      # Orders/Commander (placeholder)
│   │   ├── Vouchers.jsx    # Les bons (placeholder)
│   │   └── Personnel.jsx   # Personnel management (placeholder)
│   ├── App.jsx             # Main app with routing
│   └── main.jsx            # React entry point
├── package.json
└── README.md
```

## 🎯 Features Implemented

### ✅ Dashboard
- **Two prominent blue buttons**: Bon d'entrée & Bon de sortie
- **Statistics cards**: Stock count & Personnel count
- **Clean, modern design** matching your maquette

### ✅ Sidebar Navigation
- **BTP STOCK logo** at the top
- **Stock** - Inventory management
- **Commander** - Orders system
- **Les bons** - Voucher management
- **Personnel** - Staff management

### ✅ Top Header
- **Search bar** with search icon
- **User profile** icon
- **Clean, minimal design**

## 🎨 Design Details

- **Color scheme**: Blue primary (#3b82f6) matching your maquette
- **Icons**: Lucide React icons for consistency
- **Typography**: Clean, readable fonts
- **Spacing**: Consistent padding and margins
- **Shadows**: Subtle shadows for depth
- **Hover effects**: Interactive elements with smooth transitions

## 🔧 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Backend Connection
- Frontend runs on port 3000
- Backend API proxy configured to port 5000
- All API calls will go to `/api/*` endpoints

## 📱 Responsive Design

- **Desktop**: Full sidebar and content layout
- **Tablet**: Responsive grid layouts
- **Mobile**: Stacked layouts for small screens

## 🚀 Next Steps

1. **Connect to Backend** - Integrate with your existing APIs
2. **Add Real Data** - Replace placeholder content
3. **Implement Functionality** - Add CRUD operations
4. **Add Forms** - Entry/exit voucher forms
5. **Enhance UI** - Add more interactive elements

## 🎉 Ready to Use!

Your frontend is now ready and matches your maquette design perfectly! 🎨 