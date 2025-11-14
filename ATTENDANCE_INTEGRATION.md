# GPS-Based Attendance Integration Guide

## Overview
This gym management system includes a GPS-based attendance marking system for members. Members can mark their attendance once per day using a simple login code (no password required) when they are physically present at the gym location.

## Features

### 1. **Unique Login Code System**
- Each member is assigned a unique 6-digit login code during registration
- No password required - simple code-based authentication
- Login codes are stored in the `members` table under the `loginCode` column
- Codes should be alphanumeric for better security (e.g., "A7K9M2")

### 2. **GPS Location Verification**
- Uses browser's native Geolocation API to get member's current location
- Verifies member is within specified radius of gym location
- Default radius: 100 meters (configurable in Settings)
- Calculates distance using Haversine formula for accuracy

### 3. **Once-Per-Day Attendance**
- Members can only mark attendance once per day
- System checks for existing attendance record for current date
- Prevents duplicate check-ins

### 4. **Attendance Data Captured**
- Member ID (linked to members table)
- Check-in timestamp
- GPS coordinates (latitude, longitude)
- Marking method (GPS/manual)

## Implementation Steps

### Backend Setup

1. **Database Schema** (Already configured in `shared/schema.ts`):
```typescript
export const members = pgTable("members", {
  // ... other fields
  loginCode: text("login_code").notNull().unique(),
  lastCheckIn: timestamp("last_check_in"),
});

export const attendance = pgTable("attendance", {
  id: varchar("id").primaryKey(),
  memberId: varchar("member_id").notNull(),
  checkInTime: timestamp("check_in_time").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  markedVia: text("marked_via").notNull().default("gps"),
});
```

2. **API Endpoints to Create** (in `server/routes.ts`):

```typescript
// Member login with code
POST /api/user/login
Body: { loginCode: string }
Response: { success: boolean, member: Member }

// Mark attendance
POST /api/user/attendance
Body: { 
  memberId: string, 
  latitude: number, 
  longitude: number 
}
Response: { success: boolean, message: string }

// Check if already marked today
GET /api/user/attendance/today/:memberId
Response: { hasMarkedToday: boolean, checkInTime?: Date }

// Get member's attendance history
GET /api/user/attendance/history/:memberId
Response: { attendance: Attendance[] }
```

3. **Login Code Generation**:
```typescript
// Function to generate unique 6-digit alphanumeric code
function generateLoginCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
```

4. **Distance Calculation** (already implemented in frontend):
```typescript
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
```

### Frontend Setup

The user attendance page is already created at `/user/attendance`. Members can access it directly.

**User Flow:**
1. Member visits `/user/attendance`
2. Enters their 6-digit login code
3. System requests GPS location permission
4. Member clicks "Mark Attendance"
5. System verifies location is within gym radius
6. Attendance is recorded with GPS coordinates
7. Confirmation shown to member

### Admin Configuration

**Settings Page** (`/settings`) includes:
- GPS verification toggle (enable/disable)
- Gym location coordinates (latitude, longitude)
- Allowed radius in meters
- Operating hours configuration

### Security Considerations

1. **Login Code Security**:
   - Codes are unique per member
   - Rate limiting on login attempts recommended
   - Codes can be regenerated if compromised

2. **GPS Spoofing Prevention**:
   - While GPS can be spoofed, the combination of:
     - Physical presence verification
     - Once-per-day limit
     - Admin monitoring capabilities
   Makes it reasonably secure for gym attendance

3. **Privacy**:
   - GPS coordinates are only captured during check-in
   - Data is used solely for attendance verification
   - Members are informed about GPS usage

### Integration with Physical Devices (Optional Future Enhancement)

For additional security, you can integrate with:
- **QR Code Scanners**: Generate daily QR codes that members scan at reception
- **RFID Cards**: Members tap card at entrance
- **Biometric Devices**: Fingerprint or facial recognition
- **Bluetooth Beacons**: Verify presence via Bluetooth proximity

These can be combined with the GPS system for multi-factor verification.

## Testing

1. **Test Login**:
   - Create test member with login code "TEST01"
   - Visit `/user/attendance`
   - Enter code and verify login

2. **Test GPS Verification**:
   - Mock GPS coordinates in browser DevTools
   - Set coordinates within gym radius
   - Verify attendance can be marked
   - Set coordinates outside radius
   - Verify error message appears

3. **Test Once-Per-Day Limit**:
   - Mark attendance successfully
   - Try marking again same day
   - Verify second attempt is blocked

## Member Onboarding

When adding new members:
1. Generate unique login code automatically
2. Print code on membership card OR send via WhatsApp
3. Instruct member to visit `/user/attendance` URL
4. Demonstrate one-time login and attendance marking
5. Explain GPS permission requirement

## Monitoring & Analytics

Admin dashboard shows:
- Daily check-in counts
- Peak hours heatmap
- Member frequency analysis
- Absent member alerts (7+ days)
- GPS-based attendance vs manual check-ins

## URL for Members

Share this URL with members: `https://your-gym-app.replit.app/user/attendance`

Or create a QR code linking to this URL and display at gym entrance.
