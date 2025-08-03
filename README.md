# Employee Attendance Dashboard

A web-based dashboard to analyze employee attendance patterns using punch-in and punch-out data.  
Built to help admins track timing trends and employees understand their own working habits.

---

## About the Project

This project provides both **Admin** and **User** dashboards to monitor daily punch logs, attendance trends, and punctuality insights. It uses **CSV data as input**, so it works even without a database setup.

---

## Key Features

### Admin Dashboard
- View daily punch logs (IN/OUT) with mismatch detection.
- Analyze average IN/OUT times, total working hours, and trends by day/week/month.
- Visual cards and charts showing:
  - Punctual employees
  - Consistent performers
  - Average durations
- Interactive **Leaderboard** showing top consistent employees with comparison charts.

### User Dashboard
- Personal weekly or monthly activity overview.
- Charts showing working hours and punch frequency.
- Flip cards for:
  - Attendance %
  - Early exits and late arrivals
  - Warnings when overworking
- Special **TRON-themed animation mode** with audio effects.

---

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (Chart.js)
- **Backend**: Python (Flask, Pandas)
- **Data Source**: CSV files (no database required)

---

## Project Structure
```
├── app.py # Main Flask application
├── check.py # Punch pairing and validation script
├── database.py # SQLite database connection setup
├── init_db.py # DB initialization script
├── migrate_mysql_to_sqlite.py # (Optional) Migration script from MySQL
├── bulk_insert_custom_passwords.py # Script to insert default users
├── hash_password.py # Utility to hash user passwords
├── preprocessed_data.pkl # Cached data (optional)
├── requirements.txt # Python dependencies
├── README.md # Project documentation
├── user_credentials.csv # Sample user login credentials

├── data/
│ └── dummy_data.xlsx # Sample attendance data

├── static/
│ ├── audio/ # Audio files for UI effects
│ ├── css/ # Styling files
│ ├── js/ # JavaScript logic
│ └── Pictures/ # UI assets or icons

├── templates/
│ ├── dashboard_admin.html # Admin dashboard view
│ ├── dashboard_user.html # User dashboard view
│ ├── employee_report_view.html # Employee punch report
│ ├── login.html # Login page
│ ├── login_history.html # Admin login history view
│ └── redirector.html # Role-based redirect logic
```

---

## How to Run the Project?

### Prerequisites
```
- VS Code (Optional)
- Python 3.x installed
- Flask==2.3.3
- pandas==2.2.2
- numpy==1.26.4
- scikit-learn==1.4.2          # For MinMaxScaler and other preprocessing tools
- openpyxl==3.1.2              # For Excel data support (.xlsx)
- Werkzeug==2.3.0              # Password hashing / secure auth
```

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/Sai-Rohith-01/Attendance-Monitoring-App.git
   cd employee-attendance-dashboard


2. **Install required packages**
   ```bash
   pip install -r requirements.txt
   
4. **Run the Flask app**
   ```bash
   python app.py

6. **In your browser go to**
   
   ```bash
   http://127.0.0.1:5000
   ```

 ### OR
 Access this Public URL:
     
     https://attendance-monitoring-app-w729.onrender.com
---   

## Sample Use Cases

1. For HR teams to track attendance and identify punctual or inconsistent employees.
2. For employees to self-monitor their daily working habits.
3. Ideal for remote or hybrid teams where punch-in/out logs are available.

 ---

## Author
**K. Sai Rohith** – built as an individual project to apply concepts of full-stack web development, data preprocessing with Python, and interactive dashboard design. 

##  License
This project is open-source and available under the MIT License.

