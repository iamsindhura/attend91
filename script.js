/**
 * AttendSafe — Smart Attendance Tracker
 * 
 * Strict > 90% attendance rules and exact integer arithmetic.
 * Formulas:
 *   Attendance % = (Attended / Conducted) * 100
 *   Strictly above 90% condition: 10 * Attended > 9 * Conducted
 *   Safe skip: Max future classes X such that 10 * A > 9 * (C + X)
 *   X = Math.floor((10 * A - 9 * C - 1) / 9) when 10 * A > 9 * C, else 0.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'attendsafe_data_v1';

  // State
  let subjects = [];
  let subjectToDeleteId = null;
  let subjectToEditId = null;

  // DOM Elements - Overall
  const overallPercentageEl = document.getElementById('overallPercentage');
  const overallStatusEl = document.getElementById('overallStatus');
  const overallAttendedEl = document.getElementById('overallAttended');
  const overallConductedEl = document.getElementById('overallConducted');
  const overallCanSkipEl = document.getElementById('overallCanSkip');
  const overallSkipContainer = document.getElementById('overallSkipContainer');
  const subjectCountPill = document.getElementById('subjectCountPill');

  // DOM Elements - Subjects Section
  const emptyStateEl = document.getElementById('emptyState');
  const subjectsGridEl = document.getElementById('subjectsGrid');

  // DOM Elements - Add Subject Modal
  const openAddSubjectBtn = document.getElementById('openAddSubjectBtn');
  const emptyAddBtn = document.getElementById('emptyAddBtn');
  const addSubjectModal = document.getElementById('addSubjectModal');
  const closeAddModalBtn = document.getElementById('closeAddModalBtn');
  const cancelAddModalBtn = document.getElementById('cancelAddModalBtn');
  const addSubjectForm = document.getElementById('addSubjectForm');
  const subjectNameInput = document.getElementById('subjectNameInput');
  const attendedInput = document.getElementById('attendedInput');
  const conductedInput = document.getElementById('conductedInput');
  const modalAttendedMinus = document.getElementById('modalAttendedMinus');
  const modalAttendedPlus = document.getElementById('modalAttendedPlus');
  const modalConductedMinus = document.getElementById('modalConductedMinus');
  const modalConductedPlus = document.getElementById('modalConductedPlus');

  // DOM Elements - Edit Subject Modal
  const editSubjectModal = document.getElementById('editSubjectModal');
  const closeEditModalBtn = document.getElementById('closeEditModalBtn');
  const cancelEditModalBtn = document.getElementById('cancelEditModalBtn');
  const editSubjectForm = document.getElementById('editSubjectForm');
  const editSubjectNameInput = document.getElementById('editSubjectNameInput');
  const editNameErrorMsg = document.getElementById('editNameErrorMsg');
  const editAttendedInput = document.getElementById('editAttendedInput');
  const editConductedInput = document.getElementById('editConductedInput');
  const editModalAttendedMinus = document.getElementById('editModalAttendedMinus');
  const editModalAttendedPlus = document.getElementById('editModalAttendedPlus');
  const editModalConductedMinus = document.getElementById('editModalConductedMinus');
  const editModalConductedPlus = document.getElementById('editModalConductedPlus');
  const editAttendedErrorMsg = document.getElementById('editAttendedErrorMsg');
  const editConductedErrorMsg = document.getElementById('editConductedErrorMsg');
  const editFormGeneralError = document.getElementById('editFormGeneralError');

  // Error Message Elements
  const nameErrorMsg = document.getElementById('nameErrorMsg');
  const attendedErrorMsg = document.getElementById('attendedErrorMsg');
  const conductedErrorMsg = document.getElementById('conductedErrorMsg');
  const formGeneralError = document.getElementById('formGeneralError');

  // DOM Elements - Delete Modal
  const deleteModal = document.getElementById('deleteModal');
  const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const deleteConfirmText = document.getElementById('deleteConfirmText');

  /* ==========================================================================
     MATHEMATICAL CALCULATIONS (Strictly Above 91%)
     ========================================================================== */

  const TARGET_PERCENT = 91;

  /**
   * Calculates attendance percentage.
   * Returns null if conducted === 0.
   */
  function calcPercentage(attended, conducted) {
    if (conducted === 0) return null;
    return (attended / conducted) * 100;
  }

  /**
   * Formats attendance percentage to exactly 2 decimal places.
   */
  function formatPercentage(percentage) {
    if (percentage === null || isNaN(percentage)) return '--%';
    return percentage.toFixed(2) + '%';
  }

  /**
   * Calculates maximum future classes that can be skipped
   * while keeping attendance STRICTLY above 91%.
   * 
   * Condition: Attended / (Conducted + X) > 0.91
   * Equivalent in integers: 100 * Attended > 91 * (Conducted + X)
   * 91 * X < 100 * Attended - 91 * Conducted
   * 
   * When 100 * A - 91 * C <= 0: Cannot skip any classes (already <= 91%). Returns 0.
   * When 100 * A - 91 * C > 0:
   *   Max integer X strictly less than (100A - 91C)/91 is Math.floor((100A - 91C - 1) / 91).
   */
  function calcSafeSkip(attended, conducted) {
    if (conducted === 0 || attended === 0) return 0;
    
    const margin = 100 * attended - 91 * conducted;
    if (margin <= 0) return 0;

    const skipCount = Math.floor((margin - 1) / 91);
    return Math.max(0, skipCount);
  }

  /**
   * Determines status badge properties.
   * - Neutral: Conducted = 0
   * - Below Target: Attendance <= 91.00% (100 * A <= 91 * C)
   * - Warning: Attendance > 91.00% but near boundary (percentage <= 92.5% and canSkip === 0)
   * - Safe: Attendance comfortably > 91.00%
   */
  function getAttendanceStatus(attended, conducted, canSkip) {
    if (conducted === 0) {
      return {
        className: 'status-neutral',
        icon: '⚪',
        label: 'No Data',
        ariaText: 'No data recorded yet'
      };
    }

    // 100 * attended <= 91 * conducted means attendance <= 91.00%
    const isStrictlyAbove91 = (100 * attended) > (91 * conducted);

    if (!isStrictlyAbove91) {
      return {
        className: 'status-danger',
        icon: '🔴',
        label: 'Below Target',
        ariaText: 'Below target attendance of 91%'
      };
    }

    // Attendance is strictly > 91%
    const pct = (attended / conducted) * 100;
    // Warning state when attendance is near 91% or has no safe skip buffer
    if (canSkip === 0 && pct <= 92.5) {
      return {
        className: 'status-warning',
        icon: '🟡',
        label: 'Warning',
        ariaText: 'Warning: near 91% target with no safe skip buffer'
      };
    }

    return {
      className: 'status-safe',
      icon: '🟢',
      label: 'Safe',
      ariaText: 'Safe attendance strictly above 91%'
    };
  }

  /**
   * Helper to format class count with proper singular/plural grammar.
   */
  function formatClassesLabel(count) {
    if (count === 1) return '1 class';
    return `${count} classes`;
  }

  /* ==========================================================================
     LOCAL STORAGE & DATA PERSISTENCE
     ========================================================================== */

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          subjects = parsed.map(s => ({
            id: s.id || generateId(),
            name: String(s.name || '').trim(),
            attended: Math.max(0, parseInt(s.attended, 10) || 0),
            conducted: Math.max(0, parseInt(s.conducted, 10) || 0)
          })).filter(s => s.name.length > 0 && s.attended <= s.conducted);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to parse localStorage data:', e);
    }
    subjects = [];
  }

  function saveData() {
    try {
      // Store ONLY name, attended, conducted, and id as mandated
      const dataToSave = subjects.map(s => ({
        id: s.id,
        name: s.name,
        attended: s.attended,
        conducted: s.conducted
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      console.error('Failed to save data to localStorage:', e);
    }
  }

  function generateId() {
    return 'subj_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  }

  /* ==========================================================================
     DASHBOARD RE-CALCULATION & RENDERING
     ========================================================================== */

  function updateDashboard() {
    // 1. Calculate overall metrics
    const totalSubjects = subjects.length;
    subjectCountPill.textContent = totalSubjects === 1 ? '1 subject' : `${totalSubjects} subjects`;

    if (totalSubjects === 0) {
      // Empty State Display
      overallPercentageEl.textContent = '--%';
      overallPercentageEl.style.color = 'var(--text-primary)';
      overallStatusEl.className = 'status-badge status-neutral';
      overallStatusEl.innerHTML = '<span class="status-icon">⚪</span><span class="status-text">No Data</span>';
      overallAttendedEl.textContent = '0';
      overallConductedEl.textContent = '0';
      overallCanSkipEl.textContent = '--';
      overallSkipContainer.className = 'overall-skip-box';

      emptyStateEl.style.display = 'block';
      subjectsGridEl.innerHTML = '';
      return;
    }

    emptyStateEl.style.display = 'none';

    // Calculate sums strictly across all subjects
    let totalAttended = 0;
    let totalConducted = 0;

    subjects.forEach(s => {
      totalAttended += s.attended;
      totalConducted += s.conducted;
    });

    overallAttendedEl.textContent = totalAttended;
    overallConductedEl.textContent = totalConducted;

    const overallPct = calcPercentage(totalAttended, totalConducted);
    const overallSkip = calcSafeSkip(totalAttended, totalConducted);
    const overallStatus = getAttendanceStatus(totalAttended, totalConducted, overallSkip);

    overallPercentageEl.textContent = formatPercentage(overallPct);
    overallStatusEl.className = `status-badge ${overallStatus.className}`;
    overallStatusEl.innerHTML = `<span class="status-icon">${overallStatus.icon}</span><span class="status-text">${overallStatus.label}</span>`;
    overallStatusEl.setAttribute('aria-label', overallStatus.ariaText);

    if (totalConducted === 0) {
      overallCanSkipEl.textContent = '--';
      overallPercentageEl.style.color = 'var(--text-primary)';
      overallSkipContainer.className = 'overall-skip-box';
    } else {
      overallCanSkipEl.textContent = formatClassesLabel(overallSkip);
      
      // Visual styling for overall card based on status
      if (overallStatus.className === 'status-safe') {
        overallPercentageEl.style.color = 'var(--safe-color)';
        overallSkipContainer.className = 'overall-skip-box skip-safe';
      } else if (overallStatus.className === 'status-warning') {
        overallPercentageEl.style.color = 'var(--warning-color)';
        overallSkipContainer.className = 'overall-skip-box';
      } else {
        overallPercentageEl.style.color = 'var(--danger-color)';
        overallSkipContainer.className = 'overall-skip-box skip-danger';
      }
    }

    // 2. Render Subject Cards
    renderSubjectCards();
  }

  function renderSubjectCards() {
    subjectsGridEl.innerHTML = '';

    subjects.forEach(subject => {
      const card = document.createElement('article');
      card.className = 'subject-card';
      card.setAttribute('data-id', subject.id);

      const pct = calcPercentage(subject.attended, subject.conducted);
      const skip = calcSafeSkip(subject.attended, subject.conducted);
      const status = getAttendanceStatus(subject.attended, subject.conducted, skip);

      // Condition: Attended cannot exceed Conducted
      // If attended >= conducted, the Attended + button must be disabled
      const isAttendedMaxed = subject.attended >= subject.conducted;

      card.innerHTML = `
        <div class="subject-card-top">
          <div class="subject-card-header">
            <h3 class="subject-name">${escapeHtml(subject.name)}</h3>
            <div class="card-actions-group">
              <button 
                type="button" 
                class="btn-card-action btn-card-edit" 
                data-action="edit" 
                data-id="${subject.id}" 
                data-name="${escapeHtml(subject.name)}"
                title="Edit ${escapeHtml(subject.name)} name"
                aria-label="Edit ${escapeHtml(subject.name)} name"
              >
                ✏️
              </button>
              <button 
                type="button" 
                class="btn-card-action btn-card-delete" 
                data-action="delete" 
                data-id="${subject.id}" 
                data-name="${escapeHtml(subject.name)}"
                title="Delete ${escapeHtml(subject.name)}"
                aria-label="Delete ${escapeHtml(subject.name)}"
              >
                🗑️
              </button>
            </div>
          </div>

          <div class="subject-attendance-block">
            <div class="subject-attendance-meta">Attendance</div>
            <div class="subject-pct-row">
              <span class="subject-percentage" style="color: ${getPctColor(status.className)}">
                ${formatPercentage(pct)}
              </span>
              <span class="status-badge ${status.className}" aria-label="${status.ariaText}">
                <span class="status-icon">${status.icon}</span>
                <span class="status-text">${status.label}</span>
              </span>
            </div>
          </div>

          <div class="subject-counters-block">
            <!-- Classes Attended Row -->
            <div class="counter-row">
              <div class="counter-info">
                <span class="counter-label">Classes Attended</span>
                <span class="counter-count">${subject.attended}</span>
              </div>
              <div class="counter-btn-group">
                <button 
                  type="button" 
                  class="btn-ctrl btn-minus btn-attended-minus" 
                  data-action="decrement-attended" 
                  data-id="${subject.id}"
                  ${subject.attended === 0 ? 'disabled' : ''}
                  title="Undo attended class (-1 attended, -1 conducted)"
                  aria-label="Decrease attended classes for ${escapeHtml(subject.name)}"
                >
                  -
                </button>
                <button 
                  type="button" 
                  class="btn-ctrl btn-plus btn-attended-plus" 
                  data-action="increment-attended" 
                  data-id="${subject.id}"
                  title="Attended class (+1 attended, +1 conducted)"
                  aria-label="Increase attended classes for ${escapeHtml(subject.name)}"
                >
                  +
                </button>
              </div>
            </div>

            <!-- Classes Conducted Row -->
            <div class="counter-row">
              <div class="counter-info">
                <span class="counter-label">Classes Conducted</span>
                <span class="counter-count">${subject.conducted}</span>
              </div>
              <div class="counter-btn-group">
                <button 
                  type="button" 
                  class="btn-ctrl btn-minus btn-conducted-minus" 
                  data-action="decrement-conducted" 
                  data-id="${subject.id}"
                  ${subject.conducted <= subject.attended ? 'disabled' : ''}
                  title="${subject.conducted <= subject.attended ? 'Conducted cannot be less than Attended' : 'Undo skipped class (-1 conducted only)'}"
                  aria-label="Decrease conducted classes for ${escapeHtml(subject.name)}"
                >
                  -
                </button>
                <button 
                  type="button" 
                  class="btn-ctrl btn-plus btn-conducted-plus" 
                  data-action="increment-conducted" 
                  data-id="${subject.id}"
                  title="Skipped class (+1 conducted only)"
                  aria-label="Increase conducted classes for ${escapeHtml(subject.name)}"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="subject-card-footer">
          <div class="subject-skip-pill">
            <span class="subject-skip-label">Can Skip:</span>
            <span class="subject-skip-val">${formatClassesLabel(skip)}</span>
          </div>
          <div class="subject-target-row">
            <span>Target: Above 91%</span>
          </div>
          <button 
            type="button" 
            class="btn btn-danger btn-card-bottom-delete" 
            data-action="delete" 
            data-id="${subject.id}" 
            data-name="${escapeHtml(subject.name)}"
          >
            Delete Subject
          </button>
        </div>
      `;

      subjectsGridEl.appendChild(card);
    });
  }

  function getPctColor(statusClassName) {
    if (statusClassName === 'status-safe') return 'var(--safe-color)';
    if (statusClassName === 'status-warning') return 'var(--warning-color)';
    if (statusClassName === 'status-danger') return 'var(--danger-color)';
    return 'var(--text-primary)';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ==========================================================================
     INTERACTIONS & PLUS/MINUS BUTTON HANDLERS
     ========================================================================== */

  // Event Delegation for Subject Card Buttons
  subjectsGridEl.addEventListener('click', function (e) {
    const btn = e.target.closest('button');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!id || !action) return;

    const subject = subjects.find(s => s.id === id);
    if (!subject) return;

    if (action === 'increment-attended') {
      // Attending a class increases BOTH attended and conducted by 1
      subject.attended += 1;
      subject.conducted += 1;
      saveData();
      updateDashboard();
    } else if (action === 'decrement-attended') {
      // Undoing attended class decreases both attended and conducted by 1
      if (subject.attended > 0 && subject.conducted > 0) {
        subject.attended -= 1;
        subject.conducted -= 1;
        saveData();
        updateDashboard();
      }
    } else if (action === 'increment-conducted') {
      // Skipping a class increases ONLY conducted by 1
      subject.conducted += 1;
      saveData();
      updateDashboard();
    } else if (action === 'decrement-conducted') {
      // Undoing skipped class decreases conducted by 1 (only if conducted > attended)
      if (subject.conducted > subject.attended) {
        subject.conducted -= 1;
        saveData();
        updateDashboard();
      }
    } else if (action === 'edit') {
      openEditModal(subject);
    } else if (action === 'delete') {
      openDeleteModal(subject.id, subject.name);
    }
  });

  /* ==========================================================================
     ADD SUBJECT MODAL & VALIDATION
     ========================================================================== */

  function openAddModal() {
    clearModalErrors();
    subjectNameInput.value = '';
    attendedInput.value = '0';
    conductedInput.value = '0';
    addSubjectModal.removeAttribute('hidden');
    subjectNameInput.focus();
  }

  function closeAddModal() {
    addSubjectModal.setAttribute('hidden', '');
    clearModalErrors();
  }

  function clearModalErrors() {
    nameErrorMsg.textContent = '';
    attendedErrorMsg.textContent = '';
    conductedErrorMsg.textContent = '';
    formGeneralError.textContent = '';
    formGeneralError.classList.remove('visible');
    subjectNameInput.style.borderColor = '';
    attendedInput.style.borderColor = '';
    conductedInput.style.borderColor = '';
  }

  // Modal Counter Buttons
  modalAttendedMinus.addEventListener('click', () => {
    let val = parseInt(attendedInput.value, 10) || 0;
    if (val > 0) {
      attendedInput.value = val - 1;
      validateFormInputsSilently();
    }
  });

  modalAttendedPlus.addEventListener('click', () => {
    let val = parseInt(attendedInput.value, 10) || 0;
    attendedInput.value = val + 1;
    validateFormInputsSilently();
  });

  modalConductedMinus.addEventListener('click', () => {
    let val = parseInt(conductedInput.value, 10) || 0;
    if (val > 0) {
      conductedInput.value = val - 1;
      validateFormInputsSilently();
    }
  });

  modalConductedPlus.addEventListener('click', () => {
    let val = parseInt(conductedInput.value, 10) || 0;
    conductedInput.value = val + 1;
    validateFormInputsSilently();
  });

  function validateFormInputsSilently() {
    // Simple inline clear
    clearModalErrors();
  }

  // Add Subject Form Submission & Validation
  addSubjectForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearModalErrors();

    const name = subjectNameInput.value.trim();
    const attendedRaw = attendedInput.value.trim();
    const conductedRaw = conductedInput.value.trim();

    let hasError = false;

    // 1. Validate Subject Name
    if (!name) {
      nameErrorMsg.textContent = 'Subject name is required.';
      subjectNameInput.style.borderColor = 'var(--danger-color)';
      hasError = true;
    } else {
      // Check for duplicate names (case-insensitive)
      const duplicate = subjects.some(s => s.name.toLowerCase() === name.toLowerCase());
      if (duplicate) {
        nameErrorMsg.textContent = 'A subject with this name already exists.';
        subjectNameInput.style.borderColor = 'var(--danger-color)';
        hasError = true;
      }
    }

    // 2. Validate Attended
    const attended = parseInt(attendedRaw, 10);
    if (attendedRaw === '' || isNaN(attended) || attended < 0) {
      attendedErrorMsg.textContent = 'Enter a valid non-negative number.';
      attendedInput.style.borderColor = 'var(--danger-color)';
      hasError = true;
    }

    // 3. Validate Conducted
    const conducted = parseInt(conductedRaw, 10);
    if (conductedRaw === '' || isNaN(conducted) || conducted < 0) {
      conductedErrorMsg.textContent = 'Enter a valid non-negative number.';
      conductedInput.style.borderColor = 'var(--danger-color)';
      hasError = true;
    }

    // 4. Validate Attended <= Conducted
    if (!hasError && attended > conducted) {
      formGeneralError.textContent = 'Classes Attended cannot exceed Classes Conducted.';
      formGeneralError.classList.add('visible');
      attendedInput.style.borderColor = 'var(--danger-color)';
      hasError = true;
    }

    if (hasError) return;

    // Create and save new subject
    const newSubject = {
      id: generateId(),
      name: name,
      attended: attended,
      conducted: conducted
    };

    subjects.push(newSubject);
    saveData();
    updateDashboard();
    closeAddModal();
  });

  /* ==========================================================================
     DELETE CONFIRMATION MODAL
     ========================================================================== */

  function openDeleteModal(id, name) {
    subjectToDeleteId = id;
    deleteConfirmText.textContent = `Are you sure you want to delete "${name}"?`;
    deleteModal.removeAttribute('hidden');
    confirmDeleteBtn.focus();
  }

  function closeDeleteModal() {
    deleteModal.setAttribute('hidden', '');
    subjectToDeleteId = null;
  }

  confirmDeleteBtn.addEventListener('click', function () {
    if (!subjectToDeleteId) return;

    subjects = subjects.filter(s => s.id !== subjectToDeleteId);
    saveData();
    updateDashboard();
    closeDeleteModal();
  });

  cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  closeDeleteModalBtn.addEventListener('click', closeDeleteModal);

  /* ==========================================================================
     EDIT SUBJECT DETAILS MODAL & VALIDATION (Name, Attended, Conducted)
     ========================================================================== */

  function openEditModal(subject) {
    subjectToEditId = subject.id;
    editSubjectNameInput.value = subject.name;
    editAttendedInput.value = subject.attended;
    editConductedInput.value = subject.conducted;
    clearEditModalErrors();
    editSubjectModal.removeAttribute('hidden');
    editSubjectNameInput.focus();
    editSubjectNameInput.select();
  }

  function closeEditModal() {
    editSubjectModal.setAttribute('hidden', '');
    subjectToEditId = null;
    clearEditModalErrors();
  }

  function clearEditModalErrors() {
    editNameErrorMsg.textContent = '';
    editAttendedErrorMsg.textContent = '';
    editConductedErrorMsg.textContent = '';
    editFormGeneralError.textContent = '';
    editFormGeneralError.classList.remove('visible');
    editSubjectNameInput.style.borderColor = '';
    editAttendedInput.style.borderColor = '';
    editConductedInput.style.borderColor = '';
  }

  // Counter Steppers in Edit Modal
  editModalAttendedMinus.addEventListener('click', () => {
    let val = parseInt(editAttendedInput.value, 10) || 0;
    if (val > 0) editAttendedInput.value = val - 1;
    clearEditModalErrors();
  });

  editModalAttendedPlus.addEventListener('click', () => {
    let val = parseInt(editAttendedInput.value, 10) || 0;
    editAttendedInput.value = val + 1;
    clearEditModalErrors();
  });

  editModalConductedMinus.addEventListener('click', () => {
    let val = parseInt(editConductedInput.value, 10) || 0;
    if (val > 0) editConductedInput.value = val - 1;
    clearEditModalErrors();
  });

  editModalConductedPlus.addEventListener('click', () => {
    let val = parseInt(editConductedInput.value, 10) || 0;
    editConductedInput.value = val + 1;
    clearEditModalErrors();
  });

  editSubjectForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearEditModalErrors();

    const newName = editSubjectNameInput.value.trim();
    const attendedRaw = editAttendedInput.value.trim();
    const conductedRaw = editConductedInput.value.trim();

    let hasError = false;

    // 1. Validate Subject Name
    if (!newName) {
      editNameErrorMsg.textContent = 'Subject name cannot be empty.';
      editSubjectNameInput.style.borderColor = 'var(--danger-color)';
      hasError = true;
    } else {
      // Check for duplicate names across other subjects (case-insensitive)
      const duplicate = subjects.some(s => s.id !== subjectToEditId && s.name.toLowerCase() === newName.toLowerCase());
      if (duplicate) {
        editNameErrorMsg.textContent = 'Another subject with this name already exists.';
        editSubjectNameInput.style.borderColor = 'var(--danger-color)';
        hasError = true;
      }
    }

    // 2. Validate Attended
    const newAttended = parseInt(attendedRaw, 10);
    if (attendedRaw === '' || isNaN(newAttended) || newAttended < 0) {
      editAttendedErrorMsg.textContent = 'Enter a valid non-negative number.';
      editAttendedInput.style.borderColor = 'var(--danger-color)';
      hasError = true;
    }

    // 3. Validate Conducted
    const newConducted = parseInt(conductedRaw, 10);
    if (conductedRaw === '' || isNaN(newConducted) || newConducted < 0) {
      editConductedErrorMsg.textContent = 'Enter a valid non-negative number.';
      editConductedInput.style.borderColor = 'var(--danger-color)';
      hasError = true;
    }

    // 4. Validate Attended <= Conducted
    if (!hasError && newAttended > newConducted) {
      editFormGeneralError.textContent = 'Classes Attended cannot exceed Classes Conducted.';
      editFormGeneralError.classList.add('visible');
      editAttendedInput.style.borderColor = 'var(--danger-color)';
      hasError = true;
    }

    if (hasError) return;

    const targetSubject = subjects.find(s => s.id === subjectToEditId);
    if (targetSubject) {
      targetSubject.name = newName;
      targetSubject.attended = newAttended;
      targetSubject.conducted = newConducted;
      saveData();
      updateDashboard();
      closeEditModal();
    }
  });

  closeEditModalBtn.addEventListener('click', closeEditModal);
  cancelEditModalBtn.addEventListener('click', closeEditModal);

  /* ==========================================================================
     GLOBAL MODAL LISTENERS & SHORTCUTS
     ========================================================================== */

  openAddSubjectBtn.addEventListener('click', openAddModal);
  emptyAddBtn.addEventListener('click', openAddModal);
  closeAddModalBtn.addEventListener('click', closeAddModal);
  cancelAddModalBtn.addEventListener('click', closeAddModal);

  // Close modals on clicking backdrop
  window.addEventListener('click', function (e) {
    if (e.target === addSubjectModal) {
      closeAddModal();
    } else if (e.target === editSubjectModal) {
      closeEditModal();
    } else if (e.target === deleteModal) {
      closeDeleteModal();
    }
  });

  // Keyboard shortcut: Escape to close modals
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!addSubjectModal.hasAttribute('hidden')) {
        closeAddModal();
      } else if (!editSubjectModal.hasAttribute('hidden')) {
        closeEditModal();
      } else if (!deleteModal.hasAttribute('hidden')) {
        closeDeleteModal();
      }
    }
  });

  /* ==========================================================================
     INITIALIZATION
     ========================================================================== */

  loadData();
  updateDashboard();

})();
