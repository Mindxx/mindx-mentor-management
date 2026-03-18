const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://localhost:3000/' 
    : '/api';
const FIREBASE_API_KEY = 'AIzaSyAh2Au-mk5ci-hN83RUBqj1fsAmCMdvJx4';
const REFRESH_TOKEN = 'AMf-vBwBXmhX2lPscdsBXW7tTWRfpxeOuMzqFL54oaIFptBmJpiIUe7iyGn5ddTiJpGP25_M4t7HFptpYF6jDgDHXfiHO1qJO-b0szZ00qwDjL2AvnrLTa4KkvN_WkkdBO59lM6XtmazBOwNZd2KWOv6jq6BsV1v0ThAagtoyOvs3DKvzTUCSqs';

let ACCESS_TOKEN = null;
let allTeachers = [];
let currentSelectedTeacher = null;
let currentMonth = new Date();

const loader = document.getElementById('loader');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const teachersListDisplay = document.getElementById('teachersListDisplay');
const totalTeachersCount = document.getElementById('totalTeachersCount');
const activeTeachersCount = document.getElementById('activeTeachersCount');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const displayCount = document.getElementById('displayCount');
const totalCount = document.getElementById('totalCount');
const paginationDisplay = document.getElementById('paginationDisplay');
const scheduleModal = document.getElementById('scheduleModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalTeacherName = document.getElementById('modalTeacherName');
const modalTeacherCode = document.getElementById('modalTeacherCode');
const currentMonthDisplay = document.getElementById('currentMonthDisplay');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const modalLoader = document.getElementById('modalLoader');
const modalData = document.getElementById('modalData');
const totalHoursDisplay = document.getElementById('totalHoursDisplay');
const classHoursDisplay = document.getElementById('classHoursDisplay');
const officeHoursDisplay = document.getElementById('officeHoursDisplay');
const sessionsContainer = document.getElementById('sessionsContainer');

// Modal Events
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeScheduleModal);
    scheduleModal.addEventListener('click', (e) => {
        if(e.target === scheduleModal) closeScheduleModal();
    });
    prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    nextMonthBtn.addEventListener('click', () => changeMonth(1));
}

async function refreshAccessToken() {
    try {
        const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=refresh_token&refresh_token=${REFRESH_TOKEN}`
        });
        const data = await res.json();
        if (data.id_token) {
            ACCESS_TOKEN = data.id_token;
            return true;
        } else {
            console.error("Lỗi lấy token mới:", data);
            return false;
        }
    } catch (e) {
        console.error(e);
        return false;
    }
}

// DOM Elements ready
document.addEventListener('DOMContentLoaded', async () => {
    showLoader();
    const isReady = await refreshAccessToken();
    if (!isReady) {
        showError("Không thể làm mới mã xác thực tự động. Vui lòng kiểm tra lại Refresh Token.");
        return;
    }
    
    fetchTeachers();

    refreshBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Add rotation animation to the button icon
        const icon = refreshBtn.querySelector('i');
        icon.style.transform = 'rotate(360deg)';
        icon.style.transition = 'transform 0.5s ease';
        setTimeout(() => {
            icon.style.transform = 'none';
            icon.style.transition = 'none';
        }, 500);
        
        fetchTeachers();
    });

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        filterTeachers(term);
    });
});

async function fetchTeachers() {
    showLoader();
    try {
        const payload = {
            operationName: "GetTeachers",
            variables: {
                type: "OFFSET",
                search: "",
                pageIndex: 0,
                itemsPerPage: 100, // fetch up to 100 to show reasonable amount
                orderBy: "createdAt_desc",
                centers: [],
                teacherPointRange: [null, null],
                joinedDate: [null, null]
            },
            query: `query GetTeachers($search: String, $isActive: Boolean, $courseLine: String, $course: String, $pageIndex: Int!, $itemsPerPage: Int!, $orderBy: String, $idNotIn: [String], $centers: [String], $teacherPointFrom: Float, $teacherPointTo: Float, $joinedDate: [String]) {
              teachers(payload: {searchString_wordSearch: $search, isActive_eq: $isActive, courseLines_eq: $courseLine, courses_eq: $course, id_nin: $idNotIn, pageIndex: $pageIndex, itemsPerPage: $itemsPerPage, orderBy: $orderBy, centres_in: $centers, teacherPoint_gte: $teacherPointFrom, teacherPoint_lte: $teacherPointTo, joinedDate: $joinedDate}) {
                data {
                  id
                  fullName
                  username
                  email
                  phoneNumber
                  code
                  isActive
                  centres {
                    id
                    name
                  }
                }
                pagination {
                  total
                }
              }
            }`
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Lỗi Server: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.errors) {
            throw new Error(data.errors[0].message);
        }

        allTeachers = data.data.teachers.data || [];
        const total = data.data.teachers.pagination.total || allTeachers.length;
        
        renderTeachers(allTeachers);
        updateStats(allTeachers, total);
        hideLoader();
    } catch (err) {
        console.error("Lỗi khi tải dữ liệu giáo viên:", err);
        showError(err.message || 'Không thể kết nối đến MindX LMS API. Token có thể đã hết hạn.');
    }
}

function renderTeachers(teachers) {
    teachersListDisplay.innerHTML = '';
    
    if (teachers.length === 0) {
        teachersListDisplay.innerHTML = `
            <div class="error-container" style="grid-column: 1 / -1; height: 150px;">
                <p>Không tìm thấy giáo viên nào trùng khớp.</p>
            </div>
        `;
        return;
    }

    teachers.forEach((teacher, index) => {
        // Calculate a small animation delay for cascade effect
        const delay = (index % 10) * 0.05;
        
        // Initial letter for avatar
        const initialMap = teacher.fullName ? teacher.fullName.charAt(0).toUpperCase() : '?';
        
        const centersHtml = teacher.centres && teacher.centres.length > 0 
            ? teacher.centres.map(c => `<span class="center-tag">${c.name}</span>`).join('')
            : '<span class="center-tag" style="opacity:0.5">Chưa gắn cơ sở</span>';

        const statusClass = teacher.isActive ? 'status-active' : 'status-inactive';
        const statusText = teacher.isActive ? 'Active' : 'Inactive';

        const card = document.createElement('div');
        card.className = 'teacher-card clickable-card';
        card.style.animationDelay = `${delay}s`;
        card.onclick = () => openScheduleModal(teacher);
        
        card.innerHTML = `
            <div class="teacher-header">
                <div class="teacher-header-info">
                    <div class="teacher-avatar">${initialMap}</div>
                    <div class="teacher-name-wrap">
                        <h3>${teacher.fullName || 'No Name'}</h3>
                        <span class="teacher-code">${teacher.code || teacher.username || 'UNKNOWN'}</span>
                    </div>
                </div>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            
            <div class="teacher-body">
                <div class="info-row">
                    <i class="fa-solid fa-envelope"></i>
                    <span>${teacher.email || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <i class="fa-solid fa-phone"></i>
                    <span>${teacher.phoneNumber || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <i class="fa-solid fa-building"></i>
                    <div class="centers-list">
                        ${centersHtml}
                    </div>
                </div>
            </div>
        `;
        
        teachersListDisplay.appendChild(card);
    });
}

function filterTeachers(term) {
    if (!term) {
        renderTeachers(allTeachers);
        updateDisplayCount(allTeachers.length);
        return;
    }
    
    const filtered = allTeachers.filter(t => {
        const nameMatch = t.fullName && t.fullName.toLowerCase().includes(term);
        const emailMatch = t.email && t.email.toLowerCase().includes(term);
        const codeMatch = t.code && t.code.toLowerCase().includes(term);
        return nameMatch || emailMatch || codeMatch;
    });
    
    renderTeachers(filtered);
    updateDisplayCount(filtered.length);
}

function updateStats(teachers, totalServerCount) {
    const activeCount = teachers.filter(t => t.isActive).length;
    
    // Animate counter upwards
    animateValue(totalTeachersCount, 0, totalServerCount, 1000);
    animateValue(activeTeachersCount, 0, activeCount, 1000);
    
    totalCount.textContent = totalServerCount;
    updateDisplayCount(teachers.length);
    paginationDisplay.style.display = 'block';
}

function updateDisplayCount(count) {
    displayCount.textContent = count;
}

// Visual Utilities
function showLoader() {
    loader.classList.remove('hidden');
    teachersListDisplay.style.display = 'none';
    errorState.classList.add('hidden');
    paginationDisplay.style.display = 'none';
}

function hideLoader() {
    loader.classList.add('hidden');
    teachersListDisplay.style.display = 'grid';
}

function showError(msg) {
    hideLoader();
    teachersListDisplay.style.display = 'none';
    errorState.classList.remove('hidden');
    errorMessage.textContent = msg;
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        // easeOutQuart
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        obj.innerHTML = Math.floor(easeProgress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end;
        }
    };
    window.requestAnimationFrame(step);
}

// Modal Logic
function openScheduleModal(teacher) {
    currentSelectedTeacher = teacher;
    currentMonth = new Date(); // reset to current month
    
    modalTeacherName.textContent = teacher.fullName || 'No Name';
    modalTeacherCode.textContent = teacher.code || teacher.username || '';
    
    updateMonthDisplay();
    scheduleModal.classList.remove('hidden');
    
    fetchTeacherSchedule();
}

function closeScheduleModal() {
    scheduleModal.classList.add('hidden');
    currentSelectedTeacher = null;
}

function changeMonth(delta) {
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    updateMonthDisplay();
    if(currentSelectedTeacher) {
        fetchTeacherSchedule();
    }
}

function updateMonthDisplay() {
    const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
    currentMonthDisplay.textContent = `${monthNames[currentMonth.getMonth()]}, ${currentMonth.getFullYear()}`;
}

async function fetchTeacherSchedule() {
    if(!currentSelectedTeacher) return;
    
    modalLoader.classList.remove('hidden');
    modalData.classList.add('hidden');
    sessionsContainer.innerHTML = '';
    
    try {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        
        const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));
        const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
        
        const payload = {
            operationName: "findTeacherSchedule",
            variables: {
                dateGte: startDate.toISOString(),
                dateLte: endDate.toISOString(),
                type: ["CLASS_SESSION", "OFFICE_HOURS", "AVAILABLE"],
                teacherId: currentSelectedTeacher.id
            },
            query: `query findTeacherSchedule($dateGte: String!, $dateLte: String!, $type: [String], $teacherId: String!, $slotIdNin: [String], $officeHourIdNin: [String]) {
              findTeacherSchedule(payload: {date_gte: $dateGte, date_lte: $dateLte, type_in: $type, teacherId_eq: $teacherId, slotId_nin: $slotIdNin, officeHourId_nin: $officeHourIdNin}) {
                data {
                  id
                  title
                  date
                  startTime
                  endTime
                  type
                  classSite {
                    name
                  }
                  officeHour {
                    type
                  }
                }
              }
            }`
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("API Error");
        
        const data = await response.json();
        const schedules = data?.data?.findTeacherSchedule?.data || [];
        
        calculateAndRenderSchedule(schedules);
        
    } catch (err) {
        console.error("Lỗi khi tải lịch:", err);
        sessionsContainer.innerHTML = '<p style="color:var(--danger)">Lỗi tải dữ liệu lịch dạy</p>';
    } finally {
        modalLoader.classList.add('hidden');
        modalData.classList.remove('hidden');
    }
}

function calculateAndRenderSchedule(schedules) {
    let totalMs = 0;
    let classMs = 0;
    let officeMs = 0;
    
    schedules.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    
    let html = '';
    
    schedules.forEach(session => {
        if(session.type === 'CLASS_SESSION' || session.type === 'OFFICE_HOURS') {
            const start = new Date(session.startTime);
            const end = new Date(session.endTime);
            const diff = end - start;
            
            if(diff > 0) {
                totalMs += diff;
                if(session.type === 'CLASS_SESSION') classMs += diff;
                if(session.type === 'OFFICE_HOURS') officeMs += diff;
            }
            
            const dateStr = start.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'});
            const startStr = start.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
            const endStr = end.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
            
            const hoursDec = (diff / (1000 * 60 * 60)).toFixed(1);
            
            const badgeClass = session.type === 'CLASS_SESSION' ? 'badge-class' : 'badge-office';
            const badgeText = session.type === 'CLASS_SESSION' ? 'Class' : 'Office Hour';
            const title = session.title || (session.classSite ? session.classSite.name : 'Chưa định danh lớp');
            
            html += `
                <div class="session-item">
                    <div class="session-info">
                        <strong>${title}</strong>
                        <span>${dateStr} | ${startStr} - ${endStr} (${hoursDec}h)</span>
                    </div>
                    <span class="session-badge ${badgeClass}">${badgeText}</span>
                </div>
            `;
        }
    });
    
    if(html === '') {
        html = '<p style="color:var(--text-secondary); text-align:center; padding:1rem;">Không có ca dạy nào trong tháng này.</p>';
    }
    
    sessionsContainer.innerHTML = html;
    
    const toHours = (ms) => (ms / (1000 * 60 * 60)).toFixed(1) + 'h';
    
    totalHoursDisplay.textContent = toHours(totalMs);
    classHoursDisplay.textContent = toHours(classMs);
    officeHoursDisplay.textContent = toHours(officeMs);
}
