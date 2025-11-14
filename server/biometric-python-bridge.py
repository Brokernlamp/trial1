#!/usr/bin/env python3
"""
Python bridge for eSSL biometric device using zk library
Called from Node.js to handle device operations
"""

import sys
import json
import time
from datetime import datetime
from zk import ZK, const
from zk.exception import ZKNetworkError, ZKErrorResponse

def connect_device(ip, port, comm_key):
    """Connect to device"""
    zk = ZK(ip, port=port, timeout=30, password=comm_key, force_udp=True)
    return zk.connect()

def sync_access_groups(ip, port, comm_key, members_json):
    """Sync member access groups to device"""
    try:
        conn = connect_device(ip, port, comm_key)
        members = json.loads(members_json)
        
        all_users = conn.get_users()
        user_dict = {str(u.user_id): u for u in all_users}
        
        results = []
        
        for member in members:
            biometric_id = str(member.get("biometricId") or member.get("biometric_id", ""))
            if not biometric_id or biometric_id not in user_dict:
                continue
            
            user = user_dict[biometric_id]
            allowed = member.get("allowed", False)
            group_id = 1 if allowed else 0
            
            try:
                conn.set_user(
                    uid=user.uid,
                    name=user.name or '',
                    privilege=const.USER_DEFAULT,
                    password=user.password or '',
                    group_id=str(group_id),
                    user_id=biometric_id,
                    card=0
                )
                results.append({"userId": biometric_id, "success": True, "allowed": allowed})
            except Exception as e:
                results.append({"userId": biometric_id, "success": False, "error": str(e)})
        
        conn.disconnect()
        return {"success": True, "results": results}
    except Exception as e:
        return {"success": False, "error": str(e)}

def monitor_scans(ip, port, comm_key, unlock_seconds):
    """Monitor scans in real-time (live capture) with auto-reconnect"""
    seen_events = set()
    reconnect_delay = 2
    max_reconnect_delay = 60
    
    print(json.dumps({"type": "status", "message": "Starting biometric monitoring service"}), flush=True)
    
    while True:
        conn = None
        try:
            print(json.dumps({"type": "status", "message": f"Connecting to {ip}:{port}"}), flush=True)
            
            conn = connect_device(ip, port, comm_key)
            
            print(json.dumps({"type": "connected", "ip": ip, "port": port}), flush=True)
            
            # Setup device
            try:
                conn.disable_device()
                time.sleep(0.5)
                conn.enable_device()
            except:
                pass
            
            reconnect_delay = 2  # Reset delay on successful connection
            
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
                
                # Output scan event as JSON
                print(json.dumps({
                    "type": "scan",
                    "userId": uid,
                    "timestamp": ts.isoformat() if ts else datetime.now().isoformat()
                }), flush=True)
        
        except KeyboardInterrupt:
            print(json.dumps({"type": "status", "message": "Service stopped by user"}), flush=True)
            break
        
        except (ZKNetworkError, ZKErrorResponse, Exception) as e:
            error_msg = str(e)
            print(json.dumps({"type": "error", "error": error_msg}), flush=True)
            print(json.dumps({"type": "status", "message": f"Reconnecting in {reconnect_delay} seconds..."}), flush=True)
            time.sleep(reconnect_delay)
            reconnect_delay = min(reconnect_delay * 2, max_reconnect_delay)
        
        finally:
            if conn:
                try:
                    conn.disconnect()
                except:
                    pass

def unlock_door(ip, port, comm_key, seconds):
    """Unlock door relay"""
    try:
        conn = connect_device(ip, port, comm_key)
        conn.unlock(seconds)
        conn.disconnect()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

def test_connection(ip, port, comm_key):
    """Test device connection"""
    try:
        conn = connect_device(ip, port, comm_key)
        conn.disconnect()
        return {"success": True, "connected": True}
    except Exception as e:
        return {"success": False, "connected": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing command"}), flush=True)
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "sync_access_groups":
        ip = sys.argv[2]
        port = int(sys.argv[3])
        comm_key = int(sys.argv[4])
        members_json = sys.argv[5]
        result = sync_access_groups(ip, port, comm_key, members_json)
        print(json.dumps(result), flush=True)
    
    elif command == "monitor_scans":
        ip = sys.argv[2]
        port = int(sys.argv[3])
        comm_key = int(sys.argv[4])
        unlock_seconds = int(sys.argv[5])
        monitor_scans(ip, port, comm_key, unlock_seconds)
    
    elif command == "unlock_door":
        ip = sys.argv[2]
        port = int(sys.argv[3])
        comm_key = int(sys.argv[4])
        seconds = int(sys.argv[5])
        result = unlock_door(ip, port, comm_key, seconds)
        print(json.dumps(result), flush=True)
    
    elif command == "test_connection":
        ip = sys.argv[2]
        port = int(sys.argv[3])
        comm_key = int(sys.argv[4])
        result = test_connection(ip, port, comm_key)
        print(json.dumps(result), flush=True)
    
    else:
        print(json.dumps({"error": f"Unknown command: {command}"}), flush=True)
        sys.exit(1)

