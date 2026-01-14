// script.js
let routes = [];

// -------- Helper to call backend --------
async function fetchJSON(url, options = {}) {
  const token = localStorage.getItem("userToken");

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}


function getLoggedUser() {
  const role = localStorage.getItem("userRole");
  const token = localStorage.getItem("userToken");
  const userId = localStorage.getItem("userId");

  if (!role || !token || !userId) return null;

  return { role, token, userId };
}







// ===== Booking form (require login as student, show POPUP only) =====
function initBookingForm() {
  const bookingForm = document.getElementById("bookingForm");
  const bookingMessage = document.getElementById("bookingMessage");

  if (!bookingForm || !bookingMessage) return;

  bookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    // clear any old success/error text under the form
    bookingMessage.textContent = "";

   const user = getLoggedUser();
if (!user || user.role !== "Student") {
  showLoginModal();
  return;
}


    try {
      const studentName = document.getElementById("studentName").value.trim();
      const studentId = document.getElementById("studentId").value.trim();
      const routeId = document.getElementById("routeSelect").value;
      const time = document.getElementById("timeSelect").value;

      const res = await fetchJSON("/api/bookings", {
        method: "POST",
        body: JSON.stringify({ studentId, routeId, time }),

      });

      bookingMessage.style.color = "#0a7b28";
      bookingMessage.textContent =
        "Booking confirmed! Booking ID: " + res.booking.id;
      bookingForm.reset();
    } catch (err) {
      bookingMessage.style.color = "#b00020";
      bookingMessage.textContent = err.message;
    }
  });
}



// ===== Tracking (R01 example) =====
async function loadTracking() {
  const title = document.getElementById("trackingRouteTitle");
  const locSpan = document.getElementById("trackingCurrentLocation");
  const etaSpan = document.getElementById("trackingEta");
  const statusSpan = document.getElementById("trackingStatus");

  if (!title || !locSpan) return;

  try {
    const loc = await fetchJSON("/api/location/R01");
    title.textContent = `Shuttle ${loc.routeId} - Main Gate → Faculty of IT`;
    locSpan.textContent = loc.currentLocation || "Unknown";
    etaSpan.textContent = loc.etaMinutes
      ? `${loc.etaMinutes} minutes`
      : "Unknown";
    statusSpan.textContent = loc.status || "Unknown";
  } catch (err) {
    locSpan.textContent = "No live location yet.";
    etaSpan.textContent = "-";
    statusSpan.textContent = "-";
  }
}

// ===== Dashboard (simple summary) =====
async function loadDashboardSummary() {
  const summaryRow = document.createElement("tr");
  try {
    const data = await fetchJSON("/api/dashboard-summary");
    summaryRow.innerHTML = `
      <td colspan="5">
        Total Routes: ${data.totalRoutes} | 
        Total Bookings: ${data.totalBookings} | 
        Total Incidents: ${data.totalIncidents}
      </td>
    `;
  } catch (err) {
    summaryRow.innerHTML = `<td colspan="5">Dashboard summary unavailable.</td>`;
  }
  const adminBody = document.getElementById("adminRoutesBody");
  if (adminBody) adminBody.appendChild(summaryRow);
}
function showLoginModal() {
  const modal = document.getElementById("loginModal");
  if (modal) modal.classList.remove("hidden");
}

function initLoginModal() {
  const modal = document.getElementById("loginModal");
  const btn = document.getElementById("loginModalBtn");
  if (!modal || !btn) return;

  btn.addEventListener("click", () => {
    modal.classList.add("hidden");

    // scroll user to login section
    const loginSection = document.getElementById("login");
    if (loginSection) {
      loginSection.scrollIntoView({ behavior: "smooth" });
    }
  });
}
function initMMUMap() {
  if (typeof L === "undefined") return; 

  const mmuCoords = [2.92523, 101.64041];

  const map = L.map("mmuMap").setView(mmuCoords, 17);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(map);

  L.marker(mmuCoords)
    .addTo(map)
    .bindPopup("Shuttle Live Location")
    .openPopup();
}




async function loadMyBookings() {
  const tbody = document.getElementById("myBookingsBody");
  if (!tbody) return;

  const user = getLoggedUser();
  if (!user || user.role !== "Student") {
    tbody.innerHTML = `<tr><td colspan="5">Login as student to view bookings.</td></tr>`;
    return;
  }

  try {
    const data = await fetchJSON(`/api/bookings?studentId=${user.userId}`);
    tbody.innerHTML = "";
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">Error loading bookings</td></tr>`;
  }
}


async function cancelBooking(id) {
  if (!confirm("Are you sure you want to cancel this booking?")) return;

  try {
    await fetchJSON(`/api/bookings/${id}`, {
      method: "DELETE",
    });

    alert("Booking cancelled.");
    loadMyBookings(); // refresh table
  } catch (err) {
    alert("Failed to cancel booking: " + err.message);
  }
}

async function loadRoutes() {
  const tbody =
    document.getElementById("coordinatorRoutesBody") ||
    document.getElementById("adminRoutesBody");

  if (!tbody) return;

  try {
    routes = await fetchJSON("/api/routes");

    const deleteBtn = document.getElementById("deleteSelectedBtn");
    const selectAll = document.getElementById("selectAllRoutes");

    tbody.innerHTML = "";

    // hide bulk delete by default (admin page safety)
    if (deleteBtn) {
      deleteBtn.style.display = "none";
      deleteBtn.disabled = true;
    }

    routes.forEach(route => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="checkbox" class="routeCheckbox" value="${route.id}"></td>
        <td>${route.id}</td>
        <td>${route.from}</td>
        <td>${route.to}</td>
        <td>${route.departure}</td>
        <td>${route.driver}</td>
        <td>
          <button class="btn-small btn-edit" onclick="editRoute('${route.id}')">Edit</button>
          <button class="btn-small btn-delete" onclick="deleteRoute('${route.id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // ✅ BULK DELETE LOGIC — ONLY IF COORDINATOR UI EXISTS
    if (deleteBtn && selectAll) {
      tbody.addEventListener("change", () => {
        const checked = document.querySelectorAll(".routeCheckbox:checked");

        if (checked.length >= 2) {
          deleteBtn.style.display = "inline-block";
          deleteBtn.disabled = false;
        } else {
          deleteBtn.style.display = "none";
          deleteBtn.disabled = true;
        }
      });

      selectAll.onclick = () => {
        const all = document.querySelectorAll(".routeCheckbox");
        all.forEach(cb => (cb.checked = selectAll.checked));

        const checked = document.querySelectorAll(".routeCheckbox:checked");
        if (checked.length >= 2) {
          deleteBtn.style.display = "inline-block";
          deleteBtn.disabled = false;
        } else {
          deleteBtn.style.display = "none";
          deleteBtn.disabled = true;
        }
      };
    }

  } catch (err) {
    console.error("loadRoutes error:", err);
  }
}




// ================================
// COORDINATOR: LOAD DRIVERS
// ================================
async function loadDriversForCoordinator() {
  console.log("🚀 loadDriversForCoordinator called");

  const driverSelect = document.getElementById("driverSelect");
  if (!driverSelect) {
    console.log("❌ driverSelect not found");
    return;
  }

  driverSelect.length = 1;

  try {
    const drivers = await fetchJSON("/api/drivers");
    console.log("✅ drivers from API:", drivers);

    drivers.forEach(driver => {
      const option = document.createElement("option");
      option.value = driver.userId;
      option.textContent = `${driver.userId} - ${driver.name}`;
      driverSelect.appendChild(option);
    });

  } catch (err) {
    console.error("❌ Error loading drivers:", err);
  }
}
function initCreateRouteForm() {
  const form = document.getElementById("createRouteForm");
  const msg = document.getElementById("createRouteMessage");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.textContent = "";

    const from = document.getElementById("fromLocation").value;
    const to = document.getElementById("toLocation").value;
    const driverId = document.getElementById("driverSelect").value;
    const departure = document.getElementById("departureTime").value;

    if (!from || !to || !driverId || !departure) {
      if (msg) {
        msg.style.color = "red";
        msg.textContent = "Please fill in all fields.";
      }
      return;
    }

    try {
      const isEdit = !!window.editingRouteId;
      const editedId = window.editingRouteId;

      let url = "/api/routes";
      let method = "POST";

      if (isEdit) {
        url = `/api/routes/${editedId}`;
        method = "PUT";
      }

      await fetchJSON(url, {
        method,
        body: JSON.stringify({ from, to, departure, driverId })
      });

     showSuccessModal(
  isEdit ? "Route Updated ✅" : "Route Created ✅",
  isEdit
    ? `Route ${editedId} updated successfully.`
    : `Route assigned to ${driverId} (${from} → ${to}) at ${departure}`
);


      // reset edit state
      window.editingRouteId = null;

      // reset button
      const submitBtn = document.querySelector(
        "#createRouteForm button[type='submit']"
      );
      submitBtn.textContent = "Create Route";

      form.reset();
      loadRoutes();

    } catch (err) {
      if (msg) {
        msg.style.color = "red";
        msg.textContent = err.message;
      }
    }
  });
}


function showSuccessModal(title, text) {
  const modal = document.getElementById("successModal");
  const t = document.getElementById("successTitle");
  const p = document.getElementById("successText");
  const btn = document.getElementById("successOkBtn");

  if (!modal || !t || !p || !btn) return;

  t.textContent = title || "Success ✅";
  p.textContent = text || "Done.";
  modal.classList.remove("hidden");

  btn.onclick = () => modal.classList.add("hidden");
}

async function loadDriverRoute() {
  const user = getLoggedUser();
  if (!user || user.role !== "Driver") return;

  try {
    const route = await fetchJSON(`/api/driver/my-route/${user.userId}`);

    if (!route) {
      document.getElementById("driverRouteId").textContent = "No route assigned";
      document.getElementById("driverFrom").textContent = "-";
      document.getElementById("driverTo").textContent = "-";
      document.getElementById("driverDeparture").textContent = "-";
      return;
    }

    document.getElementById("driverRouteId").textContent = route.routeId;
    document.getElementById("driverFrom").textContent = route.from;
    document.getElementById("driverTo").textContent = route.to;
    document.getElementById("driverDeparture").textContent = route.departure;

  } catch (err) {
    console.error("Driver route error", err);
  }
}
// =====================
// DELETE ROUTE
// =====================
function deleteRoute(routeId) {
  showConfirmModal(
    "Delete Route",
    `Are you sure you want to delete route ${routeId}?`,
    async () => {
      await fetchJSON(`/api/routes/${routeId}`, { method: "DELETE" });
      loadRoutes();
      showSuccessModal("Deleted ✅", `Route ${routeId} deleted successfully.`);
    }
  );
}






// =====================
// EDIT ROUTE
// =====================
function editRoute(routeId) {
  const route = routes.find(route => route.id === routeId);
  if (!route) {
    alert("Route not found");
    return;
  }

  document.getElementById("fromLocation").value = route.from;
  document.getElementById("toLocation").value = route.to;
  document.getElementById("departureTime").value = route.departure;
  document.getElementById("driverSelect").value = route.driver;

  window.editingRouteId = routeId;

  const submitBtn = document.querySelector(
    "#createRouteForm button[type='submit']"
  );
  submitBtn.textContent = "Update Route";
}


// ==============================
// ADMIN PROFILE (LOAD + SAVE)
// ==============================

// Load admin profile
async function loadAdminProfile() {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("userRole");

  if (role !== "Admin" || !userId) return;

  try {
    const data = await fetchJSON(`/api/admin/profile/${userId}`);

    document.getElementById("adminName").value = data.fullName;
    document.getElementById("adminPhone").value = data.phone;
    document.getElementById("adminEmail").value = data.email;
    document.getElementById("adminOffice").value = data.office;
    document.getElementById("adminEmergency").value = data.emergencyContact;

  } catch (err) {
    console.error("Failed to load admin profile");
  }
}

// Save admin profile
function initAdminProfileForm() {
  const form = document.getElementById("adminProfileForm");
  const msg = document.getElementById("adminProfileMsg");
  const editBtn = document.getElementById("editProfileBtn");

  if (!form || !editBtn) return;

  let isEditing = false;

  const fields = [
    "adminName",
    "adminPhone",
    "adminEmail",
    "adminOffice",
    "adminEmergency"
  ];

  editBtn.addEventListener("click", async () => {
    // ENTER EDIT MODE
    if (!isEditing) {
      fields.forEach(id => {
        document.getElementById(id).disabled = false;
      });

      editBtn.textContent = "Save Changes";
      isEditing = true;
      msg.textContent = "";
      return;
    }

    // SAVE MODE
    const userId = localStorage.getItem("userId");

    try {
      await fetchJSON(`/api/admin/profile/${userId}`, {
        method: "PUT",
        body: JSON.stringify({
          fullName: document.getElementById("adminName").value,
          phone: document.getElementById("adminPhone").value,
          email: document.getElementById("adminEmail").value,
          office: document.getElementById("adminOffice").value,
          emergencyContact: document.getElementById("adminEmergency").value
        })
      });

      fields.forEach(id => {
        document.getElementById(id).disabled = true;
      });

      editBtn.textContent = "Edit Profile";
      msg.style.color = "green";
      msg.textContent = "Profile updated successfully";
      isEditing = false;

    } catch (err) {
      msg.style.color = "red";
      msg.textContent = "Failed to update profile";
    }
  });
}


function initAdminCreateUserForm() {
  const form = document.getElementById("createUserForm");
  const msg = document.getElementById("createUserMessage");

  if (!form || !msg) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("createName").value.trim();
    const userId = document.getElementById("createUserId").value.trim();
    const password = document.getElementById("createPassword").value.trim();
    const role = document.getElementById("createRole").value;

    msg.textContent = "";

    if (!name || !userId || !password || !role) {
      msg.textContent = "Please fill in all fields.";
      msg.style.color = "red";
      return;
    }

    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, userId, password, role })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        msg.textContent = data.message || "Failed to create user.";
        msg.style.color = "red";
        return;
      }

      msg.textContent = data.message;
      msg.style.color = "green";
      form.reset();
      

    } catch {
      msg.textContent = "Server error";
      msg.style.color = "red";
    }
    // refresh Manage Users if admin is on that tab
const manageUsers = document.getElementById("manageUsers");
if (manageUsers && !manageUsers.classList.contains("hidden")) {
  loadUserManagement();
}


  });
}
function initBulkDeleteRoutes() {
  const deleteBtn = document.getElementById("deleteSelectedBtn");
  if (!deleteBtn) return;

  deleteBtn.addEventListener("click", () => {
    const checked = document.querySelectorAll(".routeCheckbox:checked");
    if (checked.length < 2) return; // your rule: only 2+

    showConfirmModal(
      "Delete Selected Routes",
      `Are you sure you want to delete ${checked.length} selected routes?`,
      async () => {
        for (const cb of checked) {
          await fetchJSON(`/api/routes/${cb.value}`, { method: "DELETE" });
        }
        loadRoutes();
        showSuccessModal("Deleted ✅", `${checked.length} routes deleted successfully.`);
      }
    );
  });
}


function initAdminTabs() {
  const links = document.querySelectorAll("nav a[data-section]");
  if (!links.length) return;

  links.forEach(link => {
    link.addEventListener("click", async (e) => {
      e.preventDefault();

      const target = link.dataset.section;

      // hide all
      document.querySelectorAll(".admin-section").forEach(sec => {
        sec.classList.add("hidden");
      });

      // show selected
      const el = document.getElementById(target);
      if (el) el.classList.remove("hidden");

   if (target === "manageUsers") {
  loadUserManagement();
}


    });
  });
}





// ==============================
// ADMIN – USER MANAGEMENT (NEW)
// ==============================
async function loadUserManagement() {
  const studentsBody = document.getElementById("studentsBody");
  const driversBody = document.getElementById("driversBody");
  const coordinatorsBody = document.getElementById("coordinatorsBody");

  if (!studentsBody || !driversBody || !coordinatorsBody) return;

  studentsBody.innerHTML = "";
  driversBody.innerHTML = "";
  coordinatorsBody.innerHTML = "";

  try {
    const users = await fetchJSON("/api/admin/users");

    users.forEach(u => {
      if (u.role === "Student") {
        studentsBody.innerHTML += `
          <tr>
            <td>${u.userId}</td>
            <td>${u.fullName}</td>
          </tr>`;
      }

      if (u.role === "Driver") {
        driversBody.innerHTML += `
          <tr>
            <td>${u.userId}</td>
            <td>${u.fullName}</td>
            <td>
              <button class="btn-icon" onclick="editUser('${u.userId}')">✏️</button>
            </td>
          </tr>`;
      }

      if (u.role === "Coordinator") {
        coordinatorsBody.innerHTML += `
          <tr>
            <td>${u.userId}</td>
            <td>${u.fullName}</td>
            <td>
              <button class="btn-icon" onclick="editUser('${u.userId}')">✏️</button>
            </td>
          </tr>`;
      }
    });
  } catch (err) {
    console.error("Failed to load users:", err.message);
  }
  
}
function editUser(userId) {
  window.location.href = `admin-edit-user.html?id=${userId}`;
}



// ==============================
// ADMIN – EDIT USER PAGE
// ==============================
function initEditUserPage() {
  const form = document.getElementById("editUserForm");
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const userId = params.get("id");

  const userIdInput = document.getElementById("editUserId");
  const nameInput = document.getElementById("editFullName");
  const roleSelect = document.getElementById("editRole");
  const passwordInput = document.getElementById("editPassword");
  const msg = document.getElementById("editUserMsg");

  // LOAD USER DETAILS
  fetchJSON(`/api/admin/users/${userId}`)
    .then(user => {
      userIdInput.value = user.userId;
      nameInput.value = user.fullName;
      roleSelect.value = user.role;
    })
    .catch(() => {
      msg.style.color = "red";
      msg.textContent = "Failed to load user.";
    });

  // SAVE CHANGES
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    const payload = {
      fullName: nameInput.value.trim(),
      role: roleSelect.value
    };

    if (passwordInput.value.trim()) {
      payload.password = passwordInput.value.trim();
    }

    try {
      await fetchJSON(`/api/admin/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      msg.style.color = "green";
      msg.textContent = "User updated successfully ✅";
    } catch (err) {
      msg.style.color = "red";
      msg.textContent = err.message;
    }
  });

  // DELETE USER
  const deleteBtn = document.getElementById("deleteUserBtn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Are you sure you want to delete this user?")) return;

      try {
        await fetchJSON(`/api/admin/users/${userId}`, {
          method: "DELETE"
        });

        alert("User deleted successfully");
        window.location.href = "admin.html";
      } catch (err) {
        msg.style.color = "red";
        msg.textContent = err.message;
      }
    });
  }
}



document.addEventListener("DOMContentLoaded", () => {

  // Hide all admin sections first
  document.querySelectorAll(".admin-section").forEach(sec => {
    sec.classList.add("hidden");
  });

  // Show dashboard by default
  const dashboard = document.getElementById("dashboard");
  if (dashboard) dashboard.classList.remove("hidden");

  // Admin tab navigation
  initAdminTabs();

  // Other features (safe to call)
  loadRoutes();
  initBookingForm();
  loadMyBookings();
  initMMUMap();
  if (document.getElementById("driverSelect")) loadDriversForCoordinator();
  initCreateRouteForm();
  loadDriverRoute();
  loadAdminProfile();
  initAdminProfileForm();
  initAdminCreateUserForm();
  initBulkDeleteRoutes();
});
