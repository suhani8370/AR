import os
import sqlite3
from datetime import date
from flask import Flask, render_template, request, jsonify

# Get the project folder location
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Set correct template and static folder paths
app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static")
)

DATABASE = os.path.join(BASE_DIR, "assignments.db")


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject TEXT NOT NULL,
            title TEXT NOT NULL,
            due_date TEXT NOT NULL,
            priority TEXT NOT NULL,
            status TEXT DEFAULT 'Not Started',
            reminder_days INTEGER DEFAULT 1
        )
    """)
    conn.commit()
    conn.close()


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    conn = get_db()
    tasks = conn.execute(
        "SELECT * FROM assignments ORDER BY due_date"
    ).fetchall()
    conn.close()

    return jsonify([dict(task) for task in tasks])


@app.route("/api/tasks", methods=["POST"])
def add_task():
    data = request.get_json(silent=True)

    required = ["subject", "title", "due_date", "priority"]

    if not data or any(not data.get(field) for field in required):
        return jsonify({"error": "Please fill all required fields"}), 400

    try:
        date.fromisoformat(data["due_date"])
        reminder_days = int(data.get("reminder_days", 1))

        if reminder_days < 0:
            raise ValueError()

    except (ValueError, TypeError):
        return jsonify({"error": "Invalid date or reminder value"}), 400

    conn = get_db()
    conn.execute("""
        INSERT INTO assignments
        (subject, title, due_date, priority, reminder_days)
        VALUES (?, ?, ?, ?, ?)
    """, (
        data["subject"],
        data["title"],
        data["due_date"],
        data["priority"],
        reminder_days
    ))
    conn.commit()
    conn.close()

    return jsonify({"message": "Assignment added successfully"}), 201


@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    data = request.get_json(silent=True)

    required = ["subject", "title", "due_date", "priority"]

    if not data or any(not data.get(field) for field in required):
        return jsonify({"error": "Please fill all required fields"}), 400

    try:
        date.fromisoformat(data["due_date"])
        reminder_days = int(data.get("reminder_days", 1))

        if reminder_days < 0:
            raise ValueError()

    except (ValueError, TypeError):
        return jsonify({"error": "Invalid date or reminder value"}), 400

    conn = get_db()
    result = conn.execute("""
        UPDATE assignments
        SET subject=?, title=?, due_date=?, priority=?, reminder_days=?
        WHERE id=?
    """, (
        data["subject"],
        data["title"],
        data["due_date"],
        data["priority"],
        reminder_days,
        task_id
    ))

    conn.commit()
    conn.close()

    if result.rowcount == 0:
        return jsonify({"error": "Assignment not found"}), 404

    return jsonify({"message": "Assignment updated successfully"})


@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
def change_status(task_id):
    data = request.get_json(silent=True)
    status = data.get("status") if data else None

    allowed = ["Not Started", "In Progress", "Completed"]

    if status not in allowed:
        return jsonify({"error": "Invalid status"}), 400

    conn = get_db()
    result = conn.execute(
        "UPDATE assignments SET status=? WHERE id=?",
        (status, task_id)
    )

    conn.commit()
    conn.close()

    if result.rowcount == 0:
        return jsonify({"error": "Assignment not found"}), 404

    return jsonify({"message": "Status updated"})


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    conn = get_db()
    result = conn.execute(
        "DELETE FROM assignments WHERE id=?",
        (task_id,)
    )

    conn.commit()
    conn.close()

    if result.rowcount == 0:
        return jsonify({"error": "Assignment not found"}), 404

    return jsonify({"message": "Assignment deleted"})


if __name__ == "__main__":
    init_db()
    app.run(debug=True)
