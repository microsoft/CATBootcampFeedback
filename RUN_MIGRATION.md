# Run Database Migration - Quick Start

## 🚀 Execute Migration Automatically

I've created `execute-migration.ps1` which will handle everything for you!

### Step 1: Update Azure Connection Details

Open `execute-migration.ps1` and update these lines (around line 13-15):

```powershell
$serverName = "your-server-name.database.windows.net"
$databaseName = "your-database-name"
$adminUser = "your-sql-admin-username"
```

**Find your connection details:**
- Go to Azure Portal → SQL databases → Your database
- Click "Connection strings" in left menu
- Copy the server name and database name from there

### Step 2: Run the Script

**Option A: PowerShell (Recommended)**
```powershell
cd C:\Users\dewainr\UsersdewainrCATBootcampFeedback
.\execute-migration.ps1
```

When prompted, enter your SQL admin password.

**Option B: Right-click**
- Right-click `execute-migration.ps1`
- Select "Run with PowerShell"
- Enter password when prompted

### What the Script Does

1. ✅ Connects to your Azure SQL Database
2. ✅ Installs SqlServer module if needed
3. ✅ Executes the complete migration
4. ✅ Backs up old data
5. ✅ Creates new Modules and Events tables
6. ✅ Migrates all data
7. ✅ Creates views and stored procedures
8. ✅ Verifies everything worked
9. ✅ Shows you a summary

**Estimated time:** 2-5 minutes

### Troubleshooting

**Error: "Cannot connect to server"**
- Check firewall rules in Azure Portal
- Add your IP address to SQL Server firewall
- Azure Portal → SQL Server → Firewalls and virtual networks

**Error: "Login failed"**
- Verify SQL admin username and password
- Try connecting via Azure Portal Query Editor first

**Error: "SqlServer module installation failed"**
Run as Administrator:
```powershell
Install-Module -Name SqlServer -Force -AllowClobber
```

---

## ✅ Success!

If you see:
```
✓ MIGRATION COMPLETED SUCCESSFULLY!
```

Then you're done! The new Modules + Events structure is ready.

**Next:** API endpoints will automatically use the new structure on next deployment.
