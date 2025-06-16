from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
import pandas as pd
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'  # Use a secure random key

# Dummy user data (replace with DB later)
users = {
    'admin1': {'password': 'adminpass', 'role': 'admin'},
    'user1': {'password': 'userpass', 'role': 'user'}
}

# ========== ROUTES ==========
@app.route('/')
def login():
    error = request.args.get("auth") == "fail"
    success = request.args.get("auth") == "success"
    role = request.args.get("role") if success else ""
    first_visit = request.args.get("fresh") == "true"

    return render_template('login.html', error=error, login_success=success, login_role=role, first_visit=first_visit)


@app.route('/login', methods=['POST'])
def do_login():
    username = request.form['username'].strip().lower()
    password = request.form['password'].strip()

    user = users.get(username)
    if user and user['password'] == password:
        session['username'] = username
        session['role'] = user['role']

        return redirect(url_for('login', auth="success", role=user['role']))

    return redirect(url_for('login', auth="fail"))


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))





@app.route('/dashboard_admin')
def dashboard_admin():
    if session.get('role') != 'admin':
        return redirect(url_for('login'))
    return render_template('dashboard_admin.html')


@app.route('/dashboard_user')
def dashboard_user():
    if session.get('role') != 'user':
        return redirect(url_for('login'))
    return render_template('dashboard_user.html')


# ========== ADMIN PIE DATA API ==========
@app.route('/get_pie_data')
def get_pie_data():
    if 'role' not in session or session.get('role') != 'admin':
        return jsonify([])

    selected_date = request.args.get('date')
    if not selected_date:
        return jsonify([])

    try:
        pie_df = pd.read_excel('data/pie.xlsx')
        pie_df['DATE_NEW'] = pd.to_datetime(pie_df['DATE_NEW']).dt.date
        filtered = pie_df[pie_df['DATE_NEW'] == pd.to_datetime(selected_date).date()]
        data = filtered[['Time Interval', 'Employee Count']].to_dict(orient='records')
        return jsonify(data)
    except Exception as e:
        print("Error loading pie data:", e)
        return jsonify([])


if __name__ == '__main__':
    app.run(debug=True)
