import json
import os
from models import User, Disaster

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
USERS_FILE = os.path.join(DATA_DIR, 'users.json')
DISASTERS_FILE = os.path.join(DATA_DIR, 'disasters.json')

def ensure_data_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

def load_users():
    ensure_data_dir()
    if not os.path.exists(USERS_FILE):
        return []
    with open(USERS_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
        return [User(u['username'], u['password']) for u in data]

def save_users(users):
    ensure_data_dir()
    data = [{'username': u.username, 'password': u.password} for u in users]
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def register_user(username, password):
    users = load_users()
    if any(u.username.lower() == username.lower() for u in users):
        return False, "Username already exists."
    
    from models import User
    users.append(User(username, password))
    save_users(users)
    return True, "Success"

def load_disasters():
    ensure_data_dir()
    if not os.path.exists(DISASTERS_FILE):
        return {}
    with open(DISASTERS_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
        # Store in a dictionary mapped by event_id
        return {d['event_id']: Disaster.from_dict(d) for d in data}

def save_disasters(disasters_dict):
    ensure_data_dir()
    data = [d.to_dict() for d in disasters_dict.values()]
    with open(DISASTERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
