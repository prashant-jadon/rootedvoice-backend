# Create Admin User Script

Quick script to create an admin user in MongoDB.

## Usage

### Option 1: Using npm script (Recommended)

```bash
# Create admin with default credentials
npm run create-admin

# Create admin with custom email and password
npm run create-admin -- admin@example.com mypassword123

# Create admin with all custom details
npm run create-admin -- admin@example.com mypassword123 John Doe
```

### Option 2: Direct node command

```bash
# Default admin (admin@rootedvoices.com / admin123456)
node src/scripts/createAdmin.js

# Custom email and password
node src/scripts/createAdmin.js admin@example.com mypassword123

# Custom email, password, first name, last name
node src/scripts/createAdmin.js admin@example.com mypassword123 John Doe
```

## Examples

```bash
# Create admin with default credentials
npm run create-admin

# Create admin with custom email
npm run create-admin -- admin@rootedvoices.com SecurePass123!

# Create admin with full details
npm run create-admin -- admin@rootedvoices.com SecurePass123! Admin User
```

## Update Existing User Role

If you want to update an existing user to admin:

```bash
# Using npm script
npm run update-role -- user@example.com admin

# Direct node command
node src/scripts/updateUserRole.js user@example.com admin
```

## Default Credentials

If no arguments are provided:
- **Email**: `admin@rootedvoices.com`
- **Password**: `admin123456`
- **Name**: `Admin User`

⚠️ **Important**: Change the default password after first login!

## What the Script Does

1. Connects to MongoDB using your `.env` configuration
2. Checks if user already exists
3. If exists and is already admin → Shows error
4. If exists but different role → Updates to admin
5. If doesn't exist → Creates new admin user
6. Password is automatically hashed using bcrypt (via User model pre-save hook)

## Environment Variables

Make sure your `.env` file has:

```env
MONGODB_URI=mongodb://localhost:27017/rooted-voices
# or
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/rooted-voices
```

## Troubleshooting

### "User already exists"
- The email is already in use
- Use `update-role` script to change existing user to admin
- Or use a different email

### "Connection failed"
- Check MongoDB is running
- Verify `MONGODB_URI` in `.env` is correct
- Check network/firewall settings

### "Invalid role"
- Role must be: `admin`, `therapist`, or `client`

## Security Notes

1. **Change default password** immediately after first login
2. **Use strong passwords** in production
3. **Don't commit** `.env` file with real credentials
4. **Use environment-specific** admin accounts (dev/staging/prod)

## After Creating Admin

1. Start the admin panel: `cd adminpanel && npm run dev`
2. Login at `http://localhost:5173/login`
3. Use the credentials you created
4. Change password in admin panel (if password change feature exists)

