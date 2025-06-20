from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
import pandas as pd
import os
import pickle
from datetime import datetime, timedelta
from sklearn.preprocessing import MinMaxScaler
from pandas.api.types import CategoricalDtype
import time

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'

# ========== USER AUTH DATA ==========
users = {
    'admin1': {'password': 'adminpass', 'role': 'admin'},
    'user1': {'password': 'userpass', 'role': 'user'}
}

# ========== CACHE FILE ==========
CACHE_FILE = "preprocessed_data.pkl"

# ========== GLOBAL DATAFRAMES ==========
df = paired_df = clean_paired_df = None
daily_summary =daily_attendance_summary= weekday_trends = final_scores = top_fair_users = None


# ========== DATA PREPROCESSING ==========
def preprocess_data():
    global df, paired_df, clean_paired_df, daily_summary,daily_attendance_summary, weekday_trends, final_scores, top_fair_users

    start_time = time.time()

    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, 'rb') as f:
            (df, paired_df, clean_paired_df, daily_summary, weekday_trends, final_scores, top_fair_users,daily_attendance_summary) = pickle.load(f)
        print("✅ Loaded data from cache in", round(time.time() - start_time, 2), "seconds.")
        return

    print("⚙️ Preprocessing started...")

    df = pd.read_excel("data/dummy_data.xlsx")
    df['DATETIME'] = pd.to_datetime(df['DATE_NEW'] + ' ' + df['PUNCHTIME'], format='%d-%b-%y %H:%M')
    df['DATE_NEW'] = pd.to_datetime(df['DATE_NEW'], format='%d-%b-%y', errors='coerce')
    df = df.sort_values(by=['Userid', 'DATETIME']).reset_index(drop=True)

    def deduplicate_punches(group, userid, date, threshold_minutes=5):
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
        pickle.dump((df, paired_df, clean_paired_df, daily_summary, weekday_trends, final_scores, top_fair_users,daily_attendance_summary), f)

    print("✅ Preprocessing done in", round(time.time() - start_time, 2), "seconds.")

preprocess_data()


# ========== ROUTE TO CLEAR CACHE ==========
@app.route('/clear_cache')
def clear_cache():
    if os.path.exists(CACHE_FILE):
        os.remove(CACHE_FILE)
        return "✅ Cache cleared. Restart the server or refresh to trigger preprocessing."
    return "⚠️ No cache file found."



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



# ==================================== ADMIN DASHBOARD ROUTE =========================================

@app.route('/dashboard_admin')
def dashboard_admin():
    if session.get('role') != 'admin':
        return redirect(url_for('login'))

    today = datetime.today().date()
    today_df = paired_df[paired_df['DATE_NEW'] == today].copy()
    total_employees = today_df['Userid'].nunique()

    today_df['IN'] = pd.to_datetime(today_df['IN'], errors='coerce')
    avg_login_time = today_df['IN'].dropna().mean()
    avg_login = avg_login_time.strftime('%H:%M') if pd.notnull(avg_login_time) else "N/A"

    mismatches_today = 0  # Placeholder (not implemented)

    return render_template(
        'dashboard_admin.html',
        total_employees=total_employees,
        avg_login=avg_login,
        mismatches_today=mismatches_today
    )


# ========================================= USER DASHBOARD ROUTE ===================================

@app.route('/dashboard_user')
def dashboard_user():
    if session.get('role') != 'user':
        return redirect(url_for('login'))
    return render_template('dashboard_user.html')


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

        monthly_data = daily_summary[
            (daily_summary['DATE_NEW'].dt.month == selected_month.month) &
            (daily_summary['DATE_NEW'].dt.year == selected_month.year)
        ].copy()

        if monthly_data.empty:
            print("[DEBUG] No records found for the selected month")
            return jsonify({})

        total_days = monthly_data['DATE_NEW'].nunique()
        total_users = df['Userid'].nunique()
        print(f"[DEBUG] Total Days in Month: {total_days}, Total Users: {total_users}")

        # Calculate daily attendance %
        monthly_data['daily_percent'] = (monthly_data['Userid'] / total_users) * 100
        avg_attendance_percent = monthly_data['daily_percent'].mean()

        print(f"[DEBUG] Monthly Average Attendance: {avg_attendance_percent:.2f}%")

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







# =============================================== MAIN ==================================
if __name__ == '__main__':
    app.run(debug=True)



