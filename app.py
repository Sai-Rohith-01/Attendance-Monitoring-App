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

    try:
        # ✅ Use paired.xlsx for KPI data
        df = pd.read_excel('data/paired.xlsx')
        df['DATE_NEW'] = pd.to_datetime(df['DATE_NEW']).dt.date
        today = datetime.today().date()

        today_df = df[df['DATE_NEW'] == today].copy()

        # Total Employees Today
        total_employees = today_df['Userid'].nunique()

        # Average Login Time
        today_df['IN'] = pd.to_datetime(today_df['IN'], errors='coerce')
        avg_login_time = today_df['IN'].dropna().mean()
        avg_login = avg_login_time.strftime('%H:%M') if pd.notnull(avg_login_time) else "N/A"

        # Mismatches Today
        today_df['Mismatch_Flag'] = today_df['Mismatch_Flag'].astype(str).str.upper()
        mismatches_today = today_df[today_df['Mismatch_Flag'].str.startswith('UNMATCHED')].shape[0]

    except Exception as e:
        print("Error loading KPI data:", e)
        total_employees = 0
        avg_login = "N/A"
        mismatches_today = 0

    return render_template(
        'dashboard_admin.html',
        total_employees=total_employees,
        avg_login=avg_login,
        mismatches_today=mismatches_today
    )

@app.route('/dashboard_user')
def dashboard_user():
    if session.get('role') != 'user':
        return redirect(url_for('login'))
    return render_template('dashboard_user.html')

# ========== PIE CHART API ==========

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
    
# ========== KPI CARDS API ==========    

@app.route('/get_kpi_data')
def get_kpi_data():
    if 'role' not in session or session.get('role') != 'admin':
        return jsonify({})

    selected_date = request.args.get('date')
    if not selected_date:
        return jsonify({})

    try:
        df = pd.read_excel('data/paired.xlsx')
        df['DATE_NEW'] = pd.to_datetime(df['DATE_NEW']).dt.date
        selected = pd.to_datetime(selected_date).date()
        today_df = df[df['DATE_NEW'] == selected].copy()

        # Total Employees
        total_employees = int(today_df['Userid'].nunique())

        # Mode Login Time
        today_df['IN'] = pd.to_datetime(today_df['IN'], errors='coerce')
        mode_login_time = today_df['IN'].mode()[0] if not today_df['IN'].mode().empty else None
        avg_login = mode_login_time.strftime('%H:%M') if mode_login_time else "N/A"

        # Mismatches
        today_df['Mismatch_Flag'] = today_df['Mismatch_Flag'].astype(str).str.upper()
        mismatches_today = int(today_df[today_df['Mismatch_Flag'].str.startswith('UNMATCHED')].shape[0])

        # Earliest login & User
        earliest_login_row = today_df[today_df['IN'].notna()].sort_values(by='IN').head(1)
        earliest_login = earliest_login_row['IN'].iloc[0] if not earliest_login_row.empty else None
        earliest_user = earliest_login_row['Userid'].iloc[0] if not earliest_login_row.empty else "N/A"

        # Last logout & User
        today_df['OUT'] = pd.to_datetime(today_df['OUT'], errors='coerce')
        last_logout_row = today_df[today_df['OUT'].notna()].sort_values(by='OUT', ascending=False).head(1)
        last_logout = last_logout_row['OUT'].iloc[0] if not last_logout_row.empty else None
        last_user = last_logout_row['Userid'].iloc[0] if not last_logout_row.empty else "N/A"

        # Anomaly detection
        anomaly_detected = False
        if earliest_login and earliest_login.time() < datetime.strptime("06:00", "%H:%M").time():
            anomaly_detected = True
        if last_logout and last_logout.time() > datetime.strptime("22:00", "%H:%M").time():
            anomaly_detected = True

        return jsonify({
            'total_employees': total_employees,
            'avg_login': avg_login,
            'mismatches_today': mismatches_today,
            'earliest_login': earliest_login.strftime('%H:%M') if earliest_login else "N/A",
            'earliest_user': str(earliest_user),
            'last_logout': last_logout.strftime('%H:%M') if last_logout else "N/A",
            'last_user': str(last_user),
            'anomaly_detected': anomaly_detected
        })

    except Exception as e:
        print("Error loading KPI data:", e)
        return jsonify({})




# ========== MAIN ===================

if __name__ == '__main__':
    app.run(debug=True)
