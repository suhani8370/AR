const form = document.getElementById("assignmentForm");
const taskList = document.getElementById("taskList");
const filter = document.getElementById("filter");
const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("input", showTasks);

let tasks = [];
let notifiedTasks = new Set();

document.getElementById("dueDate").min =
    new Date().toISOString().split("T")[0];


async function loadTasks() {
    const response = await fetch("/api/tasks");
    tasks = await response.json();

    showTasks();
    updateDashboard();
    checkReminders();
}


function updateDashboard() {
    const today = new Date().toISOString().split("T")[0];

    document.getElementById("totalCount").textContent = tasks.length;

    document.getElementById("upcomingCount").textContent =
        tasks.filter(t => t.due_date >= today &&
            t.status !== "Completed").length;

    document.getElementById("overdueCount").textContent =
        tasks.filter(t => t.due_date < today &&
            t.status !== "Completed").length;

    document.getElementById("completedCount").textContent =
        tasks.filter(t => t.status === "Completed").length;
}
const completed = tasks.filter(
    t => t.status === "Completed"
).length;

const percentage = tasks.length === 0 ?
    0 :
    Math.round((completed / tasks.length) * 100);

document.getElementById("completionRate").textContent =
    percentage + "%";


function showTasks() {
    const selected = filter.value;
    const today = new Date().toISOString().split("T")[0];

    let filtered = tasks.filter(task => {

        if (selected === "Upcoming")
            return task.due_date >= today &&
                task.status !== "Completed";

        if (selected === "Overdue")
            return task.due_date < today &&
                task.status !== "Completed";

        if (selected === "In Progress")
            return task.status === "In Progress";

        if (selected === "Completed")
            return task.status === "Completed";

        return true;
    });
    const searchText = searchInput.value.toLowerCase();

    filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchText) ||
        task.subject.toLowerCase().includes(searchText)
    );
    taskList.innerHTML = "";

    if (filtered.length === 0) {
        taskList.innerHTML =
            '<p class="empty">No assignments found.</p>';
        return;
    }

    filtered.forEach(task => {

        const isOverdue =
            task.due_date < today &&
            task.status !== "Completed";

        const div = document.createElement("div");

        div.className = "task" +
            (isOverdue ? " overdue" : "") +
            (task.status === "Completed" ? " completed" : "");

        const heading = document.createElement("h3");
        heading.textContent = task.title;

        const subject = document.createElement("p");
        subject.textContent = "Subject: " + task.subject;

        const due = document.createElement("p");
        due.textContent = "Due Date: " + task.due_date;

        const priority = document.createElement("p");
        priority.textContent = "Priority: " + task.priority;

        const statusText = document.createElement("p");
        statusText.textContent = "Status: " + task.status;

        const actions = document.createElement("div");
        actions.className = "task-actions";

        const status = document.createElement("select");

        ["Not Started", "In Progress", "Completed"].forEach(value => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            status.appendChild(option);
        });

        status.value = task.status;

        status.addEventListener("change", () =>
            changeStatus(task.id, status.value)
        );

        const edit = document.createElement("button");
        edit.textContent = "Edit";
        edit.className = "edit-btn";
        edit.addEventListener("click", () => editTask(task));

        const del = document.createElement("button");
        del.textContent = "Delete";
        del.className = "delete-btn";
        del.addEventListener("click", () => deleteTask(task.id));

        actions.append(status, edit, del);

        div.append(
            heading,
            subject,
            due,
            priority,
            statusText,
            actions
        );

        taskList.appendChild(div);
    });
}


form.addEventListener("submit", async event => {

    event.preventDefault();

    const id = document.getElementById("editId").value;

    const data = {
        subject: document.getElementById("subject").value.trim(),
        title: document.getElementById("title").value.trim(),
        due_date: document.getElementById("dueDate").value,
        priority: document.getElementById("priority").value,
        reminder_days: Number(
            document.getElementById("reminderDays").value
        )
    };

    const url = id ? `/api/tasks/${id}` : "/api/tasks";
    const method = id ? "PUT" : "POST";

    const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
        alert(result.error || "Something went wrong");
        return;
    }

    alert(result.message);

    form.reset();
    resetEditMode();
    loadTasks();
});


function editTask(task) {

    document.getElementById("editId").value = task.id;
    document.getElementById("subject").value = task.subject;
    document.getElementById("title").value = task.title;
    document.getElementById("dueDate").value = task.due_date;
    document.getElementById("priority").value = task.priority;
    document.getElementById("reminderDays").value =
        task.reminder_days;

    document.getElementById("formHeading").textContent =
        "Edit Assignment";

    document.getElementById("saveBtn").textContent =
        "Update Assignment";

    document.getElementById("cancelBtn").hidden = false;

    window.scrollTo({ top: 0, behavior: "smooth" });
}


function resetEditMode() {

    document.getElementById("editId").value = "";

    document.getElementById("formHeading").textContent =
        "Add New Assignment";

    document.getElementById("saveBtn").textContent =
        "Add Assignment";

    document.getElementById("cancelBtn").hidden = true;
}


document.getElementById("cancelBtn").addEventListener("click", () => {
    form.reset();
    resetEditMode();
});


async function changeStatus(id, status) {

    await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
    });

    loadTasks();
}


async function deleteTask(id) {

    if (!confirm("Are you sure you want to delete this assignment?")) {
        return;
    }

    await fetch(`/api/tasks/${id}`, {
        method: "DELETE"
    });

    loadTasks();
}


filter.addEventListener("change", showTasks);


document.getElementById("notificationBtn")
    .addEventListener("click", async() => {

        if (!("Notification" in window)) {
            alert("Your browser does not support notifications.");
            return;
        }

        const permission = await Notification.requestPermission();

        alert(permission === "granted" ?
            "Notifications enabled!" :
            "Notification permission was not granted.");
    });


function checkReminders() {

    if (!("Notification" in window) ||
        Notification.permission !== "granted") {
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    tasks.forEach(task => {

        if (task.status === "Completed") return;

        const due = new Date(task.due_date + "T00:00:00");

        const daysLeft = Math.round(
            (due - today) / 86400000
        );

        const reminderDays = Number(task.reminder_days);

        const key = `${task.id}-${task.due_date}`;

        if (daysLeft >= 0 &&
            daysLeft <= reminderDays &&
            !notifiedTasks.has(key)) {

            new Notification("Assignment Reminder", {
                body: `${task.title} (${task.subject}) is due in ${daysLeft} day(s).`
            });

            notifiedTasks.add(key);
        }
    });
}


loadTasks();

setInterval(loadTasks, 60000);