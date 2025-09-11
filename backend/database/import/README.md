# 📥 Data Import Guide

This folder contains CSV files for importing data from your existing office app into the Stock Management System.

## 📁 Files Structure

```
database/import/
├── stock_items.csv    # Your products/inventory
├── workers.csv        # Your workers/personnel
├── users.csv          # Your office staff
└── README.md          # This file
```

## 🚀 How to Import Data

### Step 1: Prepare Your CSV Files

**Replace the sample files with your actual data:**

1. **`stock_items.csv`** - Your products/inventory
2. **`workers.csv`** - Your workers/personnel  
3. **`users.csv`** - Your office staff

### Step 2: Run the Import

```bash
cd backend
npm run import-data
```

### Step 3: Verify Import

Check your API endpoints:
- `GET http://localhost:5000/api/stock-items`
- `GET http://localhost:5000/api/workers`
- `GET http://localhost:5000/api/users`

## 📋 CSV File Formats

### Stock Items (`stock_items.csv`)
```csv
item_name,quantity,unit,notes
Cable électrique 2.5mm,500,mètres,Cable pour électricité domestique
Tuyaux PVC 50mm,200,mètres,Tuyaux pour plomberie
```

**Columns:**
- `item_name` - Product name (required)
- `quantity` - Current stock quantity (number)
- `unit` - Unit of measurement (pcs, kg, litres, mètres, etc.)
- `notes` - Description (optional)

### Workers (`workers.csv`)
```csv
F_Name,Surname,Carte_National,Role
Ahmed,Benzema,123456789,Security
Mohammed,Salah,987654321,Foreman
```

**Columns:**
- `F_Name` - First name (required)
- `Surname` - Last name (required)
- `Carte_National` - National ID (optional)
- `Role` - Job title/position (optional)

### Users (`users.csv`)
```csv
username,role
admin,admin
staff1,staff
manager,admin
```

**Columns:**
- `username` - Login username (required)
- `role` - User role: `admin` or `staff`

## 🔄 Import Options

### Option 1: Export from Excel
1. Open your existing app's data in Excel
2. Save as CSV format
3. Copy to this folder
4. Run import

### Option 2: Export from Database
1. Export your data to CSV from your existing database
2. Copy to this folder
3. Run import

### Option 3: Manual CSV Creation
1. Create CSV files manually
2. Add your data in the correct format
3. Run import

## ⚠️ Important Notes

- **Backup first**: Always backup your current database before importing
- **Check format**: Ensure your CSV files match the expected format
- **No duplicates**: The import will add new records, not replace existing ones
- **Encoding**: Use UTF-8 encoding for special characters (é, à, etc.)

## 🛠️ Troubleshooting

### If import fails:
1. Check CSV file format
2. Ensure no special characters in column names
3. Verify all required fields are present
4. Check file encoding (should be UTF-8)

### To reset and import fresh:
```bash
npm run reset-db
npm run import-data
```

## 📞 Need Help?

If your existing app data is in a different format, let me know and I can help you create a custom import script! 