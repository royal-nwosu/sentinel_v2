# Sentinel JSON Auth Build

## 1) app.py additions

```python
from flask import Flask, render_template, request, redirect, url_for, session, flash
import json
import os

app = Flask(__name__)
app.secret_key = 'sentinel-secret-key'

USERS_FILE = 'users.json'


def load_users():
    if not os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'w') as f:
            json.dump([], f)
    with open(USERS_FILE, 'r') as f:
        return json.load(f)


def save_users(users):
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=2)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/register', methods=['POST'])
def register():
    username = request.form.get('register_username', '').strip()
    password = request.form.get('register_password', '').strip()
    confirm = request.form.get('register_confirm_password', '').strip()

    if not username or not password or not confirm:
        flash('Please fill in all registration fields.', 'error')
        return redirect(url_for('index', mode='register'))

    if password != confirm:
        flash('Passwords do not match.', 'error')
        return redirect(url_for('index', mode='register'))

    users = load_users()

    if any(user['username'].lower() == username.lower() for user in users):
        flash('That username already exists.', 'error')
        return redirect(url_for('index', mode='register'))

    users.append({
        'username': username,
        'password': password
    })
    save_users(users)

    flash('Account created successfully. Please log in.', 'success')
    return redirect(url_for('index', mode='login'))


@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username', '').strip()
    password = request.form.get('password', '').strip()

    users = load_users()
    matched_user = next(
        (user for user in users if user['username'].lower() == username.lower() and user['password'] == password),
        None
    )

    if matched_user:
        session['username'] = matched_user['username']
        return redirect(url_for('dashboard'))

    flash('Invalid username or password.', 'error')
    return redirect(url_for('index', mode='login'))


@app.route('/dashboard')
def dashboard():
    if 'username' not in session:
        return redirect(url_for('index'))
    return render_template('dashboard.html', username=session['username'])


@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out.', 'success')
    return redirect(url_for('index', mode='login'))
```

## 2) users.json

Create a file named `users.json` in the same folder as `app.py`:

```json
[
  {
    "username": "admin",
    "password": "admin123"
  }
]
```

## 3) index.html login/register card

```html
<div class="login-card" id="auth-card">
  <div class="auth-header">
    <h1>SENTINEL</h1>
    <p>Monitoring Critical Events</p>
  </div>

  {% with messages = get_flashed_messages(with_categories=true) %}
    {% if messages %}
      {% for category, message in messages %}
        <div class="flash-message {{ category }}">{{ message }}</div>
      {% endfor %}
    {% endif %}
  {% endwith %}

  <div class="auth-panels">
    <form method="POST" action="{{ url_for('login') }}" id="login-form" class="auth-form active">
      <label for="username">Username</label>
      <input type="text" id="username" name="username" required>

      <label for="password">Password</label>
      <input type="password" id="password" name="password" required>

      <button type="submit" class="auth-btn">Login</button>
      <p class="auth-switch">Need Access? <button type="button" id="show-register">Create Account</button></p>
    </form>

    <form method="POST" action="{{ url_for('register') }}" id="register-form" class="auth-form">
      <label for="register_username">Username</label>
      <input type="text" id="register_username" name="register_username" required>

      <label for="register_password">Password</label>
      <input type="password" id="register_password" name="register_password" required>

      <label for="register_confirm_password">Confirm Password</label>
      <input type="password" id="register_confirm_password" name="register_confirm_password" required>

      <button type="submit" class="auth-btn">Create Account</button>
      <p class="auth-switch">Already have access? <button type="button" id="show-login">Back to Login</button></p>
    </form>
  </div>
</div>
```

## 4) CSS for card/forms

```css
.login-card {
  width: min(440px, 92vw);
  padding: 28px;
  border-radius: 22px;
  background: rgba(10, 26, 62, 0.68);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(111, 160, 255, 0.14);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.32);
  position: relative;
  z-index: 10;
}

.auth-header {
  text-align: center;
  margin-bottom: 18px;
}

.auth-header h1 {
  margin: 0;
  font-size: 3rem;
  font-weight: 300;
  letter-spacing: 0.04em;
  color: #d8efdc;
}

.auth-header p {
  margin: 8px 0 0;
  color: #8fb0d8;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.auth-form {
  display: none;
  flex-direction: column;
  gap: 10px;
}

.auth-form.active {
  display: flex;
}

.auth-form label {
  color: #a7bddf;
  font-size: 0.92rem;
}

.auth-form input {
  height: 46px;
  border-radius: 12px;
  border: 1px solid rgba(122, 170, 255, 0.16);
  background: rgba(4, 13, 30, 0.95);
  color: white;
  padding: 0 14px;
  outline: none;
}

.auth-form input:focus {
  border-color: rgba(101, 168, 255, 0.42);
  box-shadow: 0 0 0 3px rgba(79, 144, 255, 0.12);
}

.auth-btn {
  margin-top: 8px;
  height: 46px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(90deg, #558dff, #61b6ff);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.auth-switch {
  margin: 10px 0 0;
  text-align: center;
  color: #92a7cc;
  font-size: 0.92rem;
}

.auth-switch button {
  background: none;
  border: none;
  color: #9cd3ff;
  font-weight: 600;
  cursor: pointer;
}

.flash-message {
  margin-bottom: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 0.9rem;
}

.flash-message.success {
  background: rgba(31, 177, 106, 0.16);
  border: 1px solid rgba(31, 177, 106, 0.22);
  color: #90e0b2;
}

.flash-message.error {
  background: rgba(255, 90, 115, 0.12);
  border: 1px solid rgba(255, 90, 115, 0.22);
  color: #ff9cad;
}
```

## 5) JavaScript toggle

```html
<script>
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const showRegister = document.getElementById('show-register');
  const showLogin = document.getElementById('show-login');

  function setAuthMode(mode) {
    if (mode === 'register') {
      loginForm.classList.remove('active');
      registerForm.classList.add('active');
    } else {
      registerForm.classList.remove('active');
      loginForm.classList.add('active');
    }
  }

  showRegister.addEventListener('click', () => setAuthMode('register'));
  showLogin.addEventListener('click', () => setAuthMode('login'));

  const currentMode = new URLSearchParams(window.location.search).get('mode');
  setAuthMode(currentMode === 'register' ? 'register' : 'login');
</script>
```
