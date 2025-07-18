from flask import Blueprint, Flask, render_template, request, redirect, url_for, session, flash, jsonify
from collections import defaultdict
import numpy as np
import pandas as pd
import os
import pickle
from datetime import datetime, timedelta
from sklearn.preprocessing import MinMaxScaler
from pandas.api.types import CategoricalDtype
import time
import calendar

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'

# ========== USER AUTH DATA ==========
users = {
    'admin1': {'password': 'admin123', 'role': 'admin'},
    'user1': {'password': 'userpass123', 'role': 'user'}
}

# ==================== CONNECTION ==========================
from database import get_connection
import hashlib

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(input_password, stored_hash):
    return hash_password(input_password) == stored_hash


# ======================================= LOGIN & LOGOUT ======================================

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

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM employee_logins WHERE userid = ?", (username,))
        user = cursor.fetchone()
        conn.close()

        if user and verify_password(password, user['password_hash']):
            session['userid'] = user['userid']
            session['username'] = username
            session['role'] = user['role'] if user['role'] else 'user'

            # Optional: Insert login record
            try:
                audit_conn = get_connection()
                audit_cursor = audit_conn.cursor()
                audit_cursor.execute("INSERT INTO login_audit (userid, login_time) VALUES (?, datetime('now'))", (username,))
                audit_conn.commit()
                audit_conn.close()
            except:
                pass  # Skip logging if DB not available

            return redirect(url_for('login', auth="success", role=session['role']))

    except Exception as e:
        print("DB error:", e)
        # Fall back to hardcoded users if DB fails
        user = users.get(username)
        if user and user['password'] == password:
            session['username'] = username
            session['role'] = user['role']
            return redirect(url_for('login', auth="success", role=user['role']))

    return redirect(url_for('login', auth="fail"))





# ==================================== ADMIN DASHBOARD ROUTE =========================================

@app.route('/dashboard_admin')
def dashboard_admin():
    if session.get('role') != 'admin':
        return redirect(url_for('login'))

    userid = session.get('username')

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM employee_logins WHERE userid = ?", (userid,))
    user = cursor.fetchone()
    user_name = user['name'] if user else 'Admin'
    conn.close()

    # Load today's stats
    today = datetime.today().date()
    today_df = paired_df[paired_df['DATE_NEW'] == today].copy()
    total_employees = today_df['Userid'].nunique()

    today_df['IN'] = pd.to_datetime(today_df['IN'], errors='coerce')
    avg_login_time = today_df['IN'].dropna().mean()
    avg_login = avg_login_time.strftime('%H:%M') if pd.notnull(avg_login_time) else "N/A"

    mismatches_today = 0  # Placeholder

    return render_template(
        'dashboard_admin.html',
        total_employees=total_employees,
        avg_login=avg_login,
        mismatches_today=mismatches_today,
        user_name=user_name
    )




@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# ================= Login History ========================
@app.route('/login_history')
def login_history():
    if session.get('role') != 'admin':
        return redirect(url_for('login'))

    conn = get_connection()
    cursor = conn.cursor()

    # Auto-delete logs older than 5 mins (FOR TESTING)
    cursor.execute("DELETE FROM login_audit WHERE login_time < datetime('now', '-5 minutes')")

    # Load only recent logs
    cursor.execute("SELECT * FROM login_audit ORDER BY login_time DESC")

    records = cursor.fetchall()
    conn.commit()
    conn.close()

    return render_template("login_history.html", records=records)





# ========== CACHE FILE ==========
CACHE_FILE = "preprocessed_data.pkl"

# ========== GLOBAL DATAFRAMES ==========
df = paired_df = clean_paired_df = user_date_grid = None
daily_summary =daily_attendance_summary= weekday_trends = user_stats = final_scores = top_fair_users = None


# ========== DATA PREPROCESSING ==========
def preprocess_data():
    global df, paired_df, clean_paired_df, user_date_grid, daily_summary,daily_attendance_summary, weekday_trends,user_stats, final_scores, top_fair_users

    start_time = time.time()

    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, 'rb') as f:
            (df, paired_df, clean_paired_df, user_date_grid, daily_summary, weekday_trends,user_stats, final_scores, top_fair_users,daily_attendance_summary) = pickle.load(f)
        print("✅ Loaded data from cache in", round(time.time() - start_time, 2), "seconds.")
        return

    print("⚙️ Preprocessing started...")

    df = pd.read_excel("data/dummy_data.xlsx")
    df['DATETIME'] = pd.to_datetime(df['DATE_NEW'] + ' ' + df['PUNCHTIME'], format='%d-%b-%y %H:%M')
    df['DATE_NEW'] = pd.to_datetime(df['DATE_NEW'], format='%d-%b-%y', errors='coerce')
    df = df.sort_values(by=['Userid', 'DATETIME']).reset_index(drop=True)

    def deduplicate_punches(group, userid, date, threshold_minutes=2):
        group = group.sort_values(by='DATETIME').reset_index(drop=True)
        deduped = [group.iloc[0]]
        for i in range(1, len(group)):
            current, previous = group.iloc[i], deduped[-1]
            if (current['IN_OUT'] != previous['IN_OUT']) or \
               ((current['DATETIME'] - previous['DATETIME']).total_seconds() / 60 > threshold_minutes):
                deduped.append(current)
        result = pd.DataFrame(deduped)
        result['Userid'], result['DATE_NEW'] = userid, date
        return result

    result_list = [deduplicate_punches(group, uid, date)
                   for (uid, date), group in df.groupby(['Userid', 'DATE_NEW'], sort=False)]
    df = pd.concat(result_list, ignore_index=True)

    paired_rows = []
    for (userid, date), group in df.groupby(['Userid', 'DATE_NEW']):
        group = group.sort_values(by='DATETIME')
        in_stack = []
        for _, row in group.iterrows():
            if row['IN_OUT'] == 0:
                in_stack.append(row['DATETIME'])
            elif row['IN_OUT'] == 1:
                if in_stack:
                    in_time = in_stack.pop(0)
                    out_time = row['DATETIME']
                    if out_time < in_time:
                        out_time += pd.Timedelta(days=1)
                    duration = (out_time - in_time).total_seconds() / 3600
                    paired_rows.append({
                        'Userid': userid, 'DATE_NEW': date, 'IN': in_time, 'OUT': out_time,
                        'Duration': duration if duration > 0 else None,
                        'Mismatch_Flag': 'OK' if duration > 0 else 'Invalid_Duration'
                    })
                else:
                    paired_rows.append({
                        'Userid': userid, 'DATE_NEW': date, 'IN': None, 'OUT': row['DATETIME'],
                        'Duration': None, 'Mismatch_Flag': 'Unmatched_OUT'
                    })
        for in_time in in_stack:
            paired_rows.append({
                'Userid': userid, 'DATE_NEW': date, 'IN': in_time, 'OUT': None,
                'Duration': None, 'Mismatch_Flag': 'Unmatched_IN'
            })

    paired_df = pd.DataFrame(paired_rows)
    clean_paired_df = paired_df[paired_df['Mismatch_Flag'] == 'OK'].copy()
    clean_paired_df.dropna(subset=['IN', 'OUT'], inplace=True)
    clean_paired_df = clean_paired_df[clean_paired_df['OUT'] >= clean_paired_df['IN']]
    daily_summary = clean_paired_df.groupby(['Userid', 'DATE_NEW']).agg(
        Presence_Hours=('Duration', 'sum'),
        Punch_Count=('Duration', 'count')
    ).reset_index()

    MAX_HOURS = 12
    daily_summary['Presence_Hours_Capped'] = daily_summary['Presence_Hours'].clip(upper=MAX_HOURS)
    daily_summary['Flag_Excessive_Hours'] = daily_summary['Presence_Hours'] > MAX_HOURS

    final_scores = daily_summary.groupby('Userid')['Presence_Hours_Capped'].mean().reset_index()
    final_scores.rename(columns={'Presence_Hours_Capped': 'Avg_Hours_Capped'}, inplace=True)
    final_scores = final_scores.sort_values('Avg_Hours_Capped', ascending=False)

    daily_summary['DATE_SORT'] = pd.to_datetime(daily_summary['DATE_NEW'])
    daily_summary = daily_summary[~daily_summary['DATE_SORT'].dt.day_name().isin(['Saturday', 'Sunday'])]
    daily_summary['DayOfWeek'] = daily_summary['DATE_SORT'].dt.day_name()
    daily_summary['Week'] = daily_summary['DATE_SORT'].dt.isocalendar().week
    daily_summary['Month'] = daily_summary['DATE_SORT'].dt.month_name()

    days_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    cat_type = CategoricalDtype(categories=days_order, ordered=True)
    daily_summary['DayOfWeek'] = daily_summary['DayOfWeek'].astype(cat_type)

    # Convert Month from name to number (e.g. 'January' -> 1)
    month_name_to_num = {month: i for i, month in enumerate(calendar.month_name) if month}
    daily_summary['Month'] = daily_summary['Month'].map(month_name_to_num)

    print("✅ Month column sample:", daily_summary['Month'].unique()[:5])

    # One-time setup after loading daily_summary
    daily_summary["Month"] = pd.to_datetime(daily_summary["DATE_NEW"]).dt.to_period("M").astype(str)
    
    
    # ----- Step 1: Generate all valid working dates -----
    # Modify to skip weekends if needed (optional)
    full_working_dates = pd.date_range(start='2025-01-01', end='2025-05-27', freq='B')
    working_dates_df = pd.DataFrame({'DATE_NEW': full_working_dates})
    
    # ----- Step 2: Get unique UserIDs from clean_paired_df -----
    unique_users_df = clean_paired_df[['Userid']].drop_duplicates()
    unique_users_df['key'] = 1
    working_dates_df['key'] = 1
    
    # ----- Step 3: Create full User-Date grid -----
    user_date_grid = pd.merge(unique_users_df, working_dates_df, on='key').drop(columns='key')
    
    # ----- Step 4: Tag 'P' for present, 'A' for absent -----
    present_df = clean_paired_df[['Userid', 'DATE_NEW']].drop_duplicates()
    present_df['Status'] = 'P'
    
    # Left join to mark status
    user_date_grid = pd.merge(user_date_grid, present_df, on=['Userid', 'DATE_NEW'], how='left')
    user_date_grid['Status'] = user_date_grid['Status'].fillna('A')
    
    # ----- Step 5 (optional): Get absence count per user -----
    user_absence_counts = user_date_grid[user_date_grid['Status'] == 'A'].groupby('Userid').size()



    

    daily_attendance_summary = daily_summary.groupby('DATE_NEW')['Userid'].nunique().reset_index()
    daily_attendance_summary.rename(columns={'Userid': 'Present'}, inplace=True)

    weekday_trends = daily_summary.groupby(['Userid', 'DayOfWeek'], observed=True).agg(
        Total_Hours=('Presence_Hours', 'sum'),
        Days_Worked=('Presence_Hours', 'count')
    ).reset_index()
    weekday_trends['Avg_Hours'] = (weekday_trends['Total_Hours'] / weekday_trends['Days_Worked']).round(2)
    weekday_trends = weekday_trends[['Userid', 'DayOfWeek', 'Days_Worked', 'Total_Hours', 'Avg_Hours']]

    user_stats = daily_summary.groupby('Userid').agg(
        Total_Hours=('Presence_Hours', 'sum'),
        Days_Worked=('Presence_Hours', 'count'),
        Std_Hours=('Presence_Hours', 'std')
    ).reset_index()
    user_stats['Avg_Hours'] = user_stats['Total_Hours'] / user_stats['Days_Worked']
    user_stats['Std_Hours'] = user_stats['Std_Hours'].fillna(0)

    scaler = MinMaxScaler()
    user_stats[['Avg_Hours_Norm', 'Std_Hours_Norm', 'Days_Worked_Norm']] = scaler.fit_transform(
        user_stats[['Avg_Hours', 'Std_Hours', 'Days_Worked']]
    )
    user_stats['Consistency_Score'] = 1 - user_stats['Std_Hours_Norm']
    user_stats['Final_Score'] = (
        0.4 * user_stats['Avg_Hours_Norm'] +
        0.4 * user_stats['Consistency_Score'] +
        0.2 * user_stats['Days_Worked_Norm']
    )
    top_fair_users = user_stats.sort_values('Final_Score', ascending=False).head(10).round(2)

    with open(CACHE_FILE, 'wb') as f:
        pickle.dump((df, paired_df, clean_paired_df, user_date_grid, daily_summary, weekday_trends,user_stats, final_scores, top_fair_users,daily_attendance_summary), f)

    print("✅ Preprocessing done in", round(time.time() - start_time, 2), "seconds.")


preprocess_data()


# ========== ROUTE TO CLEAR CACHE ==========
@app.route('/clear_cache')
def clear_cache():
    if os.path.exists(CACHE_FILE):
        os.remove(CACHE_FILE)
        return "✅ Cache cleared. Restart the server or refresh to trigger preprocessing."
    return "⚠️ No cache file found."





# ========================================== DAILY KPI ROUTE ==================================
@app.route('/get_kpi_data')
def get_kpi_data():
    if 'role' not in session or session.get('role') != 'admin':
        return jsonify({})

    selected_date = request.args.get('date')
    if not selected_date:
        return jsonify({})

    try:
        # Normalize selected date
        selected = pd.to_datetime(selected_date).normalize()

        # Normalize DATE_NEW and filter
        filtered_df = paired_df.copy()
        filtered_df['DATE_NEW'] = pd.to_datetime(filtered_df['DATE_NEW']).dt.normalize()
        today_df = filtered_df[filtered_df['DATE_NEW'] == selected].copy()
        if today_df.empty:
            return jsonify({'error': 'No data found for the selected date.'})

        if today_df.empty:
            return jsonify({
                'total_employees': 0,
                'avg_login': "N/A",
                'mismatches_today': 0,
                'earliest_login': "N/A",
                'earliest_user': "N/A",
                'last_logout': "N/A",
                'last_user': "N/A",
                'anomaly_detected': False,
                'early_login_users': [],
                'late_logout_users': [],
                'early_login_count': 0,
                'late_logout_count': 0
            })

        # Convert times
        today_df['IN'] = pd.to_datetime(today_df['IN'], errors='coerce')
        today_df['OUT'] = pd.to_datetime(today_df['OUT'], errors='coerce')

        total_employees = int(today_df['Userid'].nunique())

        mode_login_time = today_df['IN'].mode()[0] if not today_df['IN'].mode().empty else None
        avg_login = mode_login_time.strftime('%H:%M') if mode_login_time else "N/A"

        earliest_login_row = today_df[today_df['IN'].notna()].sort_values(by='IN').head(1)
        earliest_login = earliest_login_row['IN'].iloc[0] if not earliest_login_row.empty else None
        earliest_user = earliest_login_row['Userid'].iloc[0] if not earliest_login_row.empty else "N/A"

        last_logout_row = today_df[today_df['OUT'].notna()].sort_values(by='OUT', ascending=False).head(1)
        last_logout = last_logout_row['OUT'].iloc[0] if not last_logout_row.empty else None
        last_user = last_logout_row['Userid'].iloc[0] if not last_logout_row.empty else "N/A"

        early_login_cutoff = datetime.strptime("06:00", "%H:%M").time()
        late_logout_cutoff = datetime.strptime("22:00", "%H:%M").time()

        early_logins_df = today_df[today_df['IN'].dt.time < early_login_cutoff]
        late_logouts_df = today_df[today_df['OUT'].dt.time > late_logout_cutoff]

        early_login_users = early_logins_df['Userid'].dropna().unique().tolist()
        late_logout_users = late_logouts_df['Userid'].dropna().unique().tolist()

        anomaly_detected = bool(early_login_users or late_logout_users)

        response = {
            'total_employees': total_employees,
            'avg_login': avg_login,
            'mismatches_today': int(today_df[today_df['Mismatch_Flag'] != 'OK'].shape[0]),
            'earliest_login': earliest_login.strftime('%H:%M') if earliest_login else "N/A",
            'earliest_user': str(earliest_user),
            'last_logout': last_logout.strftime('%H:%M') if last_logout else "N/A",
            'last_user': str(last_user),
            'anomaly_detected': anomaly_detected,
            'early_login_users': early_login_users,
            'late_logout_users': late_logout_users,
            'early_login_count': len(early_login_users),
            'late_logout_count': len(late_logout_users)
        }

        
        return jsonify(response)

    except Exception as e:
        print("Error loading KPI data:", e)
        return jsonify({'error': 'Failed to fetch KPI data.'})
    
    print("✅ /get_kpi_data route called")

    
    
@app.route('/get_weekly_kpi_data')
def get_weekly_kpi_data():
    if 'role' not in session or session.get('role') != 'admin':
        return jsonify({})

    selected_date_str = request.args.get('date')
    if not selected_date_str:
        return jsonify({})

    try:
        selected_date = pd.to_datetime(selected_date_str)
        start_of_week = selected_date - pd.to_timedelta(selected_date.weekday(), unit='D')  # Monday
        end_of_week = start_of_week + pd.Timedelta(days=6)  # Sunday

        print("📆 Selected Date:", selected_date)
        print("📊 Start of Week:", start_of_week, "| End of Week:", end_of_week)

        total_users = df['Userid'].nunique()

        # Step 1: Create daily attendance count from daily_summary
        daily_attendance_summary = (
            daily_summary.groupby('DATE_NEW')['Userid']
            .nunique()
            .reset_index()
            .rename(columns={'Userid': 'Present'})
        )

        # Step 2: Filter for the current week
        week_data = daily_attendance_summary[
            (daily_attendance_summary['DATE_NEW'] >= start_of_week) &
            (daily_attendance_summary['DATE_NEW'] <= end_of_week)
        ].copy()
        if week_data.empty:
            return jsonify({'error': 'No data found for the selected week.'})

        print("✅ Week Data Rows:", len(week_data))

        # Step 3: Compute attendance by day
        attendance_by_day = []
        for _, row in week_data.iterrows():
            day_name = row['DATE_NEW'].day_name()
            present_count = row['Present']
            attendance_percent = (present_count / total_users) * 100
            attendance_by_day.append({
                'day': day_name,
                'percentage': round(attendance_percent, 2)
            })

        average_attendance_percent = round(
            sum(item['percentage'] for item in attendance_by_day) / len(attendance_by_day), 2
        ) if attendance_by_day else 0.0

        # Step 4: Punctuality analysis
        clean_paired_df['DATE_NEW'] = pd.to_datetime(clean_paired_df['DATE_NEW'])
        week_punchins = clean_paired_df[
            (clean_paired_df['DATE_NEW'] >= start_of_week) &
            (clean_paired_df['DATE_NEW'] <= end_of_week)
        ].copy()

        punch_in_data = week_punchins[['DATE_NEW', 'IN']].dropna()

        punch_in_data['weekday'] = punch_in_data['DATE_NEW'].dt.day_name()
        punch_in_data['punch_in_minutes'] = (
            punch_in_data['IN'].dt.hour * 60 +
            punch_in_data['IN'].dt.minute
        )

        print("🕒 Punch-in Rows:", len(punch_in_data))

        punch_in_by_day = []
        grouped = punch_in_data.groupby('weekday')['punch_in_minutes'].mean()

        for day, avg_minutes in grouped.items():
            hh = int(avg_minutes // 60)
            mm = int(avg_minutes % 60)
            punch_in_by_day.append({
                'day': day,
                'avg_punch_in': f"{hh:02d}:{mm:02d}"
            })

        if punch_in_by_day:
            most_punctual = min(
                punch_in_by_day,
                key=lambda x: int(x['avg_punch_in'].split(':')[0]) * 60 +
                              int(x['avg_punch_in'].split(':')[1])
            )
            most_punctual_day = {
                'day': most_punctual['day'],
                'avg_punch_in': most_punctual['avg_punch_in']
            }
        else:
            most_punctual_day = {'day': 'N/A', 'avg_punch_in': 'N/A'}

        return jsonify({
            'average_attendance_percent': average_attendance_percent,
            'most_punctual_day': most_punctual_day,
            'attendance_by_day': attendance_by_day,
            'punch_in_by_day': punch_in_by_day
        })

    except Exception as e:
        print(f"[ERROR] Weekly KPI generation failed: {e}")
        return jsonify({})

# ========================================== Monthly KPI ================================

@app.route('/get_monthly_attendance_trend')
def get_monthly_attendance_trend():
    if 'role' not in session or session.get('role') != 'admin':
        print("[DEBUG] Unauthorized access to attendance trend route")
        return jsonify({})

    month_str = request.args.get('month')  # Expected format: 'YYYY-MM'
    if not month_str:
        print("[DEBUG] Missing month in request")
        return jsonify({})

    try:
        selected_month = pd.to_datetime(month_str + '-01')
        print(f"[DEBUG] Selected month: {selected_month.strftime('%Y-%m')}")

        # ✅ Move this line after defining monthly_data
        monthly_data = daily_attendance_summary[
            (daily_attendance_summary['DATE_NEW'].dt.month == selected_month.month) &
            (daily_attendance_summary['DATE_NEW'].dt.year == selected_month.year)
        ].copy()
        if monthly_data.empty:
            return jsonify({'error': 'No data found for the selected month.'})
        
        print(f"[DEBUG] Filtered data has {len(monthly_data)} rows")
        print("[DEBUG] Columns:", monthly_data.columns.tolist())

        total_users = df['Userid'].nunique()

        chart_data = {
            'dates': monthly_data['DATE_NEW'].dt.strftime('%Y-%m-%d').tolist(),
            'present_counts': monthly_data['Present'].tolist()
        }

        return jsonify(chart_data)

    except Exception as e:
        print(f"[DEBUG] Error in /get_monthly_attendance_trend: {str(e)}")
        return jsonify({})






@app.route('/get_monthly_presence_summary')
def get_monthly_presence_summary():
    if 'role' not in session or session.get('role') != 'admin':
        print("[DEBUG] Unauthorized access to presence summary route")
        return jsonify({})

    month_str = request.args.get('month')  # Expected format: 'YYYY-MM'
    if not month_str:
        print("[DEBUG] Missing month in request")
        return jsonify({})

    try:
        selected_month = pd.to_datetime(month_str + '-01')
        print(f"[DEBUG] Selected month: {selected_month.strftime('%Y-%m')}")

        # ✅ Define first, then log
        monthly_data = daily_attendance_summary[
            (daily_attendance_summary['DATE_NEW'].dt.month == selected_month.month) &
            (daily_attendance_summary['DATE_NEW'].dt.year == selected_month.year)
        ].copy()
        if monthly_data.empty:
            return jsonify({'error': 'No data found for the selected month.'})
        
        print(f"[DEBUG] Filtered data has {len(monthly_data)} rows")
        print("[DEBUG] Columns:", monthly_data.columns.tolist())

        total_users = df['Userid'].nunique()
        monthly_data['Absent'] = total_users - monthly_data['Present']

        chart_data = {
            'dates': monthly_data['DATE_NEW'].dt.strftime('%Y-%m-%d').tolist(),
            'present': monthly_data['Present'].tolist(),
            'absent': monthly_data['Absent'].tolist()
        }

        return jsonify(chart_data)

    except Exception as e:
        print(f"[DEBUG] Error in /get_monthly_presence_summary: {str(e)}")
        return jsonify({})





@app.route('/get_monthly_avg_attendance')
def get_monthly_avg_attendance():
    if 'role' not in session or session.get('role') != 'admin':
        print("[DEBUG] Unauthorized access attempt to /get_monthly_avg_attendance")
        return jsonify({})

    month_str = request.args.get('month')  # Expected format: 'YYYY-MM'
    if not month_str:
        print("[DEBUG] Missing month parameter in request")
        return jsonify({})

    try:
        selected_month = pd.to_datetime(month_str + '-01')
        print(f"[DEBUG] Selected Month: {selected_month.strftime('%Y-%m')}")

        # Filter by selected month
        monthly_data = daily_summary[
            (daily_summary['DATE_NEW'].dt.month == selected_month.month) &
            (daily_summary['DATE_NEW'].dt.year == selected_month.year)
        ].copy()

        if monthly_data.empty:
            print("[DEBUG] No records found for the selected month")
            return jsonify({})

        # Remove weekends
        monthly_data = monthly_data[monthly_data['DATE_NEW'].dt.weekday < 5]

        # Get total users
        total_users = df['Userid'].nunique()

        # Group by date and count unique users present
        daily_counts = monthly_data.groupby('DATE_NEW')['Userid'].nunique().reset_index(name='present_users')

        # Calculate daily attendance percentage
        daily_counts['daily_percent'] = (daily_counts['present_users'] / total_users) * 100

        # Average over all weekdays
        avg_attendance_percent = daily_counts['daily_percent'].mean()

        print(f"[DEBUG] Avg Attendance % (Weekdays Only): {avg_attendance_percent:.2f}%")

        return jsonify({
            'avg_attendance_percent': round(avg_attendance_percent, 2)
        })

    except Exception as e:
        print(f"[ERROR] Exception in /get_monthly_avg_attendance: {str(e)}")
        return jsonify({})




@app.route('/get_monthly_most_punctual_day')
def get_monthly_most_punctual_day():
    if 'role' not in session or session.get('role') != 'admin':
        print("[DEBUG] Unauthorized access attempt to /get_monthly_most_punctual_day")
        return jsonify({})

    month_str = request.args.get('month')  # Expected format: 'YYYY-MM'
    if not month_str:
        print("[DEBUG] Missing month parameter in request")
        return jsonify({})

    try:
        selected_month = pd.to_datetime(month_str + '-01')
        print(f"[DEBUG] Selected Month: {selected_month.strftime('%Y-%m')}")

        # Filter punch-in data for the selected month
        monthly_punchins = clean_paired_df[
            (clean_paired_df['DATE_NEW'].dt.month == selected_month.month) &
            (clean_paired_df['DATE_NEW'].dt.year == selected_month.year)
        ][['DATE_NEW', 'IN']].dropna().copy()

        if monthly_punchins.empty:
            print("[DEBUG] No punch-in data for selected month")
            return jsonify({})

        monthly_punchins['weekday'] = monthly_punchins['DATE_NEW'].dt.day_name()
        monthly_punchins = monthly_punchins[~monthly_punchins['weekday'].isin(['Saturday', 'Sunday'])]

        monthly_punchins['punch_in_minutes'] = (
            monthly_punchins['IN'].dt.hour * 60 +
            monthly_punchins['IN'].dt.minute
        )

        # Group by weekday and calculate average punch-in time
        # Count entries per weekday
        weekday_counts = monthly_punchins['weekday'].value_counts()
        
        # Only include weekdays with >= min_count punch-ins
        min_count = 10  # You can adjust this threshold
        valid_weekdays = weekday_counts[weekday_counts >= min_count].index
        filtered = monthly_punchins[monthly_punchins['weekday'].isin(valid_weekdays)]
        grouped = filtered.groupby('weekday')['punch_in_minutes'].median()
        
        if grouped.empty:
            print("[DEBUG] No weekday-wise data found")
            return jsonify({})
        
        most_punctual = grouped.idxmin()
        avg_minutes = grouped.loc[most_punctual]
        hh = int(avg_minutes // 60)
        mm = int(avg_minutes % 60)
        avg_punch_in = f"{hh:02d}:{mm:02d}"

        print(f"[DEBUG] Most Punctual Day: {most_punctual} @ {avg_punch_in}")
        


        return jsonify({
            'most_punctual_day': most_punctual,
            'avg_punch_in': avg_punch_in
        })

    except Exception as e:
        print(f"[ERROR] Exception in /get_monthly_most_punctual_day: {str(e)}")
        return jsonify({})
       
# =================================== Monthly ROW 3 ==========================
@app.route('/get_monthly_row3_data')
def get_monthly_row3_data():
    if 'role' not in session or session.get('role') != 'admin':
        return jsonify({})

    selected_month = request.args.get('month')
    if not selected_month:
        return jsonify({})

    try:
        month = pd.to_datetime(selected_month).month
        year = pd.to_datetime(selected_month).year

        # ====== Late Arrivals Trend ======
        late_df = clean_paired_df.copy()
        late_df['DATE_NEW'] = pd.to_datetime(late_df['DATE_NEW'])
        late_df['IN'] = pd.to_datetime(late_df['IN'])

        # Get first IN per user per day
        first_in_df = late_df.sort_values(['Userid', 'DATE_NEW', 'IN']).groupby(['Userid', 'DATE_NEW'], as_index=False).first()

        # Mark as late if first IN > 10:15 AM
        late_time = pd.to_datetime('10:15:00').time()
        first_in_df['Late'] = first_in_df['IN'].dt.time > late_time

        # Filter by month/year
        first_in_df = first_in_df[(first_in_df['DATE_NEW'].dt.month == month) & (first_in_df['DATE_NEW'].dt.year == year)]

        # Daily total late count
        late_trend = first_in_df.groupby('DATE_NEW')['Late'].sum().reset_index()

        # ====== Avg. Presence Hours (Per user avg) ======
        summary_df = daily_summary.copy()
        summary_df['DATE_NEW'] = pd.to_datetime(summary_df['DATE_NEW'])

        # Filter to selected month/year
        presence_df = summary_df[(summary_df['DATE_NEW'].dt.month == month) & (summary_df['DATE_NEW'].dt.year == year)]

        # Step 1: Calculate total hours per user per day (already present)
        # Step 2: Average per day across users
        per_day_avg_df = presence_df.groupby(['DATE_NEW', 'Userid'])['Presence_Hours'].sum().reset_index()

        # Step 3: Average across users per day (final daily trend)
        presence_trend = per_day_avg_df.groupby('DATE_NEW')['Presence_Hours'].mean().reset_index()

        return jsonify({
            'late_trend': late_trend.to_dict(orient='records'),
            'presence_trend': presence_trend.to_dict(orient='records')
        })

    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/get_monthly_anomaly_trend')
def get_monthly_anomaly_trend():
    print("SESSION ROLE:", session.get('role'))

    # --- TEMPORARY: Skip auth check for debugging
    # if 'role' not in session or session.get('role') != 'admin':
    #     return jsonify({})

    month_param = request.args.get('month')
    print("Month Param:", month_param)

    if not month_param:
        return jsonify({'error': 'Missing month parameter.'})

    try:
        month_dt = pd.to_datetime(month_param + "-01")
        df = clean_paired_df.copy()
        df['DATE_NEW'] = pd.to_datetime(df['DATE_NEW'])
        df = df[df['DATE_NEW'].dt.to_period('M') == month_dt.to_period('M')]
        print("Filtered Monthly Rows:", len(df))

        df['IN'] = pd.to_datetime(df['IN'], errors='coerce')
        df['OUT'] = pd.to_datetime(df['OUT'], errors='coerce')

        if df.empty:
            print("No data for this month.")
            return jsonify({'dates': [], 'anomalies': []})

        early_cutoff = datetime.strptime("06:00", "%H:%M").time()
        late_cutoff = datetime.strptime("22:00", "%H:%M").time()

        anomaly_trend = []
        grouped = df.groupby(df['DATE_NEW'].dt.date)

        for date_val, group in grouped:
            early_anomalies = group[group['IN'].dt.time < early_cutoff]
            late_anomalies = group[group['OUT'].dt.time > late_cutoff]
            total_anomalies = len(early_anomalies) + len(late_anomalies)

            anomaly_trend.append({
                'date': date_val.strftime("%Y-%m-%d"),
                'anomaly_count': total_anomalies
            })

        print("Anomaly trend prepared.")
        return jsonify({
            'dates': [item['date'] for item in anomaly_trend],
            'anomaly_counts': [item['anomaly_count'] for item in anomaly_trend]  # ✅ MATCHES JS
            })


    except Exception as e:
        print("Error in /get_monthly_anomaly_trend:", e)
        return jsonify({'error': 'Failed to calculate anomaly trend.'})


    



# ========================================= MISCELLANEOUS ====================================

@app.before_request
def ensure_data_loaded():
    global df, paired_df, clean_paired_df
    if df is None or paired_df is None or clean_paired_df is None:
        preprocess_data()


@app.route('/refresh_data')
def refresh_data():
    if session.get('role') != 'admin':
        return redirect(url_for('login'))
    if os.path.exists(CACHE_FILE):
        os.remove(CACHE_FILE)
    preprocess_data()
    return "✅ Data cache refreshed."

@app.route('/get_daily_pie_data')
def get_daily_pie_data():
    if 'role' not in session or session.get('role') != 'admin':
        return jsonify({})

    selected_date = request.args.get('date')
    if not selected_date:
        return jsonify({'error': 'No date provided'}), 400

    try:
        selected_date = pd.to_datetime(selected_date).normalize()

        df_filtered = clean_paired_df[clean_paired_df['DATE_NEW'] == selected_date].copy()
        df_filtered = df_filtered.dropna(subset=['IN'])  # ensure IN time is present

        def categorize_punch_in(time):
            hour = time.hour
            if hour < 9:
                return 'Before 9'
            elif 9 <= hour < 10:
                return '9 - 10'
            elif 10 <= hour < 11:
                return '10 - 11'
            elif 11 <= hour < 12:
                return '11 - 12'
            elif 12 <= hour < 13:
                return '12 - 1'
            elif 13 <= hour < 14:
                return '1 - 2'
            else:
                return 'After 2'

        df_filtered['Time_Bin'] = df_filtered['IN'].apply(categorize_punch_in)

        bin_counts = df_filtered['Time_Bin'].value_counts().sort_index()
        total = bin_counts.sum()

        pie_data = []
        for bin_label, count in bin_counts.items():
            percent = round((count / total) * 100, 2) if total > 0 else 0
            pie_data.append({
                'label': bin_label,
                'count': count,
                'percentage': percent
            })

        return jsonify({'data': pie_data})

    except Exception as e:
        print("Error in /get_daily_pie_data:", str(e))
        return jsonify({'error': 'Server error'}), 500



# ====================================EMPLOYEES SECTION =============================

@app.route('/employees')
def employees():
    if 'role' not in session or session.get('role') != 'admin':
        return redirect(url_for('login'))
    return render_template('dashboard_admin.html')  # or separate employees.html if preferred



@app.route('/get_all_employees')
def get_all_employees():
    # if 'role' not in session or session.get('role') != 'admin':
    #     return jsonify({'error': 'Unauthorized'}), 403

    try:
        # Compute from daily_summary
        summary = (
            daily_summary.groupby('Userid')
            .agg(
                Total_Hours=('Presence_Hours', 'sum'),
                Total_Days=('DATE_NEW', 'nunique')
            )
            .assign(
                Avg_Presence_Hours=lambda df: (df['Total_Hours'] / df['Total_Days']).round(2)
            )
            .reset_index()
            .sort_values(by='Userid')
        )

        # Drop total hours
        summary.drop(columns=['Total_Hours'], inplace=True)

        # Rename and reorder columns
        summary.rename(columns={'Userid': 'EmployeeID'}, inplace=True)
        summary = summary[['EmployeeID', 'Avg_Presence_Hours', 'Total_Days']]

        print(f"[DEBUG] get_all_employees → {len(summary)} records returned.")
        return jsonify(summary.to_dict(orient='records'))

    except Exception as e:
        import traceback
        print("[ERROR] get_all_employees failed:", traceback.format_exc())
        return jsonify({'error': 'Internal server error'}), 500



@app.route('/get_performance_scores')
def get_performance_scores():
    try:
        performance = top_fair_users.copy()
        performance.rename(columns={'Userid': 'EmployeeID', 'Avg_Hours': 'Avg_Presence_Hours', 'Days_Worked': 'Total_Days'}, inplace=True)
        performance = performance[['EmployeeID', 'Avg_Presence_Hours', 'Total_Days', 'Final_Score']]
        return jsonify(performance.to_dict(orient='records'))
    except Exception as e:
        import traceback
        print("[ERROR] get_performance_scores failed:", traceback.format_exc())
        return jsonify({'error': 'Internal server error'}), 500


from flask import jsonify, request
import pandas as pd
import json

@app.route('/get_employee_data')
def get_employee_data():
    user_id = request.args.get('user_id', type=int)
    view = request.args.get('view')
    month = request.args.get('month')

    print("Incoming user_id:", user_id)
    print("View requested:", view)
    print("Month filter:", month)

    if user_id is None or not view:
        return jsonify({'error': 'Missing required parameters'}), 400

    try:
        if view == 'attendance':
            df = daily_summary[daily_summary['Userid'] == user_id]
            if month and month != 'all':
                month = f"2025-{int(month):02d}"
                df = df[df['Month'] == month]
            result = df.to_dict(orient='records')

        elif view == 'punchlog':
            df = paired_df[paired_df['Userid'] == user_id].copy()
            df['ParsedDate'] = pd.to_datetime(df['DATE_NEW'], errors='coerce')
            df['Month'] = df['ParsedDate'].dt.strftime('%Y-%m')

            if month and month != 'all':
                month = f"2025-{int(month):02d}"
                df = df[df['Month'] == month]

            # Safely format datetime columns to string
            for col in ['IN', 'OUT']:
                if col in df.columns:
                    def safe_format(x):
                        try:
                            return pd.to_datetime(x).strftime('%Y-%m-%d %H:%M:%S') if pd.notnull(x) else ''
                        except Exception:
                            return ''
                    df[col] = df[col].apply(safe_format)

            result_df = df.drop(columns=['Month', 'ParsedDate'], errors='ignore')
            result = json.loads(result_df.astype(str).to_json(orient='records'))

        elif view == 'performance':
            df = user_stats[user_stats['Userid'] == user_id]
            result = df.to_dict(orient='records')

        else:
            return jsonify({'error': 'Invalid view type'}), 400

        return jsonify({'data': result})

    except Exception as e:
        return jsonify({'error': str(e)}), 500





@app.route('/view_employee_report')
def view_employee_report():
    empid = request.args.get('empid')
    month = request.args.get('month')  # Expected format: YYYY-MM

    if not empid:
        return "Employee ID is required", 400

    try:
        empid = int(empid)
    except ValueError:
        return "Employee ID must be an integer", 400

    selected_month = None
    if month:
        try:
            print("[DEBUG] month input:", month)
            dt = pd.to_datetime(month)
            selected_month = dt.strftime("%B %Y")  # For display only
        except:
            return "Invalid month format. Use YYYY-MM", 400

    return render_template(
        "employee_report_view.html",
        empid=empid,
        selected_month=selected_month
    )

from flask import request, jsonify
import pandas as pd
import numpy as np

@app.route('/get_employee_report_data')
def get_employee_report_data():
    empid = request.args.get('empid')
    month = request.args.get('month')  # Expected format: YYYY-MM

    # print(f"[DEBUG] Incoming request: empid={empid}, month={month}")

    if not empid:
        return jsonify({"error": "empid is required"}), 400

    try:
        empid = int(empid)
    except ValueError:
        return jsonify({"error": "empid must be an integer"}), 400

    # Filter data for this user
    att_df = daily_summary[daily_summary['Userid'] == empid].copy()
    punch_df = paired_df[paired_df['Userid'] == empid].copy()
    perf_df = user_stats[user_stats['Userid'] == empid].copy()

    # Initialize month context
    month_num = None
    year = None

    if month:
        try:
            dt = pd.to_datetime(month + "-01")
            month_str = dt.strftime('%Y-%m')
            month_num = dt.month
            year = dt.year

            att_df = att_df[(att_df['Month'] == month_num) & (pd.to_datetime(att_df['DATE_NEW']).dt.year == year)]

            punch_df['ParsedDate'] = pd.to_datetime(punch_df['DATE_NEW'], errors='coerce')
            punch_df['Month'] = punch_df['ParsedDate'].dt.strftime('%Y-%m')
            punch_df = punch_df[punch_df['Month'] == month_str]

            perf_df = perf_df[(perf_df['Month'] == month_num) & (perf_df['Year'] == year)]
        except Exception as e:
            print("[ERROR] Month parsing failed:", e)
            return jsonify({"error": "Invalid month format. Use YYYY-MM"}), 400

    # Safely format datetime columns in punch_df
    for col in ['IN', 'OUT']:
        if col in punch_df.columns:
            def safe_format(x):
                try:
                    return pd.to_datetime(x).strftime('%Y-%m-%d %H:%M:%S') if pd.notnull(x) else ''
                except Exception:
                    return ''
            punch_df[col] = punch_df[col].apply(safe_format)

    punch_df.drop(columns=['ParsedDate', 'Month'], inplace=True, errors='ignore')

    # If no performance data, calculate it
    if perf_df.empty:
        if not att_df.empty:
            avg_hours = att_df['Presence_Hours'].mean()
            total_hours = att_df['Presence_Hours'].sum()
            days_worked = att_df['Presence_Hours'].count()
            final_score = round((avg_hours / 8) * 0.4 + (days_worked / 30) * 0.3 + (total_hours / (8 * 30)) * 0.3, 2)

            perf_df = pd.DataFrame([{
                "Userid": empid,
                "Avg_Hours": round(avg_hours, 1),
                "Total_Hours": round(total_hours, 1),
                "Days_Worked": days_worked,
                "Final_Score": final_score,
                "Month": month_num,
                "Year": year
            }])
        else:
            perf_df = pd.DataFrame([{
                "Userid": empid,
                "Avg_Hours": 0,
                "Total_Hours": 0,
                "Days_Worked": 0,
                "Final_Score": 0,
                "Month": month_num,
                "Year": year
            }])

    # ✅ Fix: Replace NaN/inf with None BEFORE converting to JSON
    att_df.replace([np.nan, np.inf, -np.inf], None, inplace=True)
    punch_df.replace([np.nan, np.inf, -np.inf], None, inplace=True)
    perf_df.replace([np.nan, np.inf, -np.inf], None, inplace=True)

    att_json = att_df.to_dict(orient='records')
    punch_json = punch_df.to_dict(orient='records')
    perf_json = perf_df.to_dict(orient='records')

    response = {
        "attendance": att_json,
        "punchlog": punch_json,
        "performance": perf_json
    }

    # print("[DEBUG] Employee data response:", response)
    return jsonify(response)




@app.route("/get_attendance_trends")
def get_attendance_trends():
    try:
        from datetime import datetime

        month = request.args.get("month")
        print(f"[DEBUG] Fetching attendance trends for month: {month}")

        # Copy base DataFrames
        df = daily_summary.copy()
        punch_df = paired_df.copy()

        # Optional month filter
        if month and month != "all":
            df = df[df["Month"] == month]
            punch_df = punch_df[punch_df["Month"] == month]

        # If no data, return defaults
        if df.empty or punch_df.empty:
            return jsonify({
                "avg_presence_hours": 0,
                "late_ins": 0,
                "early_outs": 0
            })

        # Convert IN/OUT to datetime
        punch_df["IN"] = pd.to_datetime(punch_df["IN"], errors="coerce")
        punch_df["OUT"] = pd.to_datetime(punch_df["OUT"], errors="coerce")
        punch_df = punch_df.dropna(subset=["IN", "OUT"])

        # Late INs and Early OUTs
        late_threshold = datetime.strptime("09:00", "%H:%M").time()
        early_threshold = datetime.strptime("17:00", "%H:%M").time()

        late_ins = punch_df[punch_df["IN"].dt.time > late_threshold].shape[0]
        early_outs = punch_df[
            (punch_df["OUT"].dt.time < early_threshold) &
            (punch_df["Duration"] < 6)
        ].shape[0]

        # Filter only present days
        present_df = df[df["Presence_Hours"] > 0]

        # Aggregate total hours and total days per employee
        user_summary = present_df.groupby("Userid").agg(
            total_hours=("Presence_Hours", "sum"),
            total_days=("Presence_Hours", "count")
        ).reset_index()

        # Compute overall average hours
        total_hours_all = user_summary["total_hours"].sum()
        total_days_all = user_summary["total_days"].sum()
        avg_presence = round(total_hours_all / total_days_all, 2) if total_days_all else 0

        print(f"[DEBUG] Total Hours: {total_hours_all}, Total Days: {total_days_all}, Avg: {avg_presence}")

        return jsonify({
            "avg_presence_hours": avg_presence,
            "late_ins": late_ins,
            "early_outs": early_outs
        })

    except Exception as e:
        print(f"[ERROR] /get_attendance_trends: {str(e)}")
        return jsonify({"error": "Internal Server Error"}), 500




@app.route("/get_behavior_patterns")
def get_behavior_patterns():
    try:
        month = request.args.get("month")
        print(f"[DEBUG] Fetching behavior patterns for month: {month}")

        df = paired_df.copy()
        if month and month != "all":
            if df["DATE_NEW"].dtype == "datetime64[ns]":
                df = df[df["DATE_NEW"].dt.strftime("%Y-%m") == month]
            else:
                df = df[df["Month"] == month]  # fallback if 'Month' exists

        if df.empty:
            return jsonify({
                "irregularities": {
                    "mismatches": 0,
                    "short_days": 0,
                    "long_days": 0
                },
                "heatmap_data": []
            })

        # ✅ Add missing DayOfWeek and Hour columns based on IN time
        df = df.copy()
        df["DayOfWeek"] = df["IN"].dt.day_name()
        df["Hour"] = df["IN"].dt.hour

        # ✅ Heatmap data (only for rows with valid IN times)
        heatmap_data = (
            df.dropna(subset=["IN"])
              .groupby(["DayOfWeek", "Hour"])
              .size()
              .reset_index(name="count")
              .to_dict(orient="records")
        )

        # ✅ Irregularity flags
        mismatches = df[df["Mismatch_Flag"] != "OK"].shape[0]
        short_days = df[df["Duration"] < 4].shape[0]
        long_days = df[df["Duration"] > 12].shape[0]

        return jsonify({
            "heatmap_data": heatmap_data,
            "irregularities": {
                "mismatches": mismatches,
                "short_days": short_days,
                "long_days": long_days
            }
        })

    except Exception as e:
        print(f"[ERROR] /get_behavior_patterns: {str(e)}")
        return jsonify({"error": "Internal Server Error"}), 500



@app.route("/get_performance_correlation")
def get_performance_correlation():
    try:
        month = request.args.get("month")
        print(f"[DEBUG] Fetching performance correlation for month: {month}")

        df = user_stats.copy()
        if month and month != "all":
            if df["Month"].dtype != object:
                month = month.replace("-", "")
            df = df[df["Month"] == month]

        if df.empty:
            return jsonify([])

        return jsonify(df[["Userid", "Avg_Hours", "Final_Score"]].to_dict(orient="records"))

    except Exception as e:
        print(f"[ERROR] /get_performance_correlation: {str(e)}")
        return jsonify({"error": "Internal Server Error"}), 500


@app.route("/get_flagged_users")
def get_flagged_users():
    try:
        month = request.args.get("month")
        print(f"[DEBUG] Fetching flagged users for month: {month}")

        df = daily_summary.copy()
        if month and month != "all":
            if df["Month"].dtype != object:
                month = month.replace("-", "")
            df = df[df["Month"] == month]

        if df.empty:
            return jsonify([])

        grouped = df.groupby("Userid").agg({
            "Presence_Hours": "mean",
            "Punch_Count": "mean",
            "Flag_Excessive_Hours": "sum"
        }).reset_index()

        flagged = grouped[grouped["Flag_Excessive_Hours"] > 0]

        result = []
        for _, row in flagged.iterrows():
            flags = []
            if row["Presence_Hours"] > 12:
                flags.append("Excessive Hours")
            if row["Punch_Count"] > 8:
                flags.append("Too Many Punches")

            result.append({
                "empid": row["Userid"],
                "avg_hours": round(row["Presence_Hours"], 1),
                "punch_count": int(row["Punch_Count"]),
                "flag_count": len(flags),  # ✅ Needed for bubble size
                "flags": flags
            })
            

        return jsonify(result)

    except Exception as e:
        print(f"[ERROR] /get_flagged_users: {str(e)}")
        return jsonify({"error": "Internal Server Error"}), 500
    



# ==== Flask setup ====
reports_bp = Blueprint('reports', __name__)

@reports_bp.route("/get_reports_data", methods=["GET"])
def get_reports_data():
    try:
        global daily_summary, paired_df, final_scores, user_stats

        # --- Accurate Absence Count Using paired_df (Weekdays Only) ---
        paired_df["DATE"] = pd.to_datetime(paired_df["DATE_NEW"])
        paired_df["Weekday"] = paired_df["DATE"].dt.weekday  # 0 = Monday

        # Ensure proper datetime
        paired_df["DATE"] = pd.to_datetime(paired_df["DATE_NEW"])
        
        # Get each user's active date range
        user_active_dates = paired_df.groupby("Userid")["DATE"].agg(["min", "max"]).reset_index()
        
        # Generate full expected presence records
        records = []
        for _, row in user_active_dates.iterrows():
            user_id = row["Userid"]
            start = row["min"]
            end = row["max"]
            user_days = pd.date_range(start=start, end=end, freq="B")  # Only business days
            for day in user_days:
                records.append((user_id, day))

        full_index = pd.MultiIndex.from_tuples(records, names=["Userid", "DATE"])
        present_index = paired_df.set_index(["Userid", "DATE"]).index
        missing_index = full_index.difference(present_index)

        absence_df = pd.DataFrame(missing_index.tolist(), columns=["Userid", "DATE"])
        absence_counts = absence_df.groupby("Userid").size().reset_index(name="Absences")

        present_index = paired_df.set_index(["Userid", "DATE"]).index
        missing_index = full_index.difference(present_index)

        absence_df = pd.DataFrame(missing_index.tolist(), columns=["Userid", "DATE"])
        absence_counts = absence_df.groupby("Userid").size().reset_index(name="Absences")

        # --- Attendance Summary ---
        attendance_summary = (
            daily_summary.groupby("Userid")
            .agg(
                Avg_Hours=("Presence_Hours", "mean"),
                Total_Days=("Presence_Hours", "count"),
                Excessive_Hour_Days=("Flag_Excessive_Hours", "sum"),
                Punch_Issues=("Punch_Count", lambda x: (x < 2).sum())
            )
            .reset_index()
        )

        # Merge absence counts into attendance
        attendance_summary = pd.merge(attendance_summary, absence_counts, on="Userid", how="left")
        attendance_summary["Absences"] = attendance_summary["Absences"].fillna(0).astype(int)

        # --- Mismatch Summary ---
        mismatch_summary = (
            paired_df.groupby("Userid")
            .agg(
                Unmatched_INs=("Mismatch_Flag", lambda x: (x == "Unmatched_IN").sum()),
                Unmatched_OUTs=("Mismatch_Flag", lambda x: (x == "Unmatched_OUT").sum()),
                Mismatch_Count=("Mismatch_Flag", lambda x: (x != "OK").sum()),
                Late_INs=("IN", lambda x: (x.dt.hour > 9).sum()),
                Early_OUTs=("OUT", lambda x: (x.dt.hour < 17).sum())
            )
            .reset_index()
        )

        # --- Merge All Sources ---
        merged = pd.merge(attendance_summary, mismatch_summary, on="Userid", how="outer")
        merged = pd.merge(merged, final_scores, on="Userid", how="left")
        merged = pd.merge(merged, user_stats, on="Userid", how="left")

        # Ensure expected columns are always present
        required_cols = [
            "Avg_Hours", "Absences", "Total_Days", "Excessive_Hour_Days", "Punch_Issues",
            "Unmatched_INs", "Unmatched_OUTs", "Mismatch_Count", "Late_INs", "Early_OUTs", "Final_Score"
        ]
        for col in required_cols:
            if col not in merged.columns:
                merged[col] = 0

        merged.fillna(0, inplace=True)

        # --- Normalize Final Score ---
        merged["Final_Score"] = (merged["Final_Score"] * 100).clip(0, 100)

        # --- Flagged Logic ---
        # Only flag if:
        # - Avg_Hours > 12 (excessive)
        # - OR Final_Score < 50 (underperformer)
        merged["Flagged"] = (
            (merged["Avg_Hours"] > 12) |
            (merged["Final_Score"] < 30)
        ).astype(int)

        # Final formatting
        merged = merged.round(2)
        merged.sort_values("Final_Score", ascending=False, inplace=True)

        return jsonify({"status": "success", "data": merged.to_dict(orient="records")})

    except Exception as e:
        print("[REPORT ERROR]", str(e))
        return jsonify({"status": "error", "message": str(e)})
    


@reports_bp.route("/get_anomaly_trend", methods=["GET"])
@reports_bp.route("/get_anomaly_trend", methods=["GET"])
def get_anomaly_trend():
    try:
        global paired_df

        df = paired_df.copy()
        df["DATE_NEW"] = pd.to_datetime(df["DATE_NEW"])
        df["IN"] = pd.to_datetime(df["IN"], errors="coerce")
        df["OUT"] = pd.to_datetime(df["OUT"], errors="coerce")

        # Cutoffs
        early_cutoff = datetime.strptime("06:00", "%H:%M").time()
        late_cutoff = datetime.strptime("22:00", "%H:%M").time()

        # Group by date
        anomaly_trend = []
        grouped = df.groupby(df["DATE_NEW"].dt.date)

        for date_val, group in grouped:
            early_anomalies = group[group["IN"].dt.time < early_cutoff]
            late_anomalies = group[group["OUT"].dt.time > late_cutoff]
            total_anomalies = len(early_anomalies) + len(late_anomalies)

            anomaly_trend.append({
                "Date": date_val.strftime("%d-%m"),
                "Count": total_anomalies
            })

        anomaly_trend = sorted(anomaly_trend, key=lambda x: datetime.strptime(x["Date"], "%d-%m"))

        return jsonify({ "status": "success", "trend": anomaly_trend })

    except Exception as e:
        print("[ANOMALY TREND ERROR]", str(e))
        return jsonify({ "status": "error", "message": str(e) })

@app.route('/get_attendance_trend')
def get_attendance_trend():
    if 'role' not in session or session['role'] != 'admin':
        return jsonify({"status": "error", "message": "Unauthorized"}), 403

    try:
        summary = daily_attendance_summary.copy()
        if summary.empty:
            return jsonify({"status": "error", "message": "No data found"})

        summary = summary.sort_values("DATE_NEW")
        chart_data = {
            "status": "success",
            "labels": summary["DATE_NEW"].dt.strftime("%Y-%m-%d").tolist(),
            "counts": summary["Present"].tolist()
        }
        return jsonify(chart_data)

    except Exception as e:
        print("[ERROR] Attendance trend:", str(e))
        return jsonify({"status": "error", "message": str(e)})
        


@app.route('/get_timing_insights')
def get_timing_insights():
    try:
        empid = request.args.get('empid', type=int)  # optional
        month = request.args.get('month')            # optional

        # Filter base data
        df = paired_df.copy()
        if empid:
            df = df[df["Userid"] == empid]
        if month:
            df = df[df["DATE_NEW"].dt.strftime("%Y-%m") == month]

        # Ensure first IN per employee per day
        df = (
            df.sort_values(["Userid", "DATE_NEW", "IN"])
              .groupby(["Userid", "DATE_NEW"], as_index=False)
              .first()
              .copy()
        )

        # Time calculations
        df["IN_HOUR"] = df["IN"].dt.hour + df["IN"].dt.minute / 60
        df["OUT_HOUR"] = df["OUT"].dt.hour + df["OUT"].dt.minute / 60
        df["Duration"] = (df["OUT"] - df["IN"]).dt.total_seconds() / 3600

        # Basic metrics
        avg_in = round(df["IN_HOUR"].median(), 2)
        avg_out = round(df["OUT_HOUR"].median(), 2)
        avg_duration = round(df["Duration"].mean(), 1)

        # Consistency (duration-based)
        med_duration = df["Duration"].median()
        consistent_count = ((df["Duration"] - med_duration).abs() < 0.5).groupby(df["Userid"]).mean()
        consistent_workers = consistent_count[consistent_count >= 0.7].count()

        # Punctual count (based on majority of days)
        punctual_ratio = (df["IN_HOUR"] <= 9).groupby(df["Userid"]).mean()
        punctual_count = punctual_ratio[punctual_ratio >= 0.7].count()

        # Weekday-wise average IN/OUT
        daywise = df.copy()
        daywise["day"] = daywise["DATE_NEW"].dt.day_name()
        avg_by_day = (
            daywise.groupby("day")[["IN_HOUR", "OUT_HOUR"]]
            .mean()
            .round(2)
            .reset_index()
            .rename(columns={"IN_HOUR": "avg_in", "OUT_HOUR": "avg_out"})
        )

        # Arrival interval consistency
        bins = [0, 8, 9, 10, 11, 24]
        labels = ["Before 8", "8–9", "9–10", "10–11", "After 11"]
        df["interval"] = pd.cut(df["IN_HOUR"], bins=bins, labels=labels, right=False)

        interval_freq = df.groupby(["Userid", "interval"],observed=True).size().reset_index(name="count")
        total_days = df.groupby("Userid").size().reset_index(name="total_days")
        merged = pd.merge(interval_freq, total_days, on="Userid")
        merged["ratio"] = merged["count"] / merged["total_days"]

        consistent_emps = merged[merged["ratio"] >= 0.7]
        interval_dist = consistent_emps["interval"].value_counts().sort_index().to_dict()

        # Work categories
        work_cat_bins = [0, 6, 9, 24]
        work_labels = ["Underworking", "Consistent", "Overworking"]
        df["work_category"] = pd.cut(df["Duration"], bins=work_cat_bins, labels=work_labels)
        work_cat_dist = df.groupby("Userid")["work_category"].agg(lambda x: x.value_counts().idxmax())
        work_cat_final = work_cat_dist.value_counts().sort_index().to_dict()

        return jsonify({
            "avg_in_time": f"{int(avg_in):02d}:{int((avg_in % 1) * 60):02d}",
            "avg_out_time": f"{int(avg_out):02d}:{int((avg_out % 1) * 60):02d}",
            "avg_duration": f"{avg_duration} hrs",
            "consistent_count": int(consistent_workers),
            "punctual_count": int(punctual_count),
            "avg_times_by_day": avg_by_day.to_dict(orient="records"),
            "interval_distribution": interval_dist,
            "work_categories": work_cat_final
        })

    except Exception as e:
        import traceback
        print("❌ [SERVER ERROR] get_timing_insights:", e)
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500
    

from flask import request, jsonify
import numpy as np
from datetime import datetime

@app.route('/get_top_consistent_employees')
def get_top_consistent_employees():
    try:
        month = request.args.get('month')  # Optional
        df = paired_df.copy()

        if month:
            df = df[df['DATE_NEW'].dt.strftime('%Y-%m') == month]

        df = df.dropna(subset=['Userid', 'IN'])
        df['IN_HOUR'] = df['IN'].dt.hour + df['IN'].dt.minute / 60

        employee_stats = []
        grouped = df.groupby('Userid')

        for empid, group in grouped:
            if len(group) < 5:
                continue

            group = group.sort_values('DATE_NEW', ascending=True)
            in_times_full = group['IN_HOUR'].tolist()
            avg_in = round(np.mean(in_times_full), 2)
            std_dev = round(np.std(in_times_full), 2)

            # Optional strict filter for "consistent" people only
            if std_dev > 1.0:
                continue

            # Limit the number of points shown in the chart
            in_times_for_chart = in_times_full[-100:]  # Last 15 days

            employee_stats.append({
                "empid": empid,
                "avg_in": avg_in,
                "std_dev": std_dev,
                "in_times": in_times_for_chart
            })

        # Top 5 sorted by lowest std_dev
        top_employees = sorted(employee_stats, key=lambda x: x["std_dev"])[:5]

        return jsonify({"top_employees": top_employees})

    except Exception as e:
        import traceback
        print("❌ [SERVER ERROR] get_top_consistent_employees:", e)
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500


@app.route('/get_employee_in_pattern')
def get_employee_in_pattern():
    try:
        empid = request.args.get('empid')
        if not empid:
            return jsonify({"error": "Employee ID is required"}), 400

        df = paired_df.copy()
        df = df[df['Userid'] == int(empid)]
        df = df.dropna(subset=['IN'])

        if df.empty or len(df) < 3:
            return jsonify({"error": "Not enough data"}), 404

        df = df.sort_values('DATE_NEW')
        in_times = df['IN'].dt.hour + df['IN'].dt.minute / 60
        labels = df['DATE_NEW'].dt.strftime('%b %d').tolist()

        return jsonify({
            "empid": empid,
            "in_times": in_times.tolist(),
            "labels": labels
        })

    except Exception as e:
        import traceback
        print("❌ [SERVER ERROR] get_employee_in_pattern:", e)
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500






# ========================================= USER DASHBOARD ROUTE ===================================

@app.route('/dashboard_user')
def dashboard_user():
    if session.get('role') != 'user':
        return redirect(url_for('login'))  # ✅ Avoid infinite redirect

    userid = session.get('username')

    # Fetch user name from DB
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM employee_logins WHERE userid = ?", (userid,))
    user = cursor.fetchone()
    user_name = user['name'] if user else 'User'
    conn.close()

    # Get Final_Score from user_stats dataframe
    try:
        uid_int = int(userid)
        user_row = user_stats[user_stats['Userid'] == uid_int]

        if not user_row.empty:
            final_score = user_row.iloc[0]['Final_Score']  # Value between 0 and 1
            rating = round(final_score * 100)              # Scale to 0–100
        else:
            rating = 50  # Fallback default rating

    except Exception as e:
        print("[USER RATING ERROR]", e)
        rating = 50  # Safe fallback

    return render_template(
        'dashboard_user.html',
        user_name=user_name,
        rating=rating
    )



from flask import request, jsonify
from datetime import datetime, timedelta
import pandas as pd

@app.route('/get_user_activity_data')
def get_user_activity_data():
    userid = request.args.get('userid', type=int)
    view = request.args.get('view')  # "weekly" or "monthly"
    date_str = request.args.get('date')   # For weekly
    month_str = request.args.get('month') # For monthly

    if not userid or not view:
        return jsonify({"error": "Missing required parameters"}), 400

    user_paired = paired_df[paired_df["Userid"] == userid].copy()
    user_summary = daily_summary[daily_summary["Userid"] == userid].copy()

    if view == "weekly":
        if not date_str:
            return jsonify({"error": "Missing date for weekly view"}), 400
        try:
            start_date = pd.to_datetime(date_str)
            end_date = start_date + timedelta(days=6)
        except:
            return jsonify({"error": "Invalid date format"}), 400

    elif view == "monthly":
        if not month_str:
            return jsonify({"error": "Missing month for monthly view"}), 400
        try:
            start_date = pd.to_datetime(month_str + "-01")
            end_date = (start_date + pd.offsets.MonthEnd(0)).to_pydatetime()
        except:
            return jsonify({"error": "Invalid month format"}), 400

    else:
        return jsonify({"error": "Invalid view type"}), 400

    # Filtered data
    paired_mask = (user_paired["DATE_NEW"] >= start_date) & (user_paired["DATE_NEW"] <= end_date)
    summary_mask = (user_summary["DATE_NEW"] >= start_date) & (user_summary["DATE_NEW"] <= end_date)

    filtered_paired = user_paired[paired_mask]
    filtered_summary = user_summary[summary_mask]

    # ===== Compute average IN/OUT times =====
    def compute_avg_time(timeseries):
        if timeseries.empty:
            return "NA"
        total_secs = sum(t.hour * 3600 + t.minute * 60 + t.second for t in timeseries)
        avg_secs = total_secs / len(timeseries)
        return str(timedelta(seconds=int(avg_secs)))[:5]

    # Use FIRST IN and LAST OUT per day
    first_ins = filtered_paired.groupby("DATE_NEW")["IN"].min().dropna()
    last_outs = filtered_paired.groupby("DATE_NEW")["OUT"].max().dropna()

    avg_in = compute_avg_time(first_ins)
    avg_out = compute_avg_time(last_outs)

    # ===== Metrics =====
    present_days = int((filtered_summary["Presence_Hours"] > 0).sum())
    total_workdays = (end_date - start_date).days + 1
    attendance_percent = round((present_days / total_workdays) * 100, 1) if total_workdays > 0 else 0

    total_hours = filtered_summary.loc[filtered_summary["Presence_Hours"] > 0, "Presence_Hours"].sum()
    avg_hours = round(total_hours / present_days, 2) if present_days > 0 else 0

    absent_days = total_workdays - present_days

    # Late INs: first IN after 09:00
    late_cutoff = datetime.strptime("09:00", "%H:%M").time()
    late_ins = int((first_ins.dt.time > late_cutoff).sum())

    # Early OUTs: last OUT before 17:00
    early_cutoff = datetime.strptime("17:00", "%H:%M").time()
    early_outs = int((last_outs.dt.time < early_cutoff).sum())

    # Chart Data
    chart_labels, chart_values = [], []
    chart_df = filtered_summary.sort_values("DATE_NEW")

    if view == "weekly":
        for _, row in chart_df.iterrows():
            chart_labels.append(row["DATE_NEW"].strftime("%a"))  # Mon, Tue...
            chart_values.append(round(row["Presence_Hours"], 2))
    else:
        for _, row in chart_df.iterrows():
            chart_labels.append(row["DATE_NEW"].strftime("%d-%b"))
            chart_values.append(round(row["Presence_Hours"], 2))

    # Today
    present_date = datetime.today().strftime("%d %b %Y")

    return jsonify({
        "present_date": present_date,
        "avg_in": avg_in,
        "avg_out": avg_out,
        "avg_hours": avg_hours,
        "total_days": total_workdays,
        "present_days": present_days,
        "absent_days": absent_days,
        "attendance_percent": attendance_percent,
        "late_ins": late_ins,
        "early_outs": early_outs,
        "chart_labels": chart_labels,
        "chart_values": chart_values
    })




from flask import session
import random

@app.route('/get_session_info')
def get_session_info():
    if 'username' in session:
        # Assign random avatar if not already set
        if 'avatar' not in session:
            avatar_list = [
                'avatar1.jpg',
                'avatar2.jpg',
                'avatar3.jpg',
                'avatar4.jpg',
                'avatar5.jpg',
                'avatar6.jpg'
            ]
            session['avatar'] = random.choice(avatar_list)

        return jsonify({
            'userid': session['username'],
            'role': session.get('role', 'user'),
            'avatar': session['avatar']
        })

    return jsonify({'error': 'not_logged_in'}), 401


@app.route('/change_profile_avatar', methods=['POST'])
def change_profile_avatar():
    if 'username' not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    avatar = request.json.get('avatar')
    if not avatar or not avatar.endswith(('.jpg', '.png')):
        return jsonify({"success": False, "message": "Invalid avatar"}), 400

    session['avatar'] = avatar  # ✅ Only save in session (not DB)
    return jsonify({"success": True})



# import random

# @app.route('/assign_random_avatars')
# def assign_random_avatars():
#     try:
#         conn = get_connection()
#         cursor = conn.cursor()

#         cursor.execute("SELECT userid FROM employee_logins")
#         users = cursor.fetchall()

#         avatars = [f"avatar{i}.jpg" for i in range(1, 7)]

#         for (userid,) in users:
#             random_avatar = random.choice(avatars)
#             cursor.execute("UPDATE employee_logins SET avatar = %s WHERE userid = %s", (random_avatar, userid))

#         conn.commit()
#         conn.close()
#         return "Random avatars assigned to all users!"

#     except Exception as e:
#         return f"Error: {str(e)}"

# ==========================================TESTING====================================
# print(paired_df.columns.tolist())
# print(daily_summary.columns.tolist())
# print("[DEBUG] daily_summary columns:", daily_summary.columns.tolist())
# print(final_scores[final_scores.Userid==25])
# print(user_stats.head(2))

# ==================================== Register blueprint=============================
app.register_blueprint(reports_bp)
# print("[ROUTES]", app.url_map)

 
 
 #========================================== Main ====================================
if __name__ == '__main__':
    app.run(debug=True)




