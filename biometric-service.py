#!/usr/bin/env python3
"""
Standalone Biometric Service
- Connects to SQLite database directly
- Queries members to determine allowed/denied users
- Configures device access groups (green/red feedback)
- Monitors scans via live_capture
- Unlocks door for allowed users
- Sends attendance events to Node.js API via HTTP
"""

import time
import datetime
import json
import sys
import os
import sqlite3
import requests
from pathlib import Path
from zk import ZK, const
from zk.exception import ZKNetworkError, ZKErrorResponse

# Configuration
DEVICE_IP = os.getenv("BIOMETRIC_IP", "192.168.1.81")
PORT = int(os.getenv("BIOMETRIC_PORT", "4370"))
COMM_KEY = int(os.getenv("BIOMETRIC_COMM_KEY", "0"))
UNLOCK_SECS = int(os.getenv("BIOMETRIC_UNLOCK_SECS", "3"))
FORCE_UDP = True

# Node.js API endpoint for attendance
API_URL = os.getenv("API_URL", "http://localhost:3000")
ATTENDANCE_ENDPOINT = f"{API_URL}/api/biometric/attendance-event"

# Database path (same as Node.js app uses)
def get_db_path():
    """Get the SQLite database path"""
    if os.name == 'nt':  # Windows
        base = os.getenv("GYM_APPDATA_DIR") or os.path.join(os.path.expanduser("~"), ".gymadmindashboard")
    else:  # Linux/Mac
        base = os.getenv("GYM_APPDATA_DIR") or os.path.join(os.path.expanduser("~"), ".gymadmindashboard")
    
    db_file = os.path.join(base, "data.db")
    return db_file

def get_members_from_db():
    """
    Query database to get allowed and denied members
    Returns: (allowed_user_ids, denied_user_ids, member_map)
    """
    db_path = get_db_path()
    
    if not os.path.exists(db_path):
        print(f"⚠️ Database not found at: {db_path}")
        return ([], [], {})
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get all members with biometric_id
        cursor.execute("""
            SELECT id, name, biometric_id, status, start_date, expiry_date, payment_status
            FROM members
            WHERE biometric_id IS NOT NULL 
            AND biometric_id != ''
            AND (deleted_at IS NULL OR deleted_at = '')
        """)
        
        rows = cursor.fetchall()
        conn.close()
        
        allowed_users = []
        denied_users = []
        member_map = {}
        
        now = datetime.datetime.now()
        
        for row in rows:
            biometric_id = str(row['biometric_id']).strip()
            if not biometric_id:
                continue
            
            member_map[biometric_id] = {
                'id': row['id'],
                'name': row['name'],
                'status': row['status'],
                'start_date': row['start_date'],
                'expiry_date': row['expiry_date'],
                'payment_status': row['payment_status']
            }
            
            # Check if member is allowed
            status_ok = row['status'] == 'active'
            
            start_ok = True
            if row['start_date']:
                try:
                    start_date = datetime.datetime.fromisoformat(row['start_date'].replace('Z', '+00:00'))
                    start_ok = now >= start_date.replace(tzinfo=None) if start_date.tzinfo else now >= start_date
                except:
                    pass
            
            end_ok = True
            if row['expiry_date']:
                try:
                    expiry_date = datetime.datetime.fromisoformat(row['expiry_date'].replace('Z', '+00:00'))
                    end_ok = now <= expiry_date.replace(tzinfo=None) if expiry_date.tzinfo else now <= expiry_date
                except:
                    pass
            
            payment_ok = row['payment_status'] not in ['pending', 'overdue']
            
            allowed = status_ok and start_ok and end_ok and payment_ok
            
            if allowed:
                allowed_users.append(biometric_id)
            else:
                denied_users.append(biometric_id)
        
        print(f"📊 Database query: {len(allowed_users)} allowed, {len(denied_users)} denied, {len(member_map)} total")
        return (allowed_users, denied_users, member_map)
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        return ([], [], {})

def configure_device_access_groups(conn, allowed_users, denied_users):
    """
    Set user access groups on device so it shows green/red automatically.
    """
    print("\n=== Configuring device-side access control ===")
    
    try:
        all_users = conn.get_users()
        user_dict = {str(u.user_id): u for u in all_users}
        
        print(f"Found {len(all_users)} users on device\n")
        
        # Configure ALLOWED users - set to group 1 (normal access)
        for uid in allowed_users:
            if uid in user_dict:
                user = user_dict[uid]
                print(f"✓ Setting user {uid} as ALLOWED (group 1)")
                try:
                    conn.set_user(
                        uid=user.uid,
                        name=user.name or '',
                        privilege=const.USER_DEFAULT,
                        password=user.password or '',
                        group_id='1',  # Normal access group
                        user_id=uid,
                        card=0
                    )
                except Exception as e:
                    print(f"  Warning: {e}")
        
        # Configure DENIED users - set to group 0 (no access)
        for uid in denied_users:
            if uid in user_dict:
                user = user_dict[uid]
                print(f"✗ Setting user {uid} as DENIED (group 0)")
                try:
                    conn.set_user(
                        uid=user.uid,
                        name=user.name or '',
                        privilege=const.USER_DEFAULT,
                        password=user.password or '',
                        group_id='0',  # No access group
                        user_id=uid,
                        card=0
                    )
                except Exception as e:
                    print(f"  Warning: {e}")
        
        print("\n✓ Device access control configured")
        print("Device will now show:")
        print("  - GREEN tick + 'Thank You' for allowed users")
        print("  - RED X + 'Access Denied' for denied users\n")
        
    except Exception as e:
        print(f"✗ Failed to configure access: {e}\n")

def send_attendance_event(user_id, member_id, member_name, allowed, reason, timestamp):
    """
    Send attendance event to Node.js API
    """
    try:
        payload = {
            "biometricId": user_id,
            "memberId": member_id,
            "memberName": member_name,
            "allowed": allowed,
            "reason": reason,
            "timestamp": timestamp.isoformat() if isinstance(timestamp, datetime.datetime) else timestamp
        }
        
        response = requests.post(ATTENDANCE_ENDPOINT, json=payload, timeout=2)
        if response.status_code == 200:
            print(f"         ✓ Attendance logged in software")
        else:
            print(f"         ⚠️ API returned {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"         ⚠️ Failed to send to API: {e}")
    except Exception as e:
        print(f"         ⚠️ Error: {e}")

def process_scan(conn, uid, timestamp, allowed_users, denied_users, member_map):
    """
    Process scan - device already showed green/red.
    We unlock relay for allowed users and notify Node.js API.
    """
    now = datetime.datetime.now()
    time_str = now.strftime("%Y-%m-%d %H:%M:%S")
    
    member_info = member_map.get(uid, {})
    member_id = member_info.get('id')
    member_name = member_info.get('name', f'User {uid}')
    
    if uid in allowed_users:
        print(f"[{time_str}] ✓ ALLOWED user {uid} ({member_name})")
        print(f"         Device showed: GREEN tick + 'Thank You'")
        print(f"         Unlocking relay for {UNLOCK_SECS}s...")
        
        try:
            conn.unlock(UNLOCK_SECS)
            print(f"         ✓ Door unlocked")
            
            # Send attendance event to Node.js API
            send_attendance_event(uid, member_id, member_name, True, "allowed", timestamp or now)
            
        except Exception as e:
            print(f"         ✗ Relay failed: {e}")
            send_attendance_event(uid, member_id, member_name, False, "relay_error", timestamp or now)
    
    elif uid in denied_users:
        print(f"[{time_str}] ✗ DENIED user {uid} ({member_name})")
        print(f"         Device showed: RED X + 'Access Denied'")
        print(f"         Relay remains LOCKED")
        
        # Still log the attempt
        reason = "denied"
        if member_info:
            if member_info.get('status') != 'active':
                reason = "inactive"
            elif member_info.get('payment_status') in ['pending', 'overdue']:
                reason = f"payment_{member_info.get('payment_status')}"
            else:
                reason = "expired"
        
        send_attendance_event(uid, member_id, member_name, False, reason, timestamp or now)
    
    else:
        print(f"[{time_str}] ? UNKNOWN user {uid}")
        print(f"         Device showed: RED X (user not in system)")
        send_attendance_event(uid, None, None, False, "unknown_user", timestamp or now)

def connect_device():
    print(f"Connecting to {DEVICE_IP}:{PORT}...")
    zk = ZK(DEVICE_IP, port=PORT, timeout=30, password=COMM_KEY, force_udp=FORCE_UDP)
    conn = zk.connect()
    print("✓ Connected\n")
    return conn

def main():
    seen_events = set()
    reconnect_delay = 2
    device_configured = False
    last_db_refresh = datetime.datetime.now()
    db_refresh_interval = 300  # Refresh member list every 5 minutes
    
    # Initial member list
    allowed_users, denied_users, member_map = get_members_from_db()
    
    print("=" * 60)
    print("Gym Admin - Biometric Access Control Service")
    print("=" * 60)
    print(f"Device: {DEVICE_IP}:{PORT}")
    print(f"Database: {get_db_path()}")
    print(f"API: {ATTENDANCE_ENDPOINT}")
    print(f"Allowed users: {len(allowed_users)}")
    print(f"Denied users: {len(denied_users)}")
    print("=" * 60)
    print()
    
    while True:
        conn = None
        try:
            conn = connect_device()
            
            # Refresh member list periodically
            if (datetime.datetime.now() - last_db_refresh).total_seconds() > db_refresh_interval:
                print("\n🔄 Refreshing member list from database...")
                allowed_users, denied_users, member_map = get_members_from_db()
                device_configured = False  # Reconfigure device with new list
                last_db_refresh = datetime.datetime.now()
            
            # Disable device during setup
            try:
                conn.disable_device()
                print("✓ Device locked for setup")
            except:
                pass
            
            # CRITICAL: Configure access groups (when list changes)
            if not device_configured:
                configure_device_access_groups(conn, allowed_users, denied_users)
                device_configured = True
            
            # Re-enable
            try:
                conn.enable_device()
                print("✓ Device ready\n")
            except:
                pass
            
            print("=" * 60)
            print("Monitoring scans...")
            print("Device will show green/red automatically")
            print("Press Ctrl+C to exit")
            print("=" * 60)
            print()
            
            reconnect_delay = 2
            
            # Real-time monitoring
            for attendance in conn.live_capture():
                if attendance is None:
                    continue
                
                uid = str(getattr(attendance, "user_id", ""))
                ts = getattr(attendance, "timestamp", None)
                
                if not uid:
                    continue
                
                event_key = f"{uid}-{ts}"
                if event_key in seen_events:
                    continue
                seen_events.add(event_key)
                
                if len(seen_events) > 500:
                    oldest = list(seen_events)[0]
                    seen_events.remove(oldest)
                
                process_scan(conn, uid, ts, allowed_users, denied_users, member_map)
        
        except KeyboardInterrupt:
            print("\n\n✓ Exiting")
            break
        
        except (ZKNetworkError, ZKErrorResponse, Exception) as e:
            print(f"\n✗ Error: {e}")
            print(f"Retrying in {reconnect_delay}s...")
            time.sleep(reconnect_delay)
            reconnect_delay = min(reconnect_delay * 2, 60)
        
        finally:
            if conn:
                try:
                    conn.disconnect()
                except:
                    pass

if __name__ == "__main__":
    main()

